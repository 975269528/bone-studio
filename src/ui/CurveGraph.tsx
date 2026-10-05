import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { BezierCurve, Interpolation } from '@/core/types';
import { sampleEasing } from '@/core/curves';
import { getEditorState, updateEditor } from './store';
import type { CommitOptions } from './store';
import { canCoalesceScrub, isScrubInterrupted } from './numeric-scrub';

interface CurveGraphProps {
  curve: BezierCurve;
  interpolation: Interpolation;
  onChange?: (curve: BezierCurve, options?: CommitOptions) => void;
}

interface CurveDrag {
  pointerId: number;
  point: 1 | 2;
  startRevision: number;
  lastRevision: number | null;
  target: SVGCircleElement;
}

const PLOT = { left: 44, top: 20, width: 240, height: 160, bottom: 180, samples: 80 };
const HANDLE_KEYBOARD_STEP = 0.01;

function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }

function curvePath(props: CurveGraphProps): string {
  if (props.interpolation === 'step-start') return `M${PLOT.left},${PLOT.bottom}V${PLOT.top}H${PLOT.left + PLOT.width}`;
  return Array.from({ length: PLOT.samples + 1 }, (_, index) => {
    const progress = index / PLOT.samples;
    const eased = sampleEasing({ progress, interpolation: props.interpolation, curve: props.curve });
    const point = `${PLOT.left + progress * PLOT.width},${PLOT.bottom - eased * PLOT.height}`;
    if (props.interpolation === 'step' && index === PLOT.samples) return `L${PLOT.left + PLOT.width},${PLOT.bottom} L${point}`;
    return `${index === 0 ? 'M' : 'L'}${point}`;
  }).join(' ');
}

function changedPoint(options: { curve: BezierCurve; point: 1 | 2; x: number; y: number }): BezierCurve {
  const { curve, point, x, y } = options;
  return point === 1 ? { ...curve, x1: clamp(x), y1: clamp(y) } : { ...curve, x2: clamp(x), y2: clamp(y) };
}

function useCurveDrag(props: CurveGraphProps) {
  const drag = useRef<CurveDrag | null>(null);
  const handleStart = (event: PointerEvent<SVGCircleElement>, point: 1 | 2) => {
    if (!props.onChange || event.button !== 0) return;
    event.preventDefault(); event.currentTarget.focus(); updateEditor({ isPlaying: false });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { point, pointerId: event.pointerId, startRevision: getEditorState().revision, lastRevision: null, target: event.currentTarget };
  };
  const handleMove = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    const transform = event.currentTarget.getScreenCTM();
    if (!current || current.pointerId !== event.pointerId || !transform) return;
    const before = getEditorState();
    if (isScrubInterrupted(current.lastRevision ?? current.startRevision, before.revision)) {
      drag.current = null;
      current.target.releasePointerCapture(current.pointerId);
      updateEditor({ message: '文档已有其他改动，曲线拖动已中断。请重新拖动。' }); return;
    }
    const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
    const curve = changedPoint({ curve: props.curve, point: current.point,
      x: (position.x - PLOT.left) / PLOT.width, y: (PLOT.bottom - position.y) / PLOT.height });
    if (Object.keys(curve).every(key => curve[key as keyof BezierCurve] === props.curve[key as keyof BezierCurve])) return;
    props.onChange?.(curve, { coalesce: canCoalesceScrub(current.lastRevision, before.revision) });
    const after = getEditorState();
    if (after.revision > before.revision) current.lastRevision = after.revision;
  };
  const handleEnd = (event: PointerEvent<SVGSVGElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (current.target.hasPointerCapture(event.pointerId)) current.target.releasePointerCapture(event.pointerId);
  };
  return { handleStart, handleMove, handleEnd };
}

