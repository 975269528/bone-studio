import { useEffect, useRef } from 'react';
import type { PointerEvent, RefObject } from 'react';
import { Bone, Eye, Minus, Plus, Maximize, MousePointer2, Crosshair } from 'lucide-react';
import { renderProject } from '@/render';
import { applyCommands, getEditorState, reportError, updateEditor, useEditor } from './store';
import type { EditorState } from './store';
import { hitCanvasTarget, planCanvasDrag } from './canvas-edit';
import type { DragTarget, Point } from './canvas-edit';

interface Drag extends DragTarget { committed: boolean; isBlocked: boolean; start: Point }
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const DRAG_THRESHOLD = 3;

function pointerPosition(event: PointerEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * event.currentTarget.width / rect.width,
    y: (event.clientY - rect.top) * event.currentTarget.height / rect.height };
}

function useCanvasRender(canvas: RefObject<HTMLCanvasElement | null>, state: EditorState) {
  useEffect(() => {
    let isCurrent = true;
    const buffer = document.createElement('canvas');
    void renderProject({ canvas: buffer, project: state.project, animationId: state.animationId, time: state.time,
      overlays: { bones: state.showBones, ik: state.showBones, grid: false,
        selectedBoneId: state.selection?.kind === 'bone' ? state.selection.id : null,
        selectedAttachmentId: state.selection?.kind === 'attachment' ? state.selection.id : null,
        selectedIKId: state.selection?.kind === 'ik' ? state.selection.id : null } }).then(() => {
      if (isCurrent && canvas.current) { canvas.current.width = buffer.width; canvas.current.height = buffer.height; canvas.current.getContext('2d')?.drawImage(buffer, 0, 0); }
    }).catch(reportError);
    return () => { isCurrent = false; };
  }, [canvas, state.project, state.animationId, state.time, state.showBones, state.selection]);
}

function moveDrag(drag: Drag | null, point: Point): void {
  if (!drag || drag.isBlocked || (!drag.committed && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < DRAG_THRESHOLD)) return;
  const result = planCanvasDrag({ context: getEditorState(), drag, point });
  if ('message' in result) { drag.isBlocked = true; updateEditor({ message: result.message }); return; }
  try { applyCommands([result.command], { coalesce: drag.committed }); drag.committed = true; }
  catch (error) { drag.isBlocked = true; reportError(error); }
}

/** Render the live pose and provide draggable bone joints and two-bone IK targets. */
export function Canvas() {
  const state = useEditor();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  useCanvasRender(canvas, state);
  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!state.showBones) return;
    const point = pointerPosition(event); const target = hitCanvasTarget(getEditorState(), point);
    drag.current = target ? { ...target, committed: false, isBlocked: false, start: point } : null;
    updateEditor({ isPlaying: false, selection: target ? { kind: target.kind === 'ik' ? 'ik' : 'bone', id: target.id } : null });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => moveDrag(drag.current, pointerPosition(event));
  return <main className="viewport"><CanvasToolbar /><div className="canvas-area"><div className="canvas-meta">{state.project.width} × {state.project.height}<span>透明画布</span></div>
    <div className="canvas-paper checker" style={{ width: state.project.width * state.zoom, height: state.project.height * state.zoom }}>
      <canvas ref={canvas} aria-label="角色动画画布" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
    </div><div className="canvas-caption"><Crosshair size={12} />{state.animationId ? '拖动关节或 IK 目标 · 自动记录当前帧' : '基础姿态 · 拖动关节或尖端调整骨骼'}</div>
  </div></main>;
}

function CanvasToolbar() {
  const state = useEditor();
  const handleZoom = (delta: number) => updateEditor({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom + delta)) });
  return <div className="canvas-toolbar"><div className="toolbar-group"><span className="tool active"><MousePointer2 size={15} />选择 / 移动</span>
    <button className={state.showBones ? 'tool active-subtle' : 'tool'} onClick={() => updateEditor({ showBones: !state.showBones })}><Bone size={15} />{state.showBones ? '骨骼可见' : '纯画面'}</button>
    <select aria-label="编辑模式" value={state.animationId ?? ''} onChange={event => updateEditor({ animationId: event.target.value || null, time: 0, isPlaying: false })}><option value="">基础姿态</option>{state.project.animations.map(animation => <option key={animation.id} value={animation.id}>{animation.name}</option>)}</select>
  </div><div className="toolbar-group"><Eye size={14} /><button className="icon-button" aria-label="缩小画布" onClick={() => handleZoom(-0.1)}><Minus size={14} /></button><span className="zoom-text">{Math.round(state.zoom * 100)}%</span>
    <button className="icon-button" aria-label="放大画布" onClick={() => handleZoom(0.1)}><Plus size={14} /></button><button className="icon-button" aria-label="适应窗口" onClick={() => {
      const rect = document.querySelector('.canvas-area')?.getBoundingClientRect(); if (rect) updateEditor({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, (rect.width - 90) / state.project.width, (rect.height - 100) / state.project.height)) });
    }}><Maximize size={14} /></button></div></div>;
}
