import { beforeEach, expect, it } from 'vitest';
import { createEmptyProject } from '@/core/api';
import type { Project } from '@/core/types';
import { applyCommands, getEditorState, replaceProject, undo, updateEditor } from './store';
import { createKeyframeClipboard, planKeyframePaste } from './keyframe-clipboard';
import type { KeyframeRef } from './keyframe-clipboard';
import { clearKeyframeSelection, copySelectedKeyframes, deleteSelectedKeyframes, getSelectedKeyframes, pasteKeyframes, pasteReversedKeyframes, selectKeyframe } from './timeline-keyframes';

function fixture(): Project {
  const project = createEmptyProject();
  project.bones = [
    { id: 'root', name: '上骨', parentId: null, x: 0, y: 0, rotation: 0, length: 100 },
    { id: 'tip', name: '下骨', parentId: 'root', connection: 'tail', x: 100, y: 0, rotation: 0, length: 80 },
    { id: 'free', name: '自由骨', parentId: null, x: 20, y: 30, rotation: 0, length: 60 },
  ];
  project.animations = [{ id: 'anim', name: '动作', duration: 4, fps: 24, loop: true, tracks: [
    { boneId: 'free', interpolation: 'smooth', keyframes: [
      { time: 0.5, x: 11, y: 12, rotation: 720, interpolation: 'bezier', curve: { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9 } },
      { time: 1, x: 21, y: 22, rotation: 810 }, { time: 1.5, x: 31, y: 32, rotation: 900 },
    ] }, { boneId: 'tip', interpolation: 'linear', keyframes: [{ time: 0.5, x: 100, y: 0, rotation: 45 }] },
  ] }];
  project.ikConstraints = [{ id: 'ik', name: '手目标', rootBoneId: 'root', tipBoneId: 'tip', targetX: 140, targetY: 40,
    bendDirection: 1, enabled: true, animationId: 'anim', targetKeys: [{ time: 1, x: 150, y: 50, interpolation: 'step' }] }];
  return project;
}

const keys: KeyframeRef[] = [0.5, 1, 1.5].map(time => ({ kind: 'bone', id: 'free', time }));
function select(ref: KeyframeRef, options?: { additive?: boolean; range?: boolean }): void {
  selectKeyframe({ ref, trackKeys: keys, additive: options?.additive ?? false, range: options?.range ?? false });
}
beforeEach(() => { replaceProject(fixture()); clearKeyframeSelection(); });

it('supports toggle/range multi-selection and copies a deep relative-time snapshot', () => {
  select(keys[0]); select(keys[2], { range: true });
  expect(getSelectedKeyframes()).toEqual(keys);
  select(keys[1], { additive: true }); expect(getSelectedKeyframes()).toEqual([keys[0], keys[2]]);
  expect(copySelectedKeyframes()).toBe(true);
  const original = getEditorState().project;
  applyCommands([{ type: 'keyframe.set', animationId: 'anim', boneId: 'free', keyframe: { time: 0.5, x: 99, y: 88, rotation: 0 } }]);
  updateEditor({ time: 2 }); expect(pasteKeyframes()).toBe(true);
  const pasted = getEditorState().project.animations[0].tracks[0].keyframes.find(key => key.time === 2)!;
  expect(pasted).toMatchObject({ x: 11, y: 12, rotation: 720, interpolation: 'bezier', curve: { x1: 0.2 } });
  expect(getEditorState().project.animations[0].tracks[0].keyframes.some(key => key.time === 3)).toBe(true);
  expect(original.animations[0].tracks[0].keyframes[0].x).toBe(11);
});

