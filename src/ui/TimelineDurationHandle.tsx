import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { getEditorState, updateEditor, useEditor } from './store';
import { commitAnimationDuration, draggedDuration, MAX_TIMELINE_DURATION } from './timeline-duration';

interface DurationGesture { pointerId: number; startX: number; width: number; duration: number; fps: number; revision: number; documentId: string; animationId: string }

/** Drag the ruler endpoint to change overall speed; preview locally and commit one retiming on release. */
export function TimelineDurationHandle() {
  const state = useEditor(); const animation = state.project.animations.find(item => item.id === state.animationId);
  const gesture = useRef<DurationGesture | null>(null); const [preview, setPreview] = useState<number | null>(null);
  const handleStart = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !animation) return;
    event.preventDefault(); event.stopPropagation(); updateEditor({ isPlaying: false });
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, width: event.currentTarget.parentElement!.getBoundingClientRect().width,
      duration: animation.duration, fps: animation.fps, revision: state.revision, documentId: state.documentId, animationId: animation.id };
    event.currentTarget.setPointerCapture(event.pointerId); setPreview(animation.duration);
  };
  const valueAt = (event: PointerEvent<HTMLButtonElement>, source: DurationGesture) => draggedDuration({
    duration: source.duration, fps: source.fps, width: source.width, deltaX: event.clientX - source.startX });
  const handleMove = (event: PointerEvent<HTMLButtonElement>) => {
    const source = gesture.current; if (source?.pointerId === event.pointerId) setPreview(valueAt(event, source));
  };
  const handleEnd = (event: PointerEvent<HTMLButtonElement>) => {
    const source = gesture.current; if (!source || source.pointerId !== event.pointerId) return;
    gesture.current = null; setPreview(null);
    commitAnimationDuration(valueAt(event, source), { expectedRevision: source.revision, documentId: source.documentId, animationId: source.animationId });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  if (!animation) return null;
  return <button className={`timeline-duration-handle ${preview === null ? '' : 'dragging'}`} role="slider"
    aria-label="动作整体时长" aria-valuemin={1 / animation.fps} aria-valuemax={MAX_TIMELINE_DURATION} aria-valuenow={preview ?? animation.duration}
    aria-valuetext={`${(preview ?? animation.duration).toFixed(2)} 秒，全部关键帧按比例缩放`} title="左右拖动调整整体时长和速度；方向键调整一帧，Shift 调整十帧"
    onPointerDown={handleStart} onPointerMove={handleMove} onPointerUp={handleEnd}
    onPointerCancel={() => { gesture.current = null; setPreview(null); }} onLostPointerCapture={() => { gesture.current = null; setPreview(null); }}
    onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return;
      event.preventDefault(); event.stopPropagation(); const current = getEditorState().project.animations.find(item => item.id === getEditorState().animationId);
      if (current) commitAnimationDuration(draggedDuration({ duration: current.duration, deltaX: (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 10 : 1), width: current.duration * current.fps, fps: current.fps }));
    }}><GripVertical size={13} /><span>{(preview ?? animation.duration).toFixed(2)}s</span></button>;
}
