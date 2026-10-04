import { getEditorState, redo, undo, updateEditor } from './store';
import { saveProject } from './project-actions';
import { recordKeyframe } from './Timeline';

/** Apply keyboard shortcuts while leaving text inputs and native controls untouched. */
export function handleShortcut(event: KeyboardEvent): void {
  if (document.querySelector('[role="dialog"]')) return;
  if (event.target instanceof HTMLElement && (event.target.matches('input,textarea,select') || event.target.isContentEditable)) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
  else if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
  else if (modifier && event.key.toLowerCase() === 's') { event.preventDefault(); void saveProject(); }
  else if (event.key.toLowerCase() === 'k' && !modifier) { event.preventDefault(); recordKeyframe(); }
  else if (event.code === 'Space' && !document.querySelector('[role="dialog"]')) {
    event.preventDefault(); const state = getEditorState(); if (state.animationId) updateEditor({ isPlaying: !state.isPlaying });
  }
}
