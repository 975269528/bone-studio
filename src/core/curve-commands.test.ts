import { expect, it } from 'vitest';
import { executeCommand, executeCommands } from './commands';
import { applyHistory, createHistory, redoHistory, undoHistory } from './history';
import { parseProject } from './validation';
import { makeTestProject } from './test-fixtures';

const CURVE = { x1: 0.42, y1: 0, x2: 1, y2: 1 };

function curveProject() {
  const project = makeTestProject();
  project.animations[0].tracks = [{ boneId: 'root', interpolation: 'linear', keyframes: [
    { time: 0, x: 10, y: 20, rotation: 0, interpolation: 'bezier', curve: CURVE },
    { time: 2, x: 20, y: 30, rotation: 90 },
  ] }];
  project.ikConstraints = [{ id: 'ik', name: '曲线 IK', rootBoneId: 'root', tipBoneId: 'tip',
    targetX: 100, targetY: 80, bendDirection: 1, enabled: true, animationId: 'walk', targetKeys: [
      { time: 0, x: 100, y: 80, interpolation: 'bezier', curve: CURVE }, { time: 2, x: 100, y: 40 },
    ] }];
  return project;
}

it('旧项目保持格式，新增曲线完整往返；非法、缺失和额外控制点均被拒绝', () => {
  const old = makeTestProject();
  expect(parseProject(old)).toEqual(old);
  const project = curveProject();
  expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  const invalidCurves = [{ ...CURVE, x1: -0.1 }, { ...CURVE, y2: 1.1 }, { ...CURVE, x2: Number.NaN },
    { x1: 0, y1: 0, x2: 1 }, { ...CURVE, surprise: true }];
  for (const curve of invalidCurves) {
    expect(() => executeCommand({ project, command: { type: 'keyframe.set', animationId: 'walk', boneId: 'root',
      keyframe: { time: 0, x: 10, y: 20, rotation: 0, interpolation: 'bezier', curve } } })).toThrow('命令校验');
    expect(() => executeCommand({ project, command: { type: 'ik.keyframe.set', constraintId: 'ik',
      keyframe: { time: 0, x: 100, y: 80, interpolation: 'bezier', curve } } })).toThrow('命令校验');
  }
});

it('重新录入姿态保留 FK 和 IK 出段缓动，显式更新支持覆盖且只产生一次撤销', () => {
  const project = curveProject();
  const history = createHistory(project);
  const changed = applyHistory({ history, commands: [
    { type: 'keyframe.set', animationId: 'walk', boneId: 'root', keyframe: { time: 0, x: 30, y: 40, rotation: 90 } },
    { type: 'ik.keyframe.set', constraintId: 'ik', keyframe: { time: 0, x: 110, y: 50 } },
  ] });
  expect(changed.present.animations[0].tracks[0].keyframes[0]).toMatchObject({ x: 30, interpolation: 'bezier', curve: CURVE });
  expect(changed.present.ikConstraints[0].targetKeys[0]).toMatchObject({ x: 110, interpolation: 'bezier', curve: CURVE });
  expect(changed.past).toHaveLength(1);
  expect(undoHistory(changed).present).toEqual(project);
  expect(redoHistory(undoHistory(changed)).present).toEqual(changed.present);
  const updated = executeCommand({ project, command: { type: 'keyframe.set', animationId: 'walk', boneId: 'root',
    keyframe: { time: 0, x: 10, y: 20, rotation: 0, interpolation: 'step' } } });
  expect(updated.animations[0].tracks[0].keyframes[0].interpolation).toBe('step');
  expect(updated.animations[0].tracks[0].interpolation).toBe('linear');
});

it('移除再粘贴精确替换缓动；批次失败既不污染曲线也不改变输入', () => {
  const project = curveProject();
  const original = structuredClone(project);
  const commands = [{ type: 'keyframe.remove', animationId: 'walk', boneId: 'root', time: 0 },
    { type: 'keyframe.set', animationId: 'walk', boneId: 'root', keyframe: { time: 0, x: 5, y: 5, rotation: 0 } }];
  const pasted = executeCommands({ project, commands });
  expect(pasted.animations[0].tracks[0].keyframes[0]).toEqual({ time: 0, x: 5, y: 5, rotation: 0 });
  expect(() => executeCommands({ project, commands: [...commands,
    { type: 'ik.keyframe.set', constraintId: 'ik', keyframe: { time: 3, x: 0, y: 0 } }] })).toThrow('时长');
  expect(project).toEqual(original);
});

it('删除 IK 下骨烘焙根骨现有关键帧时保持原有曲线元数据', () => {
  const project = curveProject();
  const updated = executeCommand({ project, command: { type: 'bone.remove', boneId: 'tip', animationId: 'walk', time: 0 } });
  expect(updated.animations[0].tracks[0].keyframes[0]).toMatchObject({ interpolation: 'bezier', curve: CURVE });
});
