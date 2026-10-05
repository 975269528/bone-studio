import { getEditorState, updateEditor } from './store';
import type { CanvasTool, EditorState } from './store';

export type EditorMode = 'rig' | 'animation';
export interface ModeRequest { mode: EditorMode; animationId?: string }
export interface AnimationMemory { documentId: string; animationId: string; time: number }
interface ModePlan { changes: Partial<EditorState>; memory: AnimationMemory | null }
let lastAnimation: AnimationMemory | null = null;

/** Read the working mode independently of auxiliary canvas tools. */
export function getEditorMode(state: Pick<EditorState, 'animationId'>): EditorMode {
  return state.animationId === null ? 'rig' : 'animation';
}

function rememberedAnimation(state: EditorState, memory: AnimationMemory | null): AnimationMemory | null {
  if (state.animationId && state.project.animations.some(animation => animation.id === state.animationId)) {
    return { documentId: state.documentId, animationId: state.animationId, time: state.time };
  }
  return memory?.documentId === state.documentId ? memory : null;
}

/** Plan a mode transition, validating remembered actions against the current document. */
export function planEditorMode(state: EditorState, request: ModeRequest, memory: AnimationMemory | null): ModePlan {
  const remembered = rememberedAnimation(state, memory);
  const rigChanges: Partial<EditorState> = { tool: 'rig', animationId: null, time: 0, isPlaying: false, showBones: true };
  if (request.mode === 'rig') return { changes: rigChanges, memory: remembered };
  const preferredId = request.animationId ?? remembered?.animationId;
  const animation = state.project.animations.find(item => item.id === preferredId) ?? state.project.animations[0];
  if (!animation) return { changes: { ...rigChanges, message: '还没有动作，请在时间轴添加动作后切换到动画模式。' }, memory: null };
  const time = request.animationId !== undefined || remembered?.animationId !== animation.id ? 0 : remembered.time;
  const boundedTime = Math.max(0, Math.min(animation.duration, Number.isFinite(time) ? time : 0));
  return { changes: { tool: 'select', animationId: animation.id, time: boundedTime, isPlaying: false },
    memory: { documentId: state.documentId, animationId: animation.id, time: boundedTime } };
}

/** Enter a mode; an explicit action selection starts at zero, while re-entry restores its last time. */
export function setEditorMode(request: ModeRequest): void {
  const plan = planEditorMode(getEditorState(), request, lastAnimation);
  lastAnimation = plan.memory;
  updateEditor(plan.changes);
}

/** Cycle setup and animation modes while pausing playback and preserving the last action. */
export function cycleEditorMode(): void {
  setEditorMode({ mode: getEditorMode(getEditorState()) === 'rig' ? 'animation' : 'rig' });
}

/** Select a canvas tool through the same mode transitions used by buttons and the timeline. */
export function selectCanvasTool(tool: CanvasTool): void {
  if (tool === 'select') { setEditorMode({ mode: 'animation' }); return; }
  if (tool === 'rig' || tool === 'draw' || tool === 'length') setEditorMode({ mode: 'rig' });
  updateEditor({ tool, isPlaying: false });
}
