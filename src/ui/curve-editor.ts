import type { BezierCurve, BoneKeyframe, Interpolation, ProjectCommand, TargetKeyframe } from '@/core/types';
import { DEFAULT_BEZIER_CURVE } from '@/core/curves';
import type { EditorState } from './store';

export interface CurveSegment {
  id: string;
  name: string;
  ownerId: string;
  kind: 'bone' | 'ik';
  animationId: string;
  keyframe: BoneKeyframe | TargetKeyframe;
  nextTime: number | undefined;
  interpolation: Interpolation;
  curve: BezierCurve;
}

export interface CurveTrack {
  name: string;
  ownerId: string;
  kind: 'bone' | 'ik';
  animationId: string;
  keys: (BoneKeyframe | TargetKeyframe)[];
  interpolation: Interpolation;
}

const KEY_TIME_TOLERANCE = 0.001;

/** 获取当前动画中所选 FK 或适用 IK 轨道，不要求播放头正好位于关键帧。 */
export function selectedCurveTrack(state: EditorState): CurveTrack | null {
  const animation = state.project.animations.find(item => item.id === state.animationId);
  const selection = state.selection;
  if (!animation || !selection || (selection.kind !== 'bone' && selection.kind !== 'ik')) return null;
  const bone = selection.kind === 'bone' ? state.project.bones.find(item => item.id === selection.id) : undefined;
  const track = bone ? animation.tracks.find(item => item.boneId === bone.id) : undefined;
  const constraint = selection.kind === 'ik' ? state.project.ikConstraints.find(item => item.id === selection.id) : undefined;
  if (constraint?.animationId && constraint.animationId !== animation.id) return null;
  if (!bone && !constraint) return null;
  return { name: bone?.name ?? constraint?.name ?? '', ownerId: selection.id, kind: selection.kind,
    animationId: animation.id, keys: track?.keyframes ?? constraint?.targetKeys ?? [], interpolation: track?.interpolation ?? 'linear' };
}

/** 获取所选关键帧的出段，默认插值从 FK 轨道继承，旧 IK 使用线性。 */
export function selectedCurveSegment(state: EditorState): CurveSegment | null {
  const track = selectedCurveTrack(state);
  if (!track) return null;
  const keyframe = track.keys.find(key => Math.abs(key.time - state.time) < KEY_TIME_TOLERANCE);
  if (!keyframe) return null;
  const nextTime = track.keys.filter(key => key.time > keyframe.time).sort((left, right) => left.time - right.time)[0]?.time;
  return { id: `${state.documentId}:${track.animationId}:${track.kind}:${track.ownerId}:${keyframe.time}`,
    name: track.name, ownerId: track.ownerId, kind: track.kind,
    animationId: track.animationId, keyframe, nextTime, interpolation: keyframe.interpolation ?? track.interpolation,
    curve: keyframe.curve ?? DEFAULT_BEZIER_CURVE };
}

/** 仅更新出段关键帧的缓动，保留姿态数值和轨道默认设置。 */
export function curveEditCommand(options: { segment: CurveSegment; interpolation: Interpolation; curve?: BezierCurve }): ProjectCommand {
  const { segment, interpolation, curve } = options;
  const keyframe = { ...segment.keyframe, interpolation, ...(curve ? { curve } : {}) };
  if (segment.kind === 'bone' && 'rotation' in keyframe) {
    return { type: 'keyframe.set', animationId: segment.animationId, boneId: segment.ownerId, keyframe };
  }
  if (segment.kind === 'ik') return { type: 'ik.keyframe.set', constraintId: segment.ownerId, keyframe };
  throw new Error('骨骼关键帧缺少旋转值');
}

/** 常用缓动预设；控制点限定在单位区间，避免位移或旋转超调。 */
export const CURVE_PRESETS = [
  { name: '标准缓动', curve: DEFAULT_BEZIER_CURVE },
  { name: '缓入', curve: { x1: 0.42, y1: 0, x2: 1, y2: 1 } },
  { name: '缓出', curve: { x1: 0, y1: 0, x2: 0.58, y2: 1 } },
  { name: '缓入缓出', curve: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 } },
] as const;
