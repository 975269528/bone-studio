import { planAnimationDuration } from './animation-retime';
import { applyCommands, getEditorState, reportError, updateEditor } from './store';
import type { CommitOptions } from './store';

export const MAX_TIMELINE_DURATION = 600;
interface DurationCommit extends CommitOptions { expectedRevision?: number; documentId?: string; animationId?: string }

/** Compute a frame-snapped duration from the original ruler scale, bounded to one frame through ten minutes. */
export function draggedDuration(options: { duration: number; deltaX: number; width: number; fps: number }): number {
  if (options.deltaX === 0) return options.duration;
  const raw = options.duration + options.deltaX / Math.max(1, options.width) * options.duration;
  return Math.max(1 / options.fps, Math.min(MAX_TIMELINE_DURATION, Math.round(raw * options.fps) / options.fps));
}

/** Retime all FK/IK keys and preserve the playhead's relative progress with one undo transaction. */
export function commitAnimationDuration(duration: number, options?: DurationCommit): void {
  const state = getEditorState(); const animation = state.project.animations.find(item => item.id === state.animationId);
  try {
    if (!animation || (options?.documentId && state.documentId !== options.documentId)
      || (options?.animationId && state.animationId !== options.animationId)) throw new Error('动作或文档已切换，请重新调整时长。');
    const commands = planAnimationDuration(state, duration); if (!commands.length) return;
    applyCommands(commands, options);
    updateEditor({ time: Math.min(duration, state.time * duration / animation.duration), isPlaying: false });
  } catch (error) { reportError(error); }
}
