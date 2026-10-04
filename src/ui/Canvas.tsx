import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import { Bone, Minus, Plus, Maximize, Crosshair } from 'lucide-react';
import { renderProject } from '@/render';
import { samplePose } from '@/core/api';
import { applyCommands, getEditorState, reportError, updateEditor, useEditor } from './store';
import type { EditorState, CanvasTool } from './store';
import { hitCanvasTarget, planCanvasDrag } from './canvas-edit';
import type { DragTarget, Point } from './canvas-edit';
import { drawnBone } from './draw-bone';
import { attachmentWorld } from './attachment-edit';

interface Drag extends DragTarget { committed: boolean; isBlocked: boolean; start: Point }
interface Drawing { start: Point; end: Point; parentId: string | null }
interface Panning { start: Point; original: Point }
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const DRAG_THRESHOLD = 3;
const TOOLS: { value: CanvasTool; label: string }[] = [
  { value: 'select', label: '选择 / 移动' }, { value: 'draw', label: '绘制骨骼' },
  { value: 'rotate', label: '旋转图片' }, { value: 'scale', label: '缩放图片' },
  { value: 'length', label: '骨骼长度' }, { value: 'pan', label: '平移视图' },
];

function pointerPosition(event: PointerEvent<HTMLCanvasElement>): Point {
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

function useObjectGesture() {
  const drag = useRef<Drag | null>(null); const [drawing, setDrawing] = useState<Drawing | null>(null);
  const drawingRef = useRef<Drawing | null>(null); const [hasFixedParent, setHasFixedParent] = useState(true);
  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const state = getEditorState(); if (event.button !== 0 || state.tool === 'pan') return;
    const point = pointerPosition(event); updateEditor({ isPlaying: false });
    if (state.tool === 'draw') {
      const preview = { start: point, end: point, parentId: state.selection?.kind === 'bone' ? state.selection.id : null };
      drawingRef.current = preview; setDrawing(preview);
    } else {
      const target = hitCanvasTarget(state, point, state.tool);
      drag.current = target ? { ...target, committed: false, isBlocked: false, start: point } : null;
      updateEditor({ selection: target ? { kind: target.kind === 'attachment' ? 'attachment' : target.kind === 'ik' ? 'ik' : 'bone', id: target.id } : null });
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointerPosition(event);
    if (drawingRef.current) { drawingRef.current = { ...drawingRef.current, end: point }; setDrawing(drawingRef.current); }
    else moveDrag(drag.current, point);
  };
  const handlePointerUp = () => {
    const preview = drawingRef.current; drag.current = null; drawingRef.current = null; setDrawing(null);
    if (!preview || Math.hypot(preview.end.x - preview.start.x, preview.end.y - preview.start.y) < DRAG_THRESHOLD) return;
    const bone = drawnBone({ context: getEditorState(), ...preview });
    try { applyCommands([{ type: 'bone.add', bone }]); if (!hasFixedParent) updateEditor({ selection: { kind: 'bone', id: bone.id } }); }
    catch (error) { reportError(error); }
  };
  const handleCancel = () => { drag.current = null; drawingRef.current = null; setDrawing(null); };
  useEffect(() => { const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') handleCancel(); };
    document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener); }, []);
  return { drawing, hasFixedParent, setHasFixedParent, handlePointerDown, handlePointerMove, handlePointerUp, handleCancel };
}

function useViewGesture(area: RefObject<HTMLDivElement | null>) {
  const pan = useRef<Panning | null>(null);
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const state = getEditorState(); if (event.button !== 1 && !(event.button === 0 && state.tool === 'pan')) return;
    event.preventDefault(); pan.current = { start: { x: event.clientX, y: event.clientY }, original: state.pan };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.current) updateEditor({ pan: { x: pan.current.original.x + event.clientX - pan.current.start.x,
      y: pan.current.original.y + event.clientY - pan.current.start.y } });
  };
  useEffect(() => {
    const element = area.current; if (!element) return;
    const listener = (event: WheelEvent) => {
      event.preventDefault(); const state = getEditorState(); const rect = element.getBoundingClientRect();
      const zoom = clampZoom(state.zoom * Math.exp(-event.deltaY * 0.001)); const ratio = zoom / state.zoom;
      const x = event.clientX - rect.left - rect.width / 2; const y = event.clientY - rect.top - rect.height / 2;
      updateEditor({ zoom, pan: { x: x - (x - state.pan.x) * ratio, y: y - (y - state.pan.y) * ratio } });
    };
    element.addEventListener('wheel', listener, { passive: false });
    return () => element.removeEventListener('wheel', listener);
  }, [area]);
  return { handlePointerDown, handlePointerMove, handlePointerUp: () => { pan.current = null; } };
}

