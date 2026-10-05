import { useEffect, useSyncExternalStore } from 'react';
import { applyCommands, getEditorState, reportError, updateEditor, useEditor } from './store';
import { createKeyframeClipboard, keyframeIdentity, planKeyframePaste, readKeyframe, removeKeyframeCommand, reverseKeyframeClipboard } from './keyframe-clipboard';
import type { KeyframeClipboard, KeyframeRef } from './keyframe-clipboard';

let selected: KeyframeRef[] = [];
let clipboard: KeyframeClipboard | null = null;
let anchor: KeyframeRef | null = null;
let hasKeyframeScope = false;
let documentId = ''; let animationId: string | null = null; let target = '';
const listeners = new Set<() => void>();
let version = 0;
function notify(): void { version += 1; listeners.forEach(listener => listener()); }
function selectionTarget(): string { const selection = getEditorState().selection; return selection ? `${selection.kind}:${selection.id}` : ''; }
function rememberContext(): void {
  const state = getEditorState(); documentId = state.documentId; animationId = state.animationId; target = selectionTarget();
}

/** Clear timeline selection on document/action/object switches and discard deleted key references. */
export function reconcileKeyframeSelection(): void {
  const state = getEditorState();
  const changed = state.documentId !== documentId || state.animationId !== animationId || selectionTarget() !== target;
  const next = changed ? [] : selected.filter(ref => readKeyframe(state, ref));
  if (changed) { anchor = null; hasKeyframeScope = false; }
  rememberContext();
  if (next.length !== selected.length) { selected = next; notify(); }
}

/** Read the current exact selection, pruning references changed by external edits or undo. */
export function getSelectedKeyframes(): KeyframeRef[] { reconcileKeyframeSelection(); return selected; }

/** Clear the timeline key selection while preserving the reusable internal clipboard. */
export function clearKeyframeSelection(): void {
  selected = []; anchor = null; hasKeyframeScope = false; rememberContext(); notify();
}

function rangeSelection(ref: KeyframeRef, tracks: KeyframeRef[]): KeyframeRef[] {
  if (!anchor || anchor.kind !== ref.kind || anchor.id !== ref.id) { anchor = ref; return [ref]; }
  const min = Math.min(anchor.time, ref.time); const max = Math.max(anchor.time, ref.time);
  return tracks.filter(key => key.kind === ref.kind && key.id === ref.id && key.time >= min && key.time <= max);
}

/** Select a key; Ctrl/Cmd toggles individual keys and Shift spans keys on the anchor track. */
export function selectKeyframe(options: { ref: KeyframeRef; trackKeys: KeyframeRef[]; additive: boolean; range: boolean }): void {
  reconcileKeyframeSelection();
  const refs = options.range ? rangeSelection(options.ref, options.trackKeys) : [options.ref];
  if (options.additive) {
    const identities = new Set(refs.map(keyframeIdentity));
    const allSelected = refs.every(ref => selected.some(key => keyframeIdentity(key) === keyframeIdentity(ref)));
    selected = allSelected && !options.range ? selected.filter(key => !identities.has(keyframeIdentity(key)))
      : [...selected.filter(key => !identities.has(keyframeIdentity(key))), ...refs];
  } else selected = refs;
  if (!options.range) anchor = options.ref;
  hasKeyframeScope = true;
  updateEditor({ time: options.ref.time, isPlaying: false, selection: { kind: options.ref.kind, id: options.ref.id } });
  rememberContext(); notify();
}

/** Copy all selected keys to an internal, deeply cloned multi-track clipboard. */
export function copySelectedKeyframes(): boolean {
  try { clipboard = createKeyframeClipboard(getEditorState(), getSelectedKeyframes()); notify();
    updateEditor({ message: `已复制 ${clipboard.count} 个关键帧，可移动播放头后粘贴。` }); return true; }
  catch (error) { reportError(error); return false; }
}

function pasteClipboard(isReversed: boolean): boolean {
  if (!clipboard) { updateEditor({ message: '关键帧剪贴板为空，请先选择并复制关键帧。' }); return false; }
  try {
    const snapshot = isReversed ? reverseKeyframeClipboard(clipboard) : clipboard;
    const plan = planKeyframePaste(getEditorState(), snapshot); applyCommands(plan.commands);
    selected = plan.refs; anchor = plan.refs[0] ?? null; hasKeyframeScope = true; rememberContext(); notify();
    updateEditor({ message: `已${isReversed ? '倒序' : ''}粘贴 ${clipboard.count} 个关键帧。` }); return true;
  } catch (error) { reportError(error); return false; }
}

/** Paste at the playhead in a single undo transaction, replacing matching times deliberately. */
export function pasteKeyframes(): boolean { return pasteClipboard(false); }

/** Paste keys in reverse temporal order, reflecting easing without changing the original clipboard. */
export function pasteReversedKeyframes(): boolean { return pasteClipboard(true); }

/** Delete selected live keys atomically; true means the shortcut must not delete an object. */
export function deleteSelectedKeyframes(): boolean {
  const refs = getSelectedKeyframes(); if (!refs.length) return hasKeyframeScope;
  try { applyCommands(refs.map(ref => removeKeyframeCommand(getEditorState(), ref))); selected = []; anchor = null; rememberContext(); notify(); }
  catch (error) { reportError(error); }
  return true;
}

/** Handle Ctrl/Cmd+C/V in an idle editor context without accessing the native clipboard. */
export function handleKeyframeClipboardShortcut(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.repeat || event.isComposing) return false;
  const key = event.key.toLowerCase();
  if (key === 'c' && getSelectedKeyframes().length) { copySelectedKeyframes(); return true; }
  if (key === 'v' && clipboard) { pasteKeyframes(); return true; }
  return false;
}

/** Subscribe timeline controls to selection/clipboard and reconcile external editor changes. */
export function useTimelineKeyframes(): { selected: KeyframeRef[]; clipboardCount: number } {
  const state = useEditor();
  useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => version);
  useEffect(reconcileKeyframeSelection, [state.documentId, state.animationId, state.selection, state.project]);
  return { selected, clipboardCount: clipboard?.count ?? 0 };
}
