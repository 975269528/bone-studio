import { afterEach, expect, it, vi } from 'vitest';
import { DELETE_SHORTCUT_EVENT, deletionScope, hasDeletionGesture, installDeletionGuards, keyframeDeletionKey, requestShortcutDeletion } from './delete-shortcut';

afterEach(() => vi.unstubAllGlobals());

it('deletes only an explicitly scoped timeline target or a selected editable object', () => {
  expect(deletionScope({ isTimeline: false, selection: null })).toBeUndefined();
  expect(deletionScope({ isTimeline: false, selection: { kind: 'asset', id: 'image' } })).toBeUndefined();
  for (const kind of ['bone', 'attachment', 'ik'] as const) {
    const selection = { kind, id: 'selected' };
    expect(deletionScope({ isTimeline: false, selection })).toBe(`${kind}.remove`);
    expect(deletionScope({ isTimeline: true, selection })).toBeUndefined();
  }
  expect(deletionScope({ isTimeline: true, selection: null, explicitKind: 'animation.remove' })).toBe('animation.remove');
});

it('matches exact keyframe targets and never falls back to object deletion for a stale diamond', () => {
  const command = { type: 'keyframe.remove', animationId: 'animation', boneId: 'bone', time: 0.5 } as const;
  const key = keyframeDeletionKey(command);
  const button = { dataset: { deleteKey: key }, dispatchEvent: vi.fn() };
  const target = { closest: (selector: string) => selector === '[data-keyframe-delete]' ? { dataset: { keyframeDelete: key } } : null };
  const querySelector = vi.fn();
  const querySelectorAll = vi.fn(() => [button]);
  vi.stubGlobal('document', { activeElement: target, querySelector, querySelectorAll });
  expect(requestShortcutDeletion({ kind: 'bone', id: 'bone' })).toBe(true);
  expect(button.dispatchEvent).toHaveBeenCalledOnce();
  expect(button.dispatchEvent.mock.calls[0][0].type).toBe(DELETE_SHORTCUT_EVENT);
  querySelectorAll.mockReturnValue([]);
  expect(requestShortcutDeletion({ kind: 'bone', id: 'bone' })).toBe(false);
  expect(querySelector).not.toHaveBeenCalled();
  expect(keyframeDeletionKey({ type: 'ik.keyframe.remove', constraintId: 'ik', time: 1 })).toBe(JSON.stringify(['ik.keyframe.remove', 'ik', 1]));
  expect(keyframeDeletionKey({ ...command, animationId: 'animation:bone', boneId: 'other' }))
    .not.toBe(keyframeDeletionKey({ ...command, animationId: 'animation', boneId: 'bone:other' }));
});

it('tracks multiple pointer gestures and native drags until completion and cleans up listeners', () => {
  const document = new EventTarget(); const window = new EventTarget();
  vi.stubGlobal('document', document); vi.stubGlobal('window', window); vi.stubGlobal('Element', class Element {});
  const cleanup = installDeletionGuards();
  const pointer = (type: string, pointerId: number) => Object.assign(new Event(type), { pointerId });
  document.dispatchEvent(pointer('pointerdown', 1)); document.dispatchEvent(pointer('pointerdown', 2));
  expect(hasDeletionGesture()).toBe(true);
  document.dispatchEvent(pointer('pointerup', 1)); expect(hasDeletionGesture()).toBe(true);
  document.dispatchEvent(pointer('pointercancel', 2)); expect(hasDeletionGesture()).toBe(false);
  document.dispatchEvent(new Event('dragstart')); expect(hasDeletionGesture()).toBe(true);
  document.dispatchEvent(new Event('dragend')); expect(hasDeletionGesture()).toBe(false);
  document.dispatchEvent(pointer('pointerdown', 3)); window.dispatchEvent(new Event('blur'));
  expect(hasDeletionGesture()).toBe(false);
  cleanup(); document.dispatchEvent(pointer('pointerdown', 4)); expect(hasDeletionGesture()).toBe(false);
});

it('routes a focused delete button directly, without falling through to the inspector', () => {
  const button = { disabled: false, dispatchEvent: vi.fn() };
  const querySelector = vi.fn();
  vi.stubGlobal('document', { activeElement: { closest: () => button }, querySelector });
  expect(requestShortcutDeletion(null)).toBe(true);
  expect(button.dispatchEvent).toHaveBeenCalledOnce(); expect(querySelector).not.toHaveBeenCalled();
});

it('does not fall back to the inspector after a selected keyframe disappears', () => {
  class Target extends EventTarget { isConnected = true; }
  const document = Object.assign(new EventTarget(), { activeElement: null, querySelector: vi.fn(), querySelectorAll: vi.fn() });
  vi.stubGlobal('document', document); vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('Element', Target);
  const cleanup = installDeletionGuards();
  const keyframe = new Target();
  const event = Object.assign(new Event('pointerdown'), { pointerId: 1 });
  Object.defineProperty(event, 'target', { value: keyframe }); document.dispatchEvent(event);
  document.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1 }));
  keyframe.isConnected = false;
  expect(requestShortcutDeletion({ kind: 'bone', id: 'still-selected' })).toBe(false);
  expect(document.querySelector).not.toHaveBeenCalled(); expect(document.querySelectorAll).not.toHaveBeenCalled();
  cleanup();
});
