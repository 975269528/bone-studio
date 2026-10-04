import { expect, it } from 'vitest';
import { samplePose } from './pose';
import { sampleBoneTrack } from './sampling';
import { makeTestProject } from './test-fixtures';

const KEYS = [{ time: 0, x: 0, y: 20, rotation: 0 }, { time: 2, x: 100, y: 40, rotation: 360 }];

it('线性插值包含完整旋转与平移，乱序关键帧也正确', () => {
  const key = sampleBoneTrack({ keys: [...KEYS].reverse(), time: 1, interpolation: 'linear' });
  expect(key).toEqual({ time: 1, x: 50, y: 30, rotation: 180 });
});

it('平滑和阶跃具有明确的边界行为', () => {
  expect(sampleBoneTrack({ keys: KEYS, time: 0.5, interpolation: 'smooth' })?.x).toBeCloseTo(15.625);
  expect(sampleBoneTrack({ keys: KEYS, time: 1, interpolation: 'step' })?.x).toBe(0);
  expect(sampleBoneTrack({ keys: KEYS, time: 2, interpolation: 'step' })?.x).toBe(100);
});

it('循环终点可编辑，超出时长再循环；拒绝错误动画与非有限时间', () => {
  const project = makeTestProject();
  project.animations[0].loop = true;
  project.animations[0].tracks = [{ boneId: 'root', interpolation: 'linear', keyframes: KEYS }];
  expect(samplePose({ project, animationId: 'walk', time: 2 }).bones.root.x).toBe(100);
  expect(samplePose({ project, animationId: 'walk', time: 3 }).bones.root.x).toBe(50);
  expect(() => samplePose({ project, animationId: 'missing', time: 0 })).toThrow('动画不存在');
  expect(() => samplePose({ project, time: Number.NaN })).toThrow('有限');
});

it('IK 使用采样目标而非静态目标，并且不污染项目', () => {
  const project = makeTestProject();
  project.ikConstraints = [{ id: '__proto__', name: '移动手', rootBoneId: 'root', tipBoneId: 'tip',
    targetX: 999, targetY: 999, bendDirection: 1, enabled: true, animationId: 'walk',
    targetKeys: [{ time: 0, x: 100, y: 30 }, { time: 2, x: 100, y: 90 }] }];
  const original = JSON.stringify(project);
  const pose = samplePose({ project, animationId: 'walk', time: 1 });
  expect(pose.bones.tip.endX).toBeCloseTo(100);
  expect(pose.bones.tip.endY).toBeCloseTo(60);
  expect(pose.ikTargets.__proto__).toEqual({ x: 100, y: 60 });
  expect(JSON.stringify(project)).toBe(original);
  expect(samplePose({ project, animationId: null, time: 1 }).ikDiagnostics).toEqual([]);
  delete project.ikConstraints[0].animationId;
  const setupPose = samplePose({ project, animationId: null, time: 1 });
  expect(setupPose.ikTargets.__proto__).toEqual({ x: 999, y: 999 });
  expect(setupPose.ikDiagnostics[0].reachable).toBe(false);
});

it('父骨有平移和旋转时，IK 仍保持子树连接', () => {
  const project = makeTestProject();
  project.bones.unshift({ id: 'parent', name: '父骨', parentId: null, x: 80, y: 40, rotation: 45, length: 20 });
  project.bones[1].parentId = 'parent';
  project.ikConstraints = [{ id: 'ik', name: '手', rootBoneId: 'root', tipBoneId: 'tip',
    targetX: 130, targetY: 100, bendDirection: -1, enabled: true, targetKeys: [] }];
  const pose = samplePose({ project, time: 0 });
  expect(pose.bones.tip.endX).toBeCloseTo(130);
  expect(pose.bones.tip.endY).toBeCloseTo(100);
  expect(pose.bones.tip.x).toBeCloseTo(pose.bones.root.endX);
  expect(pose.bones.tip.y).toBeCloseTo(pose.bones.root.endY);
});
