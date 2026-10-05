import { afterEach, expect, it, vi } from 'vitest';
import { isDeletionShortcut, isEditableShortcutTarget, isModeShortcut } from './shortcut-guard';

const modeKey = { key: 'q', ctrlKey: false, metaKey: false, altKey: false, isComposing: false, repeat: false };
const canvasContext = { hasDialog: false, hasEditableTarget: false };

afterEach(() => vi.unstubAllGlobals());

it('recognizes only Q as the unmodified mode cycle key', () => {
  expect(isModeShortcut(modeKey, canvasContext)).toBe(true);
  expect(isModeShortcut({ ...modeKey, key: 'Q' }, canvasContext)).toBe(true);
  expect(isModeShortcut({ ...modeKey, key: 'e' }, canvasContext)).toBe(false);
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'repeat', 'isComposing'] as const) {
    expect(isModeShortcut({ ...modeKey, [modifier]: true }, canvasContext)).toBe(false);
  }
});

it('leaves text editing and modal interactions alone', () => {
  expect(isModeShortcut(modeKey, { ...canvasContext, hasEditableTarget: true })).toBe(false);
  expect(isModeShortcut(modeKey, { ...canvasContext, hasDialog: true })).toBe(false);
});

it('recognizes native controls and nested editable descendants without blocking canvas targets', () => {
  class EditableTarget extends EventTarget {
    isContentEditable = false;
    constructor(private matchesControl: boolean) { super(); }
    closest(): EditableTarget | null { return this.matchesControl ? this : null; }
  }
  vi.stubGlobal('HTMLElement', EditableTarget);
  expect(isEditableShortcutTarget(new EditableTarget(true))).toBe(true);
  const nestedEditable = new EditableTarget(false); nestedEditable.isContentEditable = true;
  expect(isEditableShortcutTarget(nestedEditable)).toBe(true);
  expect(isEditableShortcutTarget(new EditableTarget(false))).toBe(false);
  expect(isEditableShortcutTarget(null)).toBe(false);
});

it('allows Del only once in an idle, unmodified editor context', () => {
  const event = { ...modeKey, key: 'Delete', shiftKey: false, keyCode: 46 };
  const context = { ...canvasContext, hasMenu: false, hasGesture: false };
  expect(isDeletionShortcut(event, context)).toBe(true);
  expect(isDeletionShortcut({ ...event, key: 'Backspace' }, context)).toBe(false);
  expect(isDeletionShortcut({ ...event, keyCode: 229 }, context)).toBe(false);
  for (const key of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'repeat', 'isComposing'] as const) {
    expect(isDeletionShortcut({ ...event, [key]: true }, context)).toBe(false);
  }
  for (const key of ['hasDialog', 'hasEditableTarget', 'hasMenu', 'hasGesture'] as const) {
    expect(isDeletionShortcut(event, { ...context, [key]: true })).toBe(false);
  }
});
