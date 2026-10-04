import { samplePose } from '@/core/api';
import type { Bone, IKConstraint } from '@/core/types';
import { getEditorState, runCommand, updateEditor } from './store';
import { planBoneEdit, sampledLocalBone } from './bone-edit';

/** Read a bone's current sampled local pose for animation property controls. */
export function displayedBone(bone: Bone): Bone {
  return sampledLocalBone(getEditorState(), bone);
}

/** Edit transforms in the active animation, or edit the base pose in setup mode. */
export function updateBone(bone: Bone, changes: Partial<Omit<Bone, 'id'>>): void {
  const result = planBoneEdit({ context: getEditorState(), bone, changes });
  if ('message' in result) updateEditor({ message: result.message });
  else runCommand(result.command);
}

/** Read the animated IK target independently from a possibly unreachable tip. */
export function displayedTarget(constraint: IKConstraint): { targetX: number; targetY: number } {
  const state = getEditorState();
  const target = samplePose({ project: state.project, animationId: state.animationId, time: state.time }).ikTargets[constraint.id];
  return target ? { targetX: target.x, targetY: target.y } : constraint;
}

/** Edit the current animated IK target without changing unrelated constraint fields. */
export function updateIK(constraint: IKConstraint, changes: Partial<Omit<IKConstraint, 'id'>>): void {
  const { animationId, time } = getEditorState();
  if (animationId && (changes.targetX !== undefined || changes.targetY !== undefined)) {
    if (constraint.animationId && constraint.animationId !== animationId) {
      updateEditor({ message: '请切换到此 IK 约束关联的动作，再编辑目标关键帧。' });
      return;
    }
    const target = displayedTarget(constraint);
    runCommand({ type: 'ik.keyframe.set', constraintId: constraint.id,
      keyframe: { time, x: changes.targetX ?? target.targetX, y: changes.targetY ?? target.targetY } });
  } else runCommand({ type: 'ik.update', constraintId: constraint.id, changes });
}
