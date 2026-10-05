import { useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { timelineHeight, TIMELINE_LAYOUT } from './timeline-layout';

function clampHeight(requested: number): number {
  const shell = document.querySelector('.app-shell')?.clientHeight ?? window.innerHeight;
  const chrome = (document.querySelector('.app-header')?.clientHeight ?? 72) + (document.querySelector('.status-bar')?.clientHeight ?? 26);
  return timelineHeight({ requested, shell, chrome });
}

/** Resize the timeline using pointer capture or arrow keys, preserving a minimum canvas workspace. */
export function TimelineResize(props: { height: number; onResize: (height: number) => void }) {
  const drag = useRef<{ y: number; height: number; source: HTMLElement; pointerId: number } | null>(null);
  const currentHeight = useRef(props.height); currentHeight.current = props.height;
  const handleEnd = () => {
    const current = drag.current; drag.current = null;
    if (current?.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId);
  };
  useEffect(() => {
    const handleResize = () => props.onResize(clampHeight(currentHeight.current));
    handleResize();
    window.addEventListener('resize', handleResize); window.addEventListener('blur', handleEnd);
    return () => { window.removeEventListener('resize', handleResize); window.removeEventListener('blur', handleEnd); handleEnd(); };
  }, [props.onResize]);
  const handleStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, height: props.height, source: event.currentTarget, pointerId: event.pointerId };
  };
  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) props.onResize(clampHeight(drag.current.height + drag.current.y - event.clientY));
  };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowUp: TIMELINE_LAYOUT.resizeStep, ArrowDown: -TIMELINE_LAYOUT.resizeStep };
    if (!(event.key in steps) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault(); props.onResize(clampHeight(event.key === 'Home' ? TIMELINE_LAYOUT.minimum : event.key === 'End' ? window.innerHeight : props.height + steps[event.key]));
  };
  return <div className="timeline-resize" role="separator" aria-label="调整时间轴高度" aria-orientation="horizontal" aria-valuenow={props.height}
    aria-valuemin={TIMELINE_LAYOUT.minimum} tabIndex={0} title="上下拖动调整时间轴高度，也可使用上下方向键"
    onPointerDown={handleStart} onPointerMove={handleMove} onPointerUp={handleEnd} onPointerCancel={handleEnd} onKeyDown={handleKey}><i /></div>;
}
