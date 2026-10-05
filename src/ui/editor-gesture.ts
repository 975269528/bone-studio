import { getEditorState, undo, updateEditor } from './store';
import type { EditorState } from './store';
import type { PoseDraft } from './pose-preview';

export interface EditorGesture {
  documentId: string; animationId: string | null; time: number; isAutoKeyframe: boolean;
  startAnimationId: string | null; startTime: number;
  startRevision: number; revision: number; poseVersion: number; poseDraft: PoseDraft | null;
}

/** Capture the document and draft baseline so cancellation restores only this gesture's edits. */
export function captureEditorGesture(state: EditorState = getEditorState()): EditorGesture {
  return { documentId: state.documentId, animationId: state.animationId, time: state.time, isAutoKeyframe: state.isAutoKeyframe,
    startAnimationId: state.animationId, startTime: state.time,
    startRevision: state.revision, revision: state.revision, poseVersion: state.poseVersion, poseDraft: state.poseDraft };
}

/** Guard gestures against unrelated document, playhead, policy or pending-pose changes. */
export function isEditorGestureCurrent(gesture: EditorGesture): boolean {
  const state = getEditorState();
  return state.documentId === gesture.documentId && state.animationId === gesture.animationId && state.time === gesture.time
    && state.isAutoKeyframe === gesture.isAutoKeyframe && state.revision === gesture.revision && state.poseVersion === gesture.poseVersion;
}

/** Advance the guard after an edit made by this gesture, preserving its initial undo baseline. */
export function advanceEditorGesture(gesture: EditorGesture): void {
  const state = getEditorState(); gesture.revision = state.revision; gesture.poseVersion = state.poseVersion;
  gesture.animationId = state.animationId; gesture.time = state.time;
}

/** Restore the initial draft, or undo one coalesced document gesture, if no external edit intervened. */
export function cancelEditorGesture(gesture: EditorGesture): void {
  if (!isEditorGestureCurrent(gesture)) return;
  if (gesture.revision > gesture.startRevision) {
    undo();
    updateEditor({ animationId: gesture.startAnimationId, time: gesture.startTime });
    if (gesture.poseDraft) updateEditor({ poseDraft: gesture.poseDraft, message: '本次调整已取消，待录姿态已恢复。' });
  }
  else if (getEditorState().poseDraft !== gesture.poseDraft) updateEditor({ poseDraft: gesture.poseDraft, message: '本次姿态调整已取消。' });
}
