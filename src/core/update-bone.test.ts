import { expect, it } from 'vitest';
import { executeCommand } from './commands';
import { addAnimatedIK, makeAttachedProject } from './edit-test-fixtures';
import { applyHistory, createHistory, undoHistory } from './history';

it('骨长调整同步 IK 下骨和适用动作关键帧，撤销恢复原骨链', () => {
  const project = makeAttachedProject();
  addAnimatedIK(project);
  const changed = applyHistory({ history: createHistory(project), commands: [
    { type: 'bone.update', boneId: 'root', changes: { length: 120 } },
  ] });
  expect(changed.present.bones[1]).toEqual({ ...project.bones[1], x: 120, y: 0 });
  expect(changed.present.animations[0].tracks[1].keyframes[0]).toEqual({ time: 1, x: 120, y: 0, rotation: 30 });
  expect(changed.present.ikConstraints).toEqual(project.ikConstraints);
  expect(undoHistory(changed).present).toEqual(project);
});

it('普通 FK 仅维护原本末端相连的子骨和关键帧，不移动自定义偏移', () => {
  const project = makeAttachedProject();
  project.bones.push({ id: 'offset', name: '偏移子骨', parentId: 'root', x: 30, y: 10, rotation: 0, length: 20 });
  project.animations[0].tracks = [{ boneId: 'tip', interpolation: 'linear', keyframes: [
    { time: 0, x: 80, y: 0, rotation: 0 }, { time: 1, x: 90, y: 5, rotation: 45 },
  ] }];
  const updated = executeCommand({ project, command: { type: 'bone.update', boneId: 'root', changes: { length: 100 } } });
  expect(updated.bones[1].x).toBe(100);
  expect(updated.bones[2]).toEqual(project.bones[2]);
  expect(updated.animations[0].tracks[0].keyframes).toEqual([
    { time: 0, x: 100, y: 0, rotation: 0 }, { time: 1, x: 90, y: 5, rotation: 45 },
  ]);
});

it('调整骨长仍校验长度和最终引用，并保持输入不变', () => {
  const project = makeAttachedProject();
  addAnimatedIK(project);
  const original = structuredClone(project);
  expect(() => executeCommand({ project, command: { type: 'bone.update', boneId: 'root', changes: { length: 0 } } })).toThrow('命令校验');
  expect(() => executeCommand({ project, command: { type: 'bone.update', boneId: 'tip', changes: { length: 50, parentId: null } } })).toThrow('相接');
  expect(project).toEqual(original);
});
