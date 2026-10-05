import type { BoneKeyframe, Interpolation, TargetKeyframe } from './types';
import { sampleEasing } from './curves';

interface KeyPair<T> {
  left: T;
  right: T;
  progress: number;
}

function findPair<T extends { time: number }>(keys: T[], time: number): KeyPair<T> | null {
  if (!keys.length) return null;
  const sorted = [...keys].sort((left, right) => left.time - right.time);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (time <= first.time) return { left: first, right: first, progress: 0 };
  if (time >= last.time) return { left: last, right: last, progress: 0 };
  const rightIndex = sorted.findIndex((key) => key.time > time);
  const left = sorted[rightIndex - 1];
  const right = sorted[rightIndex];
  return { left, right, progress: (time - left.time) / (right.time - left.time) };
}

function blend(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

/** 采样局部骨骼变换；角度按作者输入数值插值，可通过 0→360 制作整圈。 */
export function sampleBoneTrack(options: { keys: BoneKeyframe[]; time: number; interpolation: Interpolation }): BoneKeyframe | null {
  const pair = findPair(options.keys, options.time);
  if (!pair) return null;
  const progress = sampleEasing({ progress: pair.progress,
    interpolation: pair.left.interpolation ?? options.interpolation, curve: pair.left.curve });
  return { time: options.time, x: blend(pair.left.x, pair.right.x, progress),
    y: blend(pair.left.y, pair.right.y, progress), rotation: blend(pair.left.rotation, pair.right.rotation, progress) };
}

/** 按左目标帧的缓动采样 IK，旧目标帧默认线性；空轨道由调用者使用静态目标。 */
export function sampleTargetTrack(options: { keys: TargetKeyframe[]; time: number }): TargetKeyframe | null {
  const pair = findPair(options.keys, options.time);
  if (!pair) return null;
  const progress = sampleEasing({ progress: pair.progress,
    interpolation: pair.left.interpolation ?? 'linear', curve: pair.left.curve });
  return { time: options.time, x: blend(pair.left.x, pair.right.x, progress),
    y: blend(pair.left.y, pair.right.y, progress) };
}
