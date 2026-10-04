import { samplePose } from '@/core/api';
import type { SamplePoseOptions } from '@/core/types';
import { getBoneEditRules, planBoneEdit, sampledLocalBone } from './bone-edit';
import type { EditResult } from './bone-edit';

export interface Point { x: number; y: number }
export interface DragTarget { kind: 'bone' | 'tip' | 'ik'; id: string }
const HIT_RADIUS = 18;

/** Hit-test active IK targets and joints, allowing a connected elbow to remain selectable. */
export function hitCanvasTarget(context: SamplePoseOptions, point: Point): DragTarget | null {
  const pose = samplePose(context);
  for (const constraint of [...context.project.ikConstraints].reverse()) {
    if (!constraint.enabled || (constraint.animationId && constraint.animationId !== context.animationId)) continue;
    const tip = pose.bones[constraint.tipBoneId]; const target = pose.ikTargets[constraint.id];
    if ((tip && Math.hypot(point.x - tip.endX, point.y - tip.endY) < HIT_RADIUS)
      || (target && Math.hypot(point.x - target.x, point.y - target.y) < HIT_RADIUS)) return { kind: 'ik', id: constraint.id };
  }
  const bones = Object.values(pose.bones).reverse();
  for (const bone of bones) {
    if (Math.hypot(point.x - bone.x, point.y - bone.y) < HIT_RADIUS) return { kind: 'bone', id: bone.id };
  }
  for (const bone of bones) {
    if (Math.hypot(point.x - bone.endX, point.y - bone.endY) < HIT_RADIUS) return { kind: 'tip', id: bone.id };
  }
  return null;
}

/** Plan a pointer drag while rejecting IK-controlled joint movement or rotation before validation. */
export function planCanvasDrag(options: { context: SamplePoseOptions; drag: DragTarget; point: Point }): EditResult {
  const { context, drag, point } = options;
  if (drag.kind === 'ik') return { command: context.animationId ? { type: 'ik.keyframe.set', constraintId: drag.id,
    keyframe: { time: context.time, x: point.x, y: point.y } } : { type: 'ik.update', constraintId: drag.id, changes: { targetX: point.x, targetY: point.y } } };
  const bone = context.project.bones.find(item => item.id === drag.id);
  if (!bone) return { message: '此骨骼已不存在，请重新选择。' };
  const rules = getBoneEditRules(context, bone.id);
  if (drag.kind === 'bone' ? rules.positionConstraint : rules.rotationConstraint) return { message: rules.help };
  const pose = samplePose(context); const world = pose.bones[bone.id];
  const parent = bone.parentId ? pose.bones[bone.parentId] : undefined;
  const radians = (parent?.rotation ?? 0) * Math.PI / 180;
  const deltaX = point.x - (parent?.x ?? 0); const deltaY = point.y - (parent?.y ?? 0);
  const current = sampledLocalBone(context, bone);
  const changes = drag.kind === 'tip' ? { rotation: Math.atan2(point.y - world.y, point.x - world.x) * 180 / Math.PI - (parent?.rotation ?? 0) }
    : { x: deltaX * Math.cos(radians) + deltaY * Math.sin(radians), y: -deltaX * Math.sin(radians) + deltaY * Math.cos(radians),
      rotation: current.rotation };
  return planBoneEdit({ context, bone, changes });
}