function handlePointKey(options: { event: KeyboardEvent<SVGCircleElement>; point: 1 | 2; props: CurveGraphProps }): void {
  const { event, point, props } = options;
  const directions: Record<string, { x: number; y: number }> = {
    ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: 1 }, ArrowDown: { x: 0, y: -1 },
  };
  const direction = directions[event.key];
  if (!direction || !props.onChange) return;
  event.preventDefault();
  const step = HANDLE_KEYBOARD_STEP * (event.shiftKey ? 10 : 1);
  props.onChange(changedPoint({ curve: props.curve, point,
    x: (point === 1 ? props.curve.x1 : props.curve.x2) + direction.x * step,
    y: (point === 1 ? props.curve.y1 : props.curve.y2) + direction.y * step }));
}

/** 显示真实采样缓动曲线；可编辑图支持响应缩放的指针拖动及键盘控制点调整。 */
export function CurveGraph(props: CurveGraphProps) {
  const drag = useCurveDrag(props);
  const isEditable = !!props.onChange && props.interpolation === 'bezier';
  return <svg className={`curve-graph ${isEditable ? 'is-editable' : ''}`} viewBox="0 0 320 220" role={isEditable ? 'group' : 'img'}
    aria-label={isEditable ? '贝塞尔缓动曲线，拖动控制点或使用方向键调整' : '当前动画段缓动预览'}
    onPointerMove={drag.handleMove} onPointerUp={drag.handleEnd} onPointerCancel={drag.handleEnd} onLostPointerCapture={drag.handleEnd}>
    <rect className="curve-plot" x={PLOT.left} y={PLOT.top} width={PLOT.width} height={PLOT.height} />
    {[0.25, 0.5, 0.75].map(value => <path className="curve-grid" key={value}
      d={`M${PLOT.left + value * PLOT.width},${PLOT.top}V${PLOT.bottom} M${PLOT.left},${PLOT.bottom - value * PLOT.height}H${PLOT.left + PLOT.width}`} />)}
    <path className="curve-diagonal" d={`M${PLOT.left},${PLOT.bottom}L${PLOT.left + PLOT.width},${PLOT.top}`} />
    <path className="curve-line" d={curvePath(props)} />
    {isEditable && ([1, 2] as const).map(point => <g key={point}>
      <line className="curve-handle-line" x1={point === 1 ? PLOT.left : PLOT.left + PLOT.width} y1={point === 1 ? PLOT.bottom : PLOT.top}
        x2={PLOT.left + (point === 1 ? props.curve.x1 : props.curve.x2) * PLOT.width} y2={PLOT.bottom - (point === 1 ? props.curve.y1 : props.curve.y2) * PLOT.height} />
      <circle className={`curve-handle curve-handle-${point}`} r={7} tabIndex={0} role="slider" aria-label={`贝塞尔控制点 ${point}`}
        aria-valuemin={0} aria-valuemax={1} aria-valuenow={point === 1 ? props.curve.x1 : props.curve.x2}
        aria-valuetext={`X ${(point === 1 ? props.curve.x1 : props.curve.x2).toFixed(3)}，Y ${(point === 1 ? props.curve.y1 : props.curve.y2).toFixed(3)}`}
        cx={PLOT.left + (point === 1 ? props.curve.x1 : props.curve.x2) * PLOT.width} cy={PLOT.bottom - (point === 1 ? props.curve.y1 : props.curve.y2) * PLOT.height}
        onPointerDown={event => drag.handleStart(event, point)} onKeyDown={event => handlePointKey({ event, point, props })} />
    </g>)}
    <text x={PLOT.left} y={PLOT.bottom + 17}>0</text><text x={PLOT.left + PLOT.width - 5} y={PLOT.bottom + 17}>1</text>
    <text x={PLOT.left - 19} y={PLOT.bottom + 3}>0</text><text x={PLOT.left - 19} y={PLOT.top + 3}>1</text>
    <text x={145} y={214}>时间进度</text><text transform="translate(13 130) rotate(-90)">变化进度</text>
  </svg>;
}
