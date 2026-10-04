import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import type { FieldProps } from './controls';
import { canCoalesceScrub, isScrubInterrupted, scrubNumber } from './numeric-scrub';
import { getEditorState, undo, updateEditor } from './store';

interface ScrubDrag { lastX: number; raw: number; value: number; startRevision: number; lastRevision: number | null; isBlocked: boolean }

/** Provide pointer-captured scrubbing with one undo entry and safe interruption by external document edits. */
export function useNumberScrub(props: FieldProps) {
  const drag = useRef<ScrubDrag | null>(null);
  const handleStart = (event: PointerEvent<HTMLSpanElement>) => {
    if (props.disabled || event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    updateEditor({ isPlaying: false });
    drag.current = { lastX: event.clientX, raw: props.value, value: props.value, startRevision: getEditorState().revision, lastRevision: null, isBlocked: false };
  };
  const handleMove = (event: PointerEvent<HTMLSpanElement>) => {
    const current = drag.current; if (!current || current.isBlocked) return;
    const before = getEditorState();
    if (isScrubInterrupted(current.lastRevision ?? current.startRevision, before.revision)) {
      drag.current = null; updateEditor({ message: '文档已有其他改动，数值拖动已中断。请重新拖动。' }); return;
    }
    const next = scrubNumber({ raw: current.raw, deltaX: event.clientX - current.lastX, step: props.step,
      isFine: event.shiftKey, isInteger: props.isInteger, min: props.min, max: props.max });
    current.raw = next.raw; current.lastX = event.clientX; if (next.value === current.value) return;
    const coalesce = canCoalesceScrub(current.lastRevision, before.revision);
    props.onChange(next.value, { coalesce });
    const after = getEditorState(); current.value = next.value;
    if (after.revision === before.revision && after.messageVersion !== before.messageVersion) current.isBlocked = true;
    else if (after.revision > before.revision) current.lastRevision = after.revision;
  };
  const handleEnd = () => { drag.current = null; };
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      const current = drag.current; if (event.key !== 'Escape' || !current) return;
      event.preventDefault(); if (canCoalesceScrub(current.lastRevision, getEditorState().revision)) undo();
      drag.current = null;
    };
    document.addEventListener('keydown', handleEscape); return () => document.removeEventListener('keydown', handleEscape);
  }, []);
  return { handleStart, handleMove, handleEnd };
}
