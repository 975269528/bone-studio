import { getEditorState, redo, undo, updateEditor } from './store';
import { saveProject } from './project-actions';
import { recordKeyframe } from './Timeline';
import { cycleEditorMode } from './editor-modes';
import { isDeletionShortcut, isEditableShortcutTarget, isModeShortcut, isPlaybackShortcut } from './shortcut-guard';
import { hasDeletionGesture, requestShortcutDeletion } from './delete-shortcut';
import { deleteSelectedKeyframes, handleKeyframeClipboardShortcut } from './timeline-keyframes';

let hasPlaybackPress = false;

/** Cancel the Space release paired with playback so focused buttons cannot synthesize clicks. */
export function handleShortcutKeyUp(event: KeyboardEvent): void {
  if (event.code !== 'Space' || !hasPlaybackPress) return;
  event.preventDefault(); hasPlaybackPress = false;
}

/** Forget held playback keys when the editor loses focus. */
export function resetShortcutPresses(): void { hasPlaybackPress = false; }

function handlePlayback(event: KeyboardEvent, context: { hasDialog: boolean; hasEditableTarget: boolean; hasMenu: boolean }): boolean {
  if (!isPlaybackShortcut(event, context)) return false;
  event.preventDefault();
  if (event.repeat || hasPlaybackPress) return true;
  hasPlaybackPress = true;
  const state = getEditorState(); if (state.animationId) updateEditor({ isPlaying: !state.isPlaying });
  return true;
}

/** Apply keyboard shortcuts while leaving text inputs and native controls untouched. */
export function handleShortcut(event: KeyboardEvent): void {
  const context = { hasDialog: !!document.querySelector('[role="dialog"],dialog[open]'), hasEditableTarget: isEditableShortcutTarget(event.target), hasMenu: !!document.querySelector('[role="menu"],[role="listbox"]') };
  if (handlePlayback(event, context)) return;
  if (context.hasDialog || context.hasEditableTarget || context.hasMenu || event.isComposing || event.keyCode === 229 || event.altKey) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (handleKeyframeClipboardShortcut(event)) event.preventDefault();
  else if (isDeletionShortcut(event, { ...context, hasGesture: hasDeletionGesture() })) {
    if (deleteSelectedKeyframes() || requestShortcutDeletion(getEditorState().selection)) event.preventDefault();
  }
  else if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
  else if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
  else if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); void saveProject({ saveAs: event.shiftKey }); }
  else if (event.key.toLowerCase() === 'k' && !modifier && !event.shiftKey && !event.repeat) { event.preventDefault(); recordKeyframe(); }
  else if (isModeShortcut(event, context)) { event.preventDefault(); cycleEditorMode(); }
}
