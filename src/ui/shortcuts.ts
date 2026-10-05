import { getEditorState, redo, undo, updateEditor } from './store';
import { saveProject } from './project-actions';
import { recordKeyframe } from './Timeline';
import { cycleEditorMode } from './editor-modes';
import { isEditableShortcutTarget, isModeShortcut } from './shortcut-guard';

/** Apply keyboard shortcuts while leaving text inputs and native controls untouched. */
export function handleShortcut(event: KeyboardEvent): void {
  const context = { hasDialog: !!document.querySelector('[role="dialog"],dialog[open]'), hasEditableTarget: isEditableShortcutTarget(event.target) };
  if (context.hasDialog || context.hasEditableTarget || event.isComposing || event.altKey) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
  else if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
  else if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); void saveProject({ saveAs: event.shiftKey }); }
  else if (event.key.toLowerCase() === 'k' && !modifier) { event.preventDefault(); recordKeyframe(); }
  else if (isModeShortcut(event, context)) { event.preventDefault(); cycleEditorMode(); }
  else if (event.code === 'Space' && !document.querySelector('[role="dialog"]')) {
    event.preventDefault(); const state = getEditorState(); if (state.animationId) updateEditor({ isPlaying: !state.isPlaying });
  }
}
