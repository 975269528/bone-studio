import type { KeyboardEvent, PointerEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { seekTimeline } from './timeline-layout';
import { updateEditor } from './store';
import { TimelineDurationHandle } from './TimelineDurationHandle';

interface RulerProps { duration: number; fps: number; time: number }

/** A fixed, frame-snapped time ruler with pointer dragging and keyboard access to both endpoints. */
export function TimelineRuler(props: RulerProps) {
  const ticks = Array.from({ length: 9 }, (_, index) => props.duration * index / 8);
  const handleSeek = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    updateEditor({ time: seekTimeline({ ratio: (event.clientX - bounds.left) / bounds.width, duration: props.duration, fps: props.fps }), isPlaying: false });
  };
  const handleStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); handleSeek(event);
  };
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -1 / props.fps, ArrowRight: 1 / props.fps };
    if (!(event.key in steps) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault(); updateEditor({ time: event.key === 'Home' ? 0 : event.key === 'End' ? props.duration : Math.max(0, Math.min(props.duration, props.time + steps[event.key])), isPlaying: false });
  };
  return <div className="ruler"><span className="ruler-label">骨骼轨道 <ChevronDown size={12} /></span>
    <div className="ruler-surface"><div className="ruler-scale" role="slider" tabIndex={0} aria-label="时间刻度定位" aria-valuemin={0} aria-valuemax={props.duration}
      aria-valuenow={props.time} aria-valuetext={`${props.time.toFixed(2)} 秒`} onPointerDown={handleStart}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) handleSeek(event); }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onKeyDown={handleKey}>
      {ticks.map(time => <span key={time} style={{ left: `${time / props.duration * 100}%` }}>{time.toFixed(2)}</span>)}
      <i className="ruler-marker" style={{ left: `${props.time / props.duration * 100}%` }} />
    </div><TimelineDurationHandle /></div></div>;
}
