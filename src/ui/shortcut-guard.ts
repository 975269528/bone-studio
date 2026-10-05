interface ShortcutContext { hasDialog: boolean; hasEditableTarget: boolean }
type ModeKeyEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing' | 'repeat'>;

/** Check mode hotkeys without capturing typing, composition, dialogs or modified key presses. */
export function isModeShortcut(event: ModeKeyEvent, context: ShortcutContext): boolean {
  return event.key.toLowerCase() === 'q' && !event.ctrlKey && !event.metaKey && !event.altKey
    && !event.isComposing && !event.repeat && !context.hasDialog && !context.hasEditableTarget;
}

/** Detect editable controls, including descendants of a contenteditable region. */
export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
}
