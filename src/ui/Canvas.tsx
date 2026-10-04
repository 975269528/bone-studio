import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import { Bone, Eye, Minus, Plus, Maximize, MousePointer2, Crosshair } from 'lucide-react';
import { samplePose } from '@/core/api';
import type { ProjectCommand } from '@/core/types';
import { renderProject } from '@/render';
import { applyCommands, getEditorState, reportError, updateEditor, useEditor } from './store';
import { displayedBone } from './pose-edit';

interface Drag { kind: 'bone' | 'tip' | 'ik'; id: string; committed: boolean }
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const HIT_RADIUS = 18;

function pointerPosition(event: PointerEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * event.currentTarget.width / rect.width,
    y: (event.clientY - rect.top) * event.currentTarget.height / rect.height };
}

function hitTarget(point: { x: number; y: number }): Drag | null {
  const state = getEditorState();
  const pose = samplePose({ project: state.project, animationId: state.animationId, time: state.time });
  for (const constraint of [...state.project.ikConstraints].reverse()) {
    if (!constraint.enabled || (constraint.animationId && constraint.animationId !== state.animationId)) continue;
    const tip = pose.bones[constraint.tipBoneId];
    if (tip && Math.hypot(point.x - tip.endX, point.y - tip.endY) < HIT_RADIUS) return { kind: 'ik', id: constraint.id, committed: false };
    const target = pose.ikTargets[constraint.id];
    if (target && Math.hypot(point.x - target.x, point.y - target.y) < HIT_RADIUS) return { kind: 'ik', id: constraint.id, committed: false };
  }
  for (const bone of Object.values(pose.bones).reverse()) {
    if (Math.hypot(point.x - bone.x, point.y - bone.y) < HIT_RADIUS) return { kind: 'bone', id: bone.id, committed: false };
    if (Math.hypot(point.x - bone.endX, point.y - bone.endY) < HIT_RADIUS) return { kind: 'tip', id: bone.id, committed: false };
  }
  return null;
}

function dragCommand(options: { drag: Drag; point: { x: number; y: number } }): ProjectCommand {
  const { drag, point } = options;
  const state = getEditorState();
  if (drag.kind === 'ik') return state.animationId ? { type: 'ik.keyframe.set', constraintId: drag.id,
    keyframe: { time: state.time, x: point.x, y: point.y } } : { type: 'ik.update', constraintId: drag.id, changes: { targetX: point.x, targetY: point.y } };
  const pose = samplePose({ project: state.project, animationId: state.animationId, time: state.time });
  const bone = state.project.bones.find(item => item.id === drag.id)!;
  const world = pose.bones[bone.id];
  const parent = bone.parentId ? pose.bones[bone.parentId] : undefined;
  const radians = (parent?.rotation ?? 0) * Math.PI / 180;
  const deltaX = point.x - (parent?.x ?? 0); const deltaY = point.y - (parent?.y ?? 0);
  const localRotation = world.rotation - (parent?.rotation ?? 0);
  const current = displayedBone(bone);
  const changes = drag.kind === 'tip' ? { x: current.x, y: current.y,
    rotation: Math.atan2(point.y - world.y, point.x - world.x) * 180 / Math.PI - (parent?.rotation ?? 0) } : {
    x: deltaX * Math.cos(radians) + deltaY * Math.sin(radians),
    y: -deltaX * Math.sin(radians) + deltaY * Math.cos(radians), rotation: localRotation };
  return state.animationId ? { type: 'keyframe.set', animationId: state.animationId, boneId: bone.id, keyframe: { time: state.time, ...changes } } : { type: 'bone.update', boneId: bone.id, changes };
}

/** Render the live pose and provide draggable bone joints and two-bone IK targets. */
export function Canvas() {
  const state = useEditor();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
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
  }, [state.project, state.animationId, state.time, state.showBones, state.selection]);
  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!state.showBones) return;
    drag.current = hitTarget(pointerPosition(event));
    updateEditor({ isPlaying: false, selection: drag.current ? { kind: drag.current.kind === 'ik' ? 'ik' : 'bone', id: drag.current.id } : null });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return;
    try { applyCommands([dragCommand({ drag: drag.current, point: pointerPosition(event) })], { coalesce: drag.current.committed }); drag.current.committed = true; }
    catch (error) { reportError(error); }
  };
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