it('pastes multiple FK/IK tracks to their original tracks with a single undo entry', () => {
  select(keys[0]); select({ kind: 'bone', id: 'tip', time: 0.5 }, { additive: true });
  select({ kind: 'ik', id: 'ik', time: 1 }, { additive: true }); copySelectedKeyframes();
  const before = getEditorState().project; const past = getEditorState().past.length;
  updateEditor({ time: 2, selection: { kind: 'bone', id: 'root' } }); expect(pasteKeyframes()).toBe(true);
  expect(getEditorState().past.length).toBe(past + 1);
  expect(getEditorState().project.animations[0].tracks.find(track => track.boneId === 'tip')!.keyframes.at(-1)).toMatchObject({ time: 2, x: 100, y: 0, rotation: 45 });
  expect(getEditorState().project.ikConstraints[0].targetKeys.at(-1)).toMatchObject({ time: 2.5, x: 150, interpolation: 'step' });
  undo(); expect(getEditorState().project).toEqual(before); expect(getSelectedKeyframes()).toEqual([]);
  expect(pasteReversedKeyframes()).toBe(true); expect(getEditorState().past.length).toBe(past + 1);
  expect(getEditorState().project.ikConstraints[0].targetKeys.at(-1)).toMatchObject({ time: 2, x: 150, interpolation: 'step-start' });
  expect(getEditorState().project.animations[0].tracks.find(track => track.boneId === 'tip')!.keyframes.at(-1)).toMatchObject({ time: 2.5, x: 100, rotation: 45 });
  undo(); expect(pasteKeyframes()).toBe(true);
  expect(getEditorState().project.ikConstraints[0].targetKeys.at(-1)).toMatchObject({ time: 2.5, interpolation: 'step' });
});

it('retargets single bone tracks while preserving IK joint position and replaces old easing', () => {
  select(keys[0]); copySelectedKeyframes(); updateEditor({ selection: { kind: 'bone', id: 'tip' }, time: 0.5 });
  expect(pasteKeyframes()).toBe(true);
  const key = getEditorState().project.animations[0].tracks.find(track => track.boneId === 'tip')!.keyframes[0];
  expect(key).toMatchObject({ x: 100, y: 0, rotation: 720, interpolation: 'bezier', curve: { x1: 0.2 } });
  const copied = createKeyframeClipboard(getEditorState(), [keys[1]]);
  applyCommands(planKeyframePaste(getEditorState(), copied).commands);
  expect(getEditorState().project.animations[0].tracks.find(track => track.boneId === 'tip')!.keyframes[0]).toMatchObject({ interpolation: 'smooth' });
  expect(getEditorState().project.animations[0].tracks.find(track => track.boneId === 'tip')!.keyframes[0].curve).toBeUndefined();
});

it('fails atomically for out-of-duration, missing references and mismatched IK destinations', () => {
  const copied = createKeyframeClipboard(getEditorState(), [keys[0], { kind: 'ik', id: 'ik', time: 1 }]);
  const before = getEditorState().project;
  updateEditor({ time: 4 }); expect(() => planKeyframePaste(getEditorState(), copied)).toThrow('超出动作时长');
  expect(getEditorState().project).toBe(before);
  const next = fixture(); next.ikConstraints = []; replaceProject(next); updateEditor({ time: 2 });
  expect(() => planKeyframePaste(getEditorState(), copied)).toThrow('IK 约束不存在');
  const single = createKeyframeClipboard(getEditorState(), [keys[0]]);
  updateEditor({ selection: { kind: 'ik', id: 'missing' } });
  expect(() => planKeyframePaste(getEditorState(), single)).toThrow('不能跨类型粘贴');
  expect(getEditorState().past).toHaveLength(0);
});

it('deletes live selected keys in one undo and clears stale references after object/action changes', () => {
  select(keys[0]); select(keys[2], { additive: true }); const before = getEditorState().project;
  expect(deleteSelectedKeyframes()).toBe(true); expect(getEditorState().past).toHaveLength(1);
  expect(deleteSelectedKeyframes()).toBe(true);
  expect(getEditorState().project.animations[0].tracks[0].keyframes).toHaveLength(1);
  undo(); expect(getEditorState().project).toEqual(before);
  select(keys[0]); updateEditor({ selection: { kind: 'bone', id: 'root' } });
  expect(deleteSelectedKeyframes()).toBe(false); expect(getSelectedKeyframes()).toEqual([]);
  select(keys[0]); updateEditor({ animationId: null }); expect(getSelectedKeyframes()).toEqual([]);
});

it('retains a consumed timeline deletion scope when undo removes pasted keys', () => {
  select(keys[0]); copySelectedKeyframes(); updateEditor({ time: 2 }); pasteKeyframes();
  undo(); expect(getSelectedKeyframes()).toEqual([]);
  expect(deleteSelectedKeyframes()).toBe(true);
  expect(getEditorState().project.bones).toHaveLength(3);
  clearKeyframeSelection(); expect(deleteSelectedKeyframes()).toBe(false);
});
