import type { BoneKeyframe, ProjectCommand, TargetKeyframe } from '@/core/types';
import { getBoneEditRules } from './bone-edit';
import { reverseEasing } from '@/core/curves';
import type { EditorState } from './store';

export interface KeyframeRef { kind: 'bone' | 'ik'; id: string; time: number }
interface ClipboardTrack { kind: KeyframeRef['kind']; id: string; keys: (BoneKeyframe | TargetKeyframe)[] }
export interface KeyframeClipboard { tracks: ClipboardTrack[]; start: number; count: number }

/** Identify a track and exact key time without losing its FK/IK scope. */
export function keyframeIdentity(key: KeyframeRef): string { return JSON.stringify([key.kind, key.id, key.time]); }

/** Read one current key, including track defaults as explicit outgoing easing. */
export function readKeyframe(state: EditorState, ref: KeyframeRef): BoneKeyframe | TargetKeyframe | undefined {
  const animation = state.project.animations.find(item => item.id === state.animationId);
  if (!animation) return undefined;
  if (ref.kind === 'bone') {
    const track = animation.tracks.find(item => item.boneId === ref.id);
    const key = track?.keyframes.find(item => item.time === ref.time);
    return key ? { ...key, interpolation: key.interpolation ?? track!.interpolation } : undefined;
  }
  const constraint = state.project.ikConstraints.find(item => item.id === ref.id);
  if (constraint?.animationId && constraint.animationId !== animation.id) return undefined;
  const key = constraint?.targetKeys.find(item => item.time === ref.time);
  return key ? { ...key, interpolation: key.interpolation ?? 'linear' } : undefined;
}

/** Deep-copy selected keys, retaining their source tracks and relative timing. */
export function createKeyframeClipboard(state: EditorState, refs: KeyframeRef[]): KeyframeClipboard {
  if (!refs.length) throw new Error('请先选择要复制的关键帧。');
  const tracks: ClipboardTrack[] = [];
  for (const ref of refs) {
    const key = readKeyframe(state, ref);
    if (!key) throw new Error('所选关键帧已不存在，请重新选择。');
    let track = tracks.find(item => item.kind === ref.kind && item.id === ref.id);
    if (!track) { track = { kind: ref.kind, id: ref.id, keys: [] }; tracks.push(track); }
    track.keys.push(structuredClone(key));
  }
  return { tracks, start: Math.min(...refs.map(ref => ref.time)), count: refs.length };
}

function reversedTrack(track: ClipboardTrack, interval: { start: number; end: number }): ClipboardTrack {
  const originals = [...track.keys].sort((left, right) => left.time - right.time);
  const keys = [...originals].reverse().map((key, index) => {
    const source = originals[index === originals.length - 1 ? originals.length - 1 : originals.length - 2 - index];
    const time = key.time === interval.start ? interval.end : key.time === interval.end ? interval.start : interval.start + interval.end - key.time;
    const reversed = { ...structuredClone(key), time,
      ...reverseEasing({ interpolation: source.interpolation ?? 'linear', curve: source.curve }) };
    if (!source.curve && source.interpolation !== 'bezier') delete reversed.curve;
    return reversed;
  });
  return { ...track, keys };
}

/** Reverse key timing across the complete copied interval and reflect each outgoing easing segment. */
export function reverseKeyframeClipboard(clipboard: KeyframeClipboard): KeyframeClipboard {
  const end = Math.max(...clipboard.tracks.flatMap(track => track.keys.map(key => key.time)));
  return { ...clipboard, tracks: clipboard.tracks.map(track => reversedTrack(track, { start: clipboard.start, end })) };
}

/** Return the deletion command for a precise FK or IK key reference. */
export function removeKeyframeCommand(state: EditorState, key: KeyframeRef): ProjectCommand {
  if (key.kind === 'ik') return { type: 'ik.keyframe.remove', constraintId: key.id, time: key.time };
  if (!state.animationId) throw new Error('请先选择动作。');
  return { type: 'keyframe.remove', animationId: state.animationId, boneId: key.id, time: key.time };
}

function destinationId(state: EditorState, clipboard: KeyframeClipboard, track: ClipboardTrack): string {
  const selection = state.selection;
  if (clipboard.tracks.length !== 1 || !selection || !['bone', 'ik'].includes(selection.kind)) return track.id;
  if (selection.kind !== track.kind) throw new Error('骨骼关键帧与 IK 目标帧不能跨类型粘贴，请选择同类轨道。');
  return selection.id;
}

function pastedBoneKey(state: EditorState, ref: KeyframeRef, key: BoneKeyframe): ProjectCommand {
  const bone = state.project.bones.find(item => item.id === ref.id);
  if (!bone) throw new Error(`粘贴失败：来源或目标骨骼不存在（${ref.id}）。`);
  const constraint = getBoneEditRules({ project: state.project, animationId: state.animationId, time: ref.time }, bone.id).positionConstraint;
  const root = constraint ? state.project.bones.find(item => item.id === constraint.rootBoneId) : undefined;
  const keyframe = { ...structuredClone(key), time: ref.time, ...(root ? { x: root.length, y: 0 } : {}) };
  return { type: 'keyframe.set', animationId: state.animationId!, boneId: ref.id, keyframe };
}

function pastedIKKey(state: EditorState, ref: KeyframeRef, key: TargetKeyframe): ProjectCommand {
  const constraint = state.project.ikConstraints.find(item => item.id === ref.id);
  if (!constraint) throw new Error(`粘贴失败：来源或目标 IK 约束不存在（${ref.id}）。`);
  if (constraint.animationId && constraint.animationId !== state.animationId) throw new Error('粘贴失败：目标 IK 约束关联了其他动作。');
  return { type: 'ik.keyframe.set', constraintId: ref.id, keyframe: { ...structuredClone(key), time: ref.time } };
}

/** Plan one atomic paste; reject invalid times/targets before writing any key. */
export function planKeyframePaste(state: EditorState, clipboard: KeyframeClipboard): { commands: ProjectCommand[]; refs: KeyframeRef[] } {
  const animation = state.project.animations.find(item => item.id === state.animationId);
  if (!animation) throw new Error('请先选择要粘贴到的动作。');
  const commands: ProjectCommand[] = []; const refs: KeyframeRef[] = [];
  for (const track of clipboard.tracks) {
    const id = destinationId(state, clipboard, track);
    for (const key of track.keys) {
      const time = Number((state.time + key.time - clipboard.start).toFixed(9));
      if (time < 0 || time > animation.duration) throw new Error('粘贴失败：关键帧超出动作时长，请移动播放头或增加时长。');
      const ref = { kind: track.kind, id, time };
      const command = track.kind === 'bone' ? pastedBoneKey(state, ref, key as BoneKeyframe) : pastedIKKey(state, ref, key);
      if (readKeyframe(state, ref)) commands.push(removeKeyframeCommand(state, ref));
      commands.push(command); refs.push(ref);
    }
  }
  return { commands, refs };
}
