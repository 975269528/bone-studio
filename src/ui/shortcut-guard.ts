interface ShortcutContext { hasDialog: boolean; hasEditableTarget: boolean }
type ModeKeyEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing' | 'repeat'>;

/** Reserve unmodified Space for editor playback, including repeats that must suppress native button clicks. */
export function isPlaybackShortcut(event: ModeKeyEvent & { code: string; shiftKey: boolean; keyCode?: number }, context: ShortcutContext & { hasMenu: boolean }): boolean {
  return event.code === 'Space' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
    && !event.isComposing && event.keyCode !== 229 && !context.hasDialog && !context.hasEditableTarget && !context.hasMenu;
}

/** Accept Del only in an idle editor context, without modifiers, composition or held-key repeats. */
export function isDeletionShortcut(event: ModeKeyEvent & { keyCode?: number; shiftKey?: boolean }, context: ShortcutContext & { hasMenu: boolean; hasGesture: boolean }): boolean {
  return event.key === 'Delete' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
    && !event.isComposing && event.keyCode !== 229 && !event.repeat && !context.hasDialog
    && !context.hasEditableTarget && !context.hasMenu && !context.hasGesture;
}

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
