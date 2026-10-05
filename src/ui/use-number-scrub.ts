import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import type { FieldProps } from './controls';
import { canCoalesceScrub, scrubNumber } from './numeric-scrub';
import { getEditorState, updateEditor } from './store';
import { advanceEditorGesture, cancelEditorGesture, captureEditorGesture, isEditorGestureCurrent } from './editor-gesture';
import type { EditorGesture } from './editor-gesture';

interface ScrubDrag { lastX: number; raw: number; value: number; lastRevision: number | null; isBlocked: boolean; gesture: EditorGesture }

function moveScrub(props: FieldProps, current: ScrubDrag, event: PointerEvent<HTMLSpanElement>): void {
  const before = getEditorState();
  const next = scrubNumber({ raw: current.raw, deltaX: event.clientX - current.lastX, step: props.step,
    isFine: event.shiftKey, isInteger: props.isInteger, min: props.min, max: props.max });
  current.raw = next.raw; current.lastX = event.clientX; if (next.value === current.value) return;
  const coalesce = canCoalesceScrub(current.lastRevision, before.revision);
  props.onChange(next.value, { coalesce });
  const after = getEditorState(); current.value = next.value;
  if (after.revision === before.revision && after.poseVersion === before.poseVersion && after.messageVersion !== before.messageVersion) current.isBlocked = true;
  else if (after.revision > before.revision) current.lastRevision = after.revision;
  advanceEditorGesture(current.gesture);
}

/** Provide pointer-captured scrubbing with one undo entry and safe interruption by external document edits. */
export function useNumberScrub(props: FieldProps) {
  const drag = useRef<ScrubDrag | null>(null);
  const handleStart = (event: PointerEvent<HTMLSpanElement>) => {
    if (props.disabled || event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    updateEditor({ isPlaying: false });
    drag.current = { lastX: event.clientX, raw: props.value, value: props.value, lastRevision: null, isBlocked: false, gesture: captureEditorGesture() };
  };
  const handleMove = (event: PointerEvent<HTMLSpanElement>) => {
    const current = drag.current; if (!current || current.isBlocked) return;
    if (!isEditorGestureCurrent(current.gesture)) {
      drag.current = null; updateEditor({ message: '文档已有其他改动，数值拖动已中断。请重新拖动。' }); return;
    }
    moveScrub(props, current, event);
  };
  const handleEnd = () => { drag.current = null; };
  const handleCancel = () => { if (drag.current) cancelEditorGesture(drag.current.gesture); drag.current = null; };
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      const current = drag.current; if (event.key !== 'Escape' || !current) return;
      event.preventDefault(); cancelEditorGesture(current.gesture);
      drag.current = null;
    };
    document.addEventListener('keydown', handleEscape); return () => document.removeEventListener('keydown', handleEscape);
  }, []);
  return { handleStart, handleMove, handleEnd, handleCancel };
}
