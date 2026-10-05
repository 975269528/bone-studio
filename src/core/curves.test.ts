import { expect, it } from 'vitest';
import { sampleEasing } from './curves';
import { sampleBoneTrack, sampleTargetTrack } from './sampling';
import { samplePose } from './pose';
import { makeTestProject } from './test-fixtures';

it('贝塞尔按时间坐标求参数，默认 ease 与自定义控制点得到数学期望值', () => {
  expect(sampleEasing({ progress: 0.5, interpolation: 'bezier' })).toBeCloseTo(0.8024033876, 9);
  const curve = { x1: 0, y1: 0, x2: 0, y2: 1 };
  // x(t)=t³：时间 1/8 对应参数 1/2，y(1/2)=1/2。
  expect(sampleEasing({ progress: 0.125, interpolation: 'bezier', curve })).toBeCloseTo(0.5, 12);
  const crossed = { x1: 1, y1: 0, x2: 0, y2: 1 };
  expect(sampleEasing({ progress: 0.5, interpolation: 'bezier', curve: crossed })).toBe(0.5);
  expect(sampleEasing({ progress: 0.4375, interpolation: 'bezier', curve: crossed })).toBeCloseTo(0.15625, 12);
});

it('所有插值精确保持端点，退化控制点和区间外进度也有确定结果', () => {
  for (const interpolation of ['linear', 'smooth', 'step', 'bezier'] as const) {
    expect(sampleEasing({ progress: 0, interpolation })).toBe(0);
    expect(sampleEasing({ progress: 1, interpolation })).toBe(1);
  }
  expect(sampleEasing({ progress: -1, interpolation: 'bezier' })).toBe(0);
  expect(sampleEasing({ progress: 2, interpolation: 'bezier' })).toBe(1);
  expect(() => sampleEasing({ progress: Number.NaN, interpolation: 'linear' })).toThrow('有限');
  const diagonal = { x1: 1, y1: 1, x2: 0, y2: 0 };
  expect(sampleEasing({ progress: 0.1, interpolation: 'bezier', curve: diagonal })).toBeCloseTo(0.1, 10);
});

it('左关键帧覆盖轨道设置，只影响出段；乱序、精确中间帧及最后帧均正确', () => {
  const keys = [
    { time: 1, x: 100, y: 100, rotation: 360, interpolation: 'step' as const },
    { time: 2, x: 200, y: 200, rotation: 720 },
    { time: 0, x: 0, y: 0, rotation: 0, interpolation: 'linear' as const },
  ];
  expect(sampleBoneTrack({ keys, time: 0.5, interpolation: 'step' })?.rotation).toBe(180);
  expect(sampleBoneTrack({ keys, time: 1, interpolation: 'linear' })?.x).toBe(100);
  expect(sampleBoneTrack({ keys, time: 1.5, interpolation: 'linear' })?.x).toBe(100);
  expect(sampleBoneTrack({ keys, time: 3, interpolation: 'step' })?.x).toBe(200);
  expect(sampleTargetTrack({ keys: [], time: 0 })).toBeNull();
});

it('FK 平移旋转和 IK 目标共用贝塞尔进度，旧 IK 目标仍按线性采样', () => {
  const curve = { x1: 0, y1: 0, x2: 0, y2: 1 };
  const keys = [{ time: 0, x: 0, y: 0, rotation: 0, interpolation: 'bezier' as const, curve },
    { time: 2, x: 100, y: 100, rotation: 360 }];
  expect(sampleBoneTrack({ keys, time: 0.25, interpolation: 'linear' })).toEqual({ time: 0.25, x: 50, y: 50, rotation: 180 });
  expect(sampleTargetTrack({ keys, time: 0.25 })).toEqual({ time: 0.25, x: 50, y: 50 });
  expect(sampleTargetTrack({ keys: keys.map(({ time, x, y }) => ({ time, x, y })), time: 0.25 })?.x).toBe(12.5);
  const project = makeTestProject();
  project.ikConstraints = [{ id: 'ik', name: '曲线目标', rootBoneId: 'root', tipBoneId: 'tip',
    targetX: 0, targetY: 0, bendDirection: 1, enabled: true, animationId: 'walk', targetKeys: keys }];
  const pose = samplePose({ project, animationId: 'walk', time: 0.25 });
  expect(pose.ikTargets.ik).toEqual({ x: 50, y: 50 });
  expect(pose.bones.tip.endX).toBeCloseTo(50);
  expect(pose.bones.tip.endY).toBeCloseTo(50);
});