/** Render the current pose with direct drawing, object transforms and an independent pan/zoom viewport. */
export function Canvas() {
  const state = useEditor(); const canvas = useRef<HTMLCanvasElement>(null); const area = useRef<HTMLDivElement>(null);
  const gesture = useObjectGesture(); const view = useViewGesture(area); useCanvasRender(canvas, state);
  return <main className="viewport"><CanvasToolbar /><div ref={area} className={`canvas-area tool-${state.tool}`} onPointerDown={view.handlePointerDown}
    onPointerMove={view.handlePointerMove} onPointerUp={view.handlePointerUp} onPointerCancel={view.handlePointerUp}>
    <div className="canvas-meta">{state.project.width} × {state.project.height}<span>透明画布 · 中键平移 · 滚轮缩放</span></div>
    <div className="canvas-paper checker" style={{ width: state.project.width * state.zoom, height: state.project.height * state.zoom,
      transform: `translate(-50%, -50%) translate(${state.pan.x}px, ${state.pan.y}px)` }}>
      <canvas ref={canvas} aria-label="角色动画画布" onPointerDown={gesture.handlePointerDown} onPointerMove={gesture.handlePointerMove}
        onPointerUp={gesture.handlePointerUp} onPointerCancel={gesture.handleCancel} />
      <CanvasGuides state={state} drawing={gesture.drawing} />
    </div>
  </div><div className="canvas-help"><Crosshair size={12} /><span>{toolHelp(state)}</span>
    {state.tool === 'draw' && <label><input type="checkbox" checked={gesture.hasFixedParent} onChange={event => gesture.setHasFixedParent(event.target.checked)} />保持父骨骼</label>}
  </div></main>;
}

function toolHelp(state: EditorState): string {
  if (state.tool === 'draw') { const parent = state.selection?.kind === 'bone' ? state.project.bones.find(item => item.id === state.selection?.id)?.name : null;
    return `拖出起点和尖端 · ${parent ? `父骨骼：${parent}` : '创建根骨骼'} · Esc 取消`; }
  if (state.tool === 'pan') return '拖动画面平移视图 · 不修改角色 · 适应窗口可重置视图';
  if (state.tool === 'rotate') return '拖动图片边缘，围绕锚点旋转 · 修改图片基础变换';
  if (state.tool === 'scale') return '从图片边缘向外 / 向内拖动，等比缩放 · 修改图片基础变换';
  if (state.tool === 'length') return '拖动圆形尖端调整基础骨骼长度 · IK 连接点自动同步';
  return state.animationId ? '拖动关节或 IK 目标记录当前帧 · 拖动图片调整基础位置' : '基础姿态 · 拖动关节移动，尖端旋转 · 图片可直接拖动';
}

function CanvasGuides(props: { state: EditorState; drawing: Drawing | null }) {
  const { state, drawing } = props; const pose = samplePose(state);
  const attachment = state.selection?.kind === 'attachment' ? state.project.attachments.find(item => item.id === state.selection?.id) : undefined;
  const anchor = attachment ? attachmentWorld(state, attachment) : undefined;
  return <svg className="canvas-guides" viewBox={`0 0 ${state.project.width} ${state.project.height}`} aria-hidden="true">
    {state.tool === 'length' && Object.values(pose.bones).map(bone => <circle key={bone.id} cx={bone.endX} cy={bone.endY} r={8 / state.zoom} className="length-handle" />)}
    {anchor && (state.tool === 'rotate' || state.tool === 'scale') && <g className="part-anchor"><circle cx={anchor.x} cy={anchor.y} r={6 / state.zoom} /><path d={`M${anchor.x - 12 / state.zoom},${anchor.y}h${24 / state.zoom} M${anchor.x},${anchor.y - 12 / state.zoom}v${24 / state.zoom}`} /></g>}
    {drawing && <g className="draw-preview"><line x1={drawing.start.x} y1={drawing.start.y} x2={drawing.end.x} y2={drawing.end.y} /><circle cx={drawing.start.x} cy={drawing.start.y} r={5 / state.zoom} /><circle cx={drawing.end.x} cy={drawing.end.y} r={3 / state.zoom} /></g>}
  </svg>;
}

function clampZoom(value: number): number { return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)); }

function CanvasToolbar() {
  const state = useEditor();
  const handleToolChange = (tool: CanvasTool) => updateEditor({ tool, isPlaying: false, ...(tool === 'draw' ? { animationId: null, time: 0, showBones: true } : tool === 'length' ? { showBones: true } : {}) });
  const handleFit = () => {
    const rect = document.querySelector('.canvas-area')?.getBoundingClientRect();
    if (rect) updateEditor({ zoom: clampZoom(Math.min((rect.width - 48) / state.project.width, (rect.height - 48) / state.project.height)), pan: { x: 0, y: 0 } });
  };
  return <div className="canvas-toolbar"><div className="toolbar-group"><select aria-label="画布工具" value={state.tool} onChange={event => handleToolChange(event.target.value as CanvasTool)}>
    {TOOLS.map(tool => <option key={tool.value} value={tool.value}>{tool.label}</option>)}</select>
    <button className={state.showBones ? 'tool active-subtle' : 'tool'} title="切换骨骼和 IK 叠加显示" onClick={() => updateEditor({ showBones: !state.showBones })}><Bone size={15} /><span>{state.showBones ? '骨骼' : '纯画面'}</span></button>
    <select aria-label="编辑模式" value={state.animationId ?? ''} onChange={event => updateEditor({ animationId: event.target.value || null, time: 0, isPlaying: false, ...(event.target.value && state.tool === 'draw' ? { tool: 'select' } : {}) })}><option value="">基础姿态</option>{state.project.animations.map(animation => <option key={animation.id} value={animation.id}>{animation.name}</option>)}</select>
  </div><div className="toolbar-group zoom-controls"><button className="icon-button" aria-label="缩小画布" onClick={() => updateEditor({ zoom: clampZoom(state.zoom - 0.1) })}><Minus size={14} /></button><span className="zoom-text">{Math.round(state.zoom * 100)}%</span>
    <button className="icon-button" aria-label="放大画布" onClick={() => updateEditor({ zoom: clampZoom(state.zoom + 0.1) })}><Plus size={14} /></button><button className="icon-button" aria-label="适应窗口" onClick={handleFit}><Maximize size={14} /></button></div></div>;
}
