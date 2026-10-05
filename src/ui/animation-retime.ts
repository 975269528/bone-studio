import type { ProjectCommand } from '@/core/types';
import type { EditorState } from './store';

const MIN_ANIMATION_DURATION = 1 / 120;
const MAX_ANIMATION_DURATION = 600;

/** 按比例伸缩所选动画的 FK/IK 时间；多动作共享的非空 IK 轨道需先指定适用动作。 */
export function planAnimationDuration(state: Pick<EditorState, 'project' | 'animationId'>, newDuration: number): ProjectCommand[] {
  const animation = state.project.animations.find(item => item.id === state.animationId);
  if (!animation) throw new Error('请先选择需要调整时长的动作。');
  if (!Number.isFinite(newDuration) || newDuration < MIN_ANIMATION_DURATION || newDuration > MAX_ANIMATION_DURATION) {
    throw new Error(`动画时长必须是 ${MIN_ANIMATION_DURATION.toFixed(4)}–${MAX_ANIMATION_DURATION} 秒的有限数值。`);
  }
  if (newDuration === animation.duration) return [];
  const constraints = state.project.ikConstraints.filter(item => !item.animationId || item.animationId === animation.id);
  if (state.project.animations.length > 1 && constraints.some(item => !item.animationId && item.targetKeys.length > 0)) {
    throw new Error('此动作使用多个动作共享的 IK 目标关键帧。请先在 IK 属性中指定适用动作，再调整时长。');
  }
  const ratio = newDuration / animation.duration;
  const retime = (time: number) => time === animation.duration ? newDuration : Math.min(newDuration, time * ratio);
  const tracks = animation.tracks.map(track => ({ ...track, keyframes: track.keyframes.map(key => ({ ...key, time: retime(key.time) })) }));
  const commands: ProjectCommand[] = [{ type: 'animation.update', animationId: animation.id, changes: { duration: newDuration, tracks } }];
  constraints.filter(item => item.targetKeys.length > 0).forEach(constraint => commands.push({ type: 'ik.update', constraintId: constraint.id,
    changes: { targetKeys: constraint.targetKeys.map(key => ({ ...key, time: retime(key.time) })) } }));
  return commands;
}
