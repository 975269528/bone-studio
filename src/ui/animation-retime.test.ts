import { expect, it } from 'vitest';
import { applyHistory, createHistory, undoHistory } from '@/core/history';
import { makeTestProject } from '@/core/test-fixtures';
import { planAnimationDuration } from './animation-retime';

const CURVE = { x1: 0.42, y1: 0, x2: 1, y2: 1 };

function retimeContext() {
  const project = makeTestProject();
  project.animations[0].tracks = [{ boneId: 'root', interpolation: 'linear', keyframes: [
    { time: 0, x: 10, y: 20, rotation: 0, interpolation: 'bezier', curve: CURVE }, { time: 2, x: 30, y: 40, rotation: 45 },
  ] }];
  project.ikConstraints = [{ id: 'ik', name: '目标', rootBoneId: 'root', tipBoneId: 'tip',
    targetX: 100, targetY: 80, bendDirection: 1, enabled: true, animationId: 'walk', targetKeys: [
      { time: 1, x: 100, y: 80, interpolation: 'bezier', curve: CURVE }, { time: 2, x: 100, y: 90 },
    ] }];
  return { project, animationId: 'walk' };
}

it('缩短和延长均比例移动 FK/关联 IK，端点精确且姿态和缓动保持，一次撤销恢复', () => {
  for (const duration of [0.5, 7.3]) {
    const context = retimeContext();
    const history = createHistory(context.project);
    const changed = applyHistory({ history, commands: planAnimationDuration(context, duration) });
    expect(changed.present.animations[0].tracks[0].keyframes[1].time).toBe(duration);
    expect(changed.present.ikConstraints[0].targetKeys[0]).toEqual({ ...context.project.ikConstraints[0].targetKeys[0], time: duration / 2 });
    expect(changed.present.animations[0].tracks[0].keyframes[0]).toEqual(context.project.animations[0].tracks[0].keyframes[0]);
    expect(changed.past).toHaveLength(1);
    expect(undoHistory(changed).present).toEqual(context.project);
  }
});

it('共享非空 IK 在多动作时明确拒绝，单动作共享可伸缩，其他动作专属 IK 不受影响', () => {
  const context = retimeContext();
  delete context.project.ikConstraints[0].animationId;
  expect(planAnimationDuration(context, 1)).toHaveLength(2);
  context.project.animations.push({ ...context.project.animations[0], id: 'other', tracks: [] });
  expect(() => planAnimationDuration(context, 1)).toThrow('共享');
  context.project.ikConstraints[0].animationId = 'other';
  expect(planAnimationDuration(context, 1)).toHaveLength(1);
  delete context.project.ikConstraints[0].animationId;
  context.project.ikConstraints[0].targetKeys = [];
  expect(planAnimationDuration(context, 1)).toHaveLength(1);
});

it('相同时长不生成事务，拒绝非有限和越界时长；原项目保持不变', () => {
  const context = retimeContext();
  const original = structuredClone(context.project);
  expect(planAnimationDuration(context, 2)).toEqual([]);
  for (const duration of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 601]) {
    expect(() => planAnimationDuration(context, duration)).toThrow('有限数值');
  }
  expect(context.project).toEqual(original);
});
