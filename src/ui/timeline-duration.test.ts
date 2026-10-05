import { beforeEach, expect, it } from 'vitest';
import { createDemoProject } from '@/core/api';
import { commitAnimationDuration, draggedDuration } from './timeline-duration';
import { getEditorState, replaceProject, undo, updateEditor } from './store';

beforeEach(() => {
  const project = createDemoProject(); const bone = project.bones[0];
  project.animations[0].tracks = [{ boneId: bone.id, interpolation: 'smooth', keyframes: [
    { time: 0.25, x: bone.x, y: bone.y, rotation: bone.rotation, interpolation: 'bezier', curve: { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9 } },
    { time: project.animations[0].duration, x: bone.x + 10, y: bone.y, rotation: bone.rotation + 30 },
  ] }];
  replaceProject(project);
});

it('uses the original scale for duration drag, frame snapping and endpoints', () => {
  const source = { duration: 2, width: 800, fps: 24 };
  expect(draggedDuration({ ...source, deltaX: 400 })).toBe(3);
  expect(draggedDuration({ ...source, deltaX: -400 })).toBe(1);
  expect(draggedDuration({ ...source, deltaX: -8000 })).toBe(1 / 24);
  expect(draggedDuration({ ...source, deltaX: 1000000 })).toBe(600);
  expect(draggedDuration({ ...source, duration: 2.02, deltaX: 0 })).toBe(2.02);
});

it('retimes the playhead and every bone key with a single undo and no lost metadata', () => {
  updateEditor({ time: 0.5, isPlaying: true }); const before = getEditorState();
  const animation = before.project.animations[0]; commitAnimationDuration(animation.duration * 2);
  const after = getEditorState(); expect(after.time).toBe(1); expect(after.isPlaying).toBe(false);
  expect(after.past).toHaveLength(1);
  expect(after.project.animations[0].tracks[0].keyframes).toEqual(animation.tracks[0].keyframes.map(key => ({ ...key, time: key.time * 2 })));
  undo(); expect(getEditorState().project).toEqual(before.project);
});

it('rejects a gesture interrupted by another document command without partial retiming', () => {
  const snapshot = getEditorState(); updateEditor({ revision: snapshot.revision + 1 });
  commitAnimationDuration(3, { expectedRevision: snapshot.revision, documentId: snapshot.documentId, animationId: snapshot.animationId! });
  expect(getEditorState().project).toBe(snapshot.project); expect(getEditorState().past).toHaveLength(0);
  expect(getEditorState().message).toContain('版本冲突');
});
