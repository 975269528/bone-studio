import { expect, it } from 'vitest';
import { DEFAULT_BEZIER_CURVE, reverseEasing, sampleEasing } from './curves';
import { sampleBoneTrack, sampleTargetTrack } from './sampling';
import { targetKeyframeSchema } from './schema';

it('反射贝塞尔缓动满足 reversed(p)=1-original(1-p)，包含缺省标准 ease', () => {
  for (const curve of [undefined, { x1: 0.42, y1: 0, x2: 1, y2: 1 }, { x1: 1, y1: 0.2, x2: 0, y2: 0.8 }]) {
    const easing = { interpolation: 'bezier' as const, ...(curve ? { curve } : {}) };
    const reverse = reverseEasing(easing);
    for (const progress of [0, 0.1, 0.25, 0.5, 0.8, 1]) {
      expect(sampleEasing({ progress, ...reverse })).toBeCloseTo(1 - sampleEasing({ progress: 1 - progress, ...easing }), 8);
    }
    const twice = reverseEasing(reverse);
    for (const key of ['x1', 'y1', 'x2', 'y2'] as const) expect(twice.curve?.[key]).toBeCloseTo((curve ?? DEFAULT_BEZIER_CURVE)[key], 12);
  }
});

it('阶梯反转为起始后跳变，精确首帧不提前跳；FK 与 IK 共用端点约定且 schema 支持', () => {
  expect(reverseEasing({ interpolation: 'step' })).toEqual({ interpolation: 'step-start' });
  expect(reverseEasing({ interpolation: 'step-start' })).toEqual({ interpolation: 'step' });
  const keys = [{ time: 0, x: 0, y: 0, rotation: 0, interpolation: 'step-start' as const }, { time: 1, x: 10, y: 20, rotation: 90 }];
  expect(sampleBoneTrack({ keys, time: 0, interpolation: 'linear' })?.x).toBe(0);
  expect(sampleTargetTrack({ keys, time: 0 })?.x).toBe(0);
  expect(sampleBoneTrack({ keys, time: Number.EPSILON, interpolation: 'linear' })?.rotation).toBe(90);
  expect(sampleTargetTrack({ keys, time: Number.EPSILON })?.x).toBe(10);
  expect(sampleBoneTrack({ keys, time: 1, interpolation: 'linear' })?.x).toBe(10);
  expect(targetKeyframeSchema.parse({ time: 0, x: 0, y: 0, interpolation: 'step-start' })).toMatchObject({ interpolation: 'step-start' });
});

it('线性和平滑反转保持同种插值，显式控制点副本不共享可变对象', () => {
  for (const interpolation of ['linear', 'smooth'] as const) expect(reverseEasing({ interpolation })).toEqual({ interpolation });
  const curve = { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 };
  const reverse = reverseEasing({ interpolation: 'bezier', curve });
  if (reverse.curve) reverse.curve.x1 = 0;
  expect(curve.x1).toBe(0.25);
});
