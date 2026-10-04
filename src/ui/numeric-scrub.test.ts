import { expect, it } from 'vitest';
import { makeTestProject } from '@/core/test-fixtures';
import { canCoalesceScrub, isScrubInterrupted, scrubNumber } from './numeric-scrub';
import { getEditorState, replaceProject, runCommand, undo } from './store';

it('scrubs left and right with a field-specific step and Shift precision', () => {
  expect(scrubNumber({ raw: 20, deltaX: -4, isFine: false }).value).toBe(16);
  expect(scrubNumber({ raw: 1, deltaX: 6, step: 0.05, isFine: false }).value).toBe(1.3);
  expect(scrubNumber({ raw: 1, deltaX: 6, step: 0.05, isFine: true }).value).toBe(1.03);
});

it('clamps range values without accumulating overshoot that delays reversing direction', () => {
  const maximum = scrubNumber({ raw: 0.95, deltaX: 20, step: 0.05, isFine: false, min: 0, max: 1 });
  expect(maximum).toEqual({ raw: 1, value: 1 });
  expect(scrubNumber({ ...maximum, deltaX: -1, step: 0.05, isFine: false, min: 0, max: 1 }).value).toBe(0.95);
  expect(scrubNumber({ raw: 16, deltaX: -100, isFine: false, min: 16 }).value).toBe(16);
});

it('retains fractional pointer accumulation but emits integral frame rates and layer order', () => {
  const first = scrubNumber({ raw: 24, deltaX: 2, isFine: true, isInteger: true });
  expect(first.value).toBe(24); expect(first.raw).toBeCloseTo(24.2);
  expect(scrubNumber({ raw: first.raw, deltaX: 4, isFine: true, isInteger: true }).value).toBe(25);
});

it('coalesces a single gesture into one undo entry and separates interleaved edits', () => {
  replaceProject(makeTestProject());
  expect(canCoalesceScrub(null, getEditorState().revision)).toBe(false);
  runCommand({ type: 'bone.edit', boneId: 'root', endpoint: 'head', x: 15, y: 20 }, { coalesce: false });
  const revision = getEditorState().revision;
  runCommand({ type: 'bone.edit', boneId: 'root', endpoint: 'head', x: 20, y: 20 },
    { coalesce: canCoalesceScrub(revision, getEditorState().revision) });
  expect(getEditorState().past).toHaveLength(1);
  runCommand({ type: 'project.update', changes: { name: '外部改动' } });
  expect(canCoalesceScrub(revision + 1, getEditorState().revision)).toBe(false);
  undo(); undo(); expect(getEditorState().project.bones[0].x).toBe(10);
});

it('interrupts stale gestures before they overwrite an external edit and never undoes untouched drafts', () => {
  expect(isScrubInterrupted(11, 12)).toBe(true);
  expect(isScrubInterrupted(11, 11)).toBe(false);
  expect(canCoalesceScrub(null, 11)).toBe(false);
});
