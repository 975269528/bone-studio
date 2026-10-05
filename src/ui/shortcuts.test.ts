import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDemoProject } from '@/core/api';
import { handleShortcut, handleShortcutKeyUp, resetShortcutPresses } from './shortcuts';
import { getEditorState, replaceProject, updateEditor } from './store';

class ShortcutTarget extends EventTarget {
  isContentEditable = false;
  constructor(private editable = false) { super(); }
  closest(): ShortcutTarget | null { return this.editable ? this : null; }
}
let hasMenu = false; let hasDialog = false;
function keyEvent(changes?: Partial<KeyboardEvent>): KeyboardEvent {
  return { key: ' ', code: 'Space', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
    isComposing: false, repeat: false, keyCode: 32, target: new ShortcutTarget(), preventDefault: vi.fn(),
    ...changes } as unknown as KeyboardEvent;
}
beforeEach(() => {
  replaceProject(createDemoProject()); resetShortcutPresses(); hasMenu = false; hasDialog = false;
  vi.stubGlobal('HTMLElement', ShortcutTarget);
  vi.stubGlobal('document', { querySelector: (selector: string) => selector.includes('dialog') ? hasDialog : hasMenu });
});
afterEach(() => vi.unstubAllGlobals());

it('toggles Space only once and cancels both button keydown and keyup defaults', () => {
  const press = keyEvent(); handleShortcut(press); expect(getEditorState().isPlaying).toBe(true);
  expect(press.preventDefault).toHaveBeenCalledOnce();
  const repeat = keyEvent({ repeat: true }); handleShortcut(repeat);
  expect(getEditorState().isPlaying).toBe(true); expect(repeat.preventDefault).toHaveBeenCalledOnce();
  const release = keyEvent(); handleShortcutKeyUp(release); expect(release.preventDefault).toHaveBeenCalledOnce();
  const secondPress = keyEvent(); handleShortcut(secondPress); expect(getEditorState().isPlaying).toBe(false);
  handleShortcutKeyUp(keyEvent());
});

it('leaves native text controls, IME, menus, dialogs and modified Space presses untouched', () => {
  for (const changes of [{ target: new ShortcutTarget(true) }, { isComposing: true }, { keyCode: 229 },
    { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
    const event = keyEvent(changes); handleShortcut(event);
    expect(getEditorState().isPlaying).toBe(false); expect(event.preventDefault).not.toHaveBeenCalled();
  }
  hasMenu = true; const menuEvent = keyEvent(); handleShortcut(menuEvent); expect(menuEvent.preventDefault).not.toHaveBeenCalled();
  hasMenu = false; hasDialog = true; const dialogEvent = keyEvent(); handleShortcut(dialogEvent); expect(dialogEvent.preventDefault).not.toHaveBeenCalled();
});

it('resets held keys on blur and safely suppresses button Space when no action exists', () => {
  handleShortcut(keyEvent()); resetShortcutPresses();
  handleShortcut(keyEvent()); expect(getEditorState().isPlaying).toBe(false);
  resetShortcutPresses(); updateEditor({ animationId: null });
  const event = keyEvent(); handleShortcut(event); expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(getEditorState().isPlaying).toBe(false);
  const release = keyEvent(); handleShortcutKeyUp(release); expect(release.preventDefault).toHaveBeenCalledOnce();
});

it('records K once outside text controls and never records in setup mode or while composing', () => {
  updateEditor({ selection: { kind: 'bone', id: getEditorState().project.bones[0].id } });
  for (const changes of [{ target: new ShortcutTarget(true) }, { isComposing: true }, { keyCode: 229 }, { repeat: true }, { ctrlKey: true }]) {
    handleShortcut(keyEvent({ key: 'k', code: 'KeyK', ...changes }));
    expect(getEditorState().past).toHaveLength(0);
  }
  handleShortcut(keyEvent({ key: 'k', code: 'KeyK' })); expect(getEditorState().past).toHaveLength(1);
  const recorded = getEditorState().project; updateEditor({ animationId: null, tool: 'rig' });
  handleShortcut(keyEvent({ key: 'k', code: 'KeyK' })); expect(getEditorState().project).toBe(recorded);
});
