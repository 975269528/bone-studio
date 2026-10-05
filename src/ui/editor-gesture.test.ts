import { beforeEach, expect, it } from 'vitest';
import { makeTestProject } from '@/core/test-fixtures';
import { applyCommands, getEditorState, replaceProject, updateEditor } from './store';
import { commitAnimationDuration } from './timeline-duration';
import { displayedBone, updateBone } from './pose-edit';
import { setAutoKeyframe } from './auto-keyframe';
import { advanceEditorGesture, cancelEditorGesture, captureEditorGesture, isEditorGestureCurrent } from './editor-gesture';

beforeEach(() => { replaceProject(makeTestProject()); updateEditor({ time: 0.5, isAutoKeyframe: false }); });

it('restores only the current gesture draft and retains earlier pending transforms', () => {
  const bone = getEditorState().project.bones[1]; updateBone(bone, { rotation: 25 });
  const original = getEditorState(); const gesture = captureEditorGesture();
  updateBone(bone, { rotation: 40 }); advanceEditorGesture(gesture);
  updateBone(bone, { rotation: 55 }); advanceEditorGesture(gesture); cancelEditorGesture(gesture);
  expect(getEditorState().poseDraft).toBe(original.poseDraft); expect(displayedBone(bone).rotation).toBeCloseTo(25);
  expect(getEditorState().past).toHaveLength(0); expect(getEditorState().project).toBe(original.project);
});

it('cancels one automatically recorded drag as a single undo', () => {
  setAutoKeyframe(true); const original = getEditorState().project; const bone = original.bones[1]; const gesture = captureEditorGesture();
  updateBone(bone, { rotation: 40 }); advanceEditorGesture(gesture);
  updateBone(bone, { rotation: 55 }, { coalesce: true }); advanceEditorGesture(gesture);
  expect(getEditorState().past).toHaveLength(1); cancelEditorGesture(gesture);
  expect(getEditorState().project).toEqual(original); expect(getEditorState().past).toHaveLength(0);
});

it('restores pending pose after cancelling a canonical non-pose gesture without undoing preceding work', () => {
  const bone = getEditorState().project.bones[1]; updateBone(bone, { rotation: 25 });
  const original = getEditorState(); const gesture = captureEditorGesture();
  applyCommands([{ type: 'bone.update', boneId: bone.id, changes: { length: 100 } }]); advanceEditorGesture(gesture);
  expect(getEditorState().poseDraft).toBeNull(); cancelEditorGesture(gesture);
  expect(getEditorState().project).toEqual(original.project); expect(getEditorState().poseDraft).toBe(original.poseDraft);
  expect(displayedBone(bone).rotation).toBeCloseTo(25);
});

it('interrupts safely on other edits or seek and never cancels somebody else’s command', () => {
  const bone = getEditorState().project.bones[1]; const gesture = captureEditorGesture();
  updateBone(bone, { rotation: 40 }); advanceEditorGesture(gesture);
  applyCommands([{ type: 'project.update', changes: { name: '外部改动' } }]);
  const external = getEditorState(); expect(isEditorGestureCurrent(gesture)).toBe(false); cancelEditorGesture(gesture);
  expect(getEditorState()).toBe(external); expect(getEditorState().project.name).toBe('外部改动');
  const next = captureEditorGesture(); updateEditor({ time: 1 }); expect(isEditorGestureCurrent(next)).toBe(false);
});

it('accepts a numeric duration edit that moves its own playhead and restores the baseline on cancel', () => {
  const original = getEditorState(); const gesture = captureEditorGesture();
  commitAnimationDuration(4); advanceEditorGesture(gesture);
  expect(getEditorState().time).toBe(1); expect(isEditorGestureCurrent(gesture)).toBe(true);
  cancelEditorGesture(gesture);
  expect(getEditorState().project).toEqual(original.project); expect(getEditorState().time).toBe(original.time);
});
