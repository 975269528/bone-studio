import { samplePose } from '@/core/api';
import type { Bone, IKConstraint, ProjectCommand, SamplePoseOptions } from '@/core/types';

export interface BoneEditRules {
  positionConstraint?: IKConstraint;
  rotationConstraint?: IKConstraint;
  help: string;
}

export type EditResult = { command: ProjectCommand } | { message: string };

/** Describe structural position locks and active IK rotation control separately. */
export function getBoneEditRules(context: SamplePoseOptions, boneId: string): BoneEditRules {
  const constraints = context.project.ikConstraints;
  const positionConstraint = constraints.find(constraint => constraint.tipBoneId === boneId
    && (!context.animationId || !constraint.animationId || constraint.animationId === context.animationId));
  const rotationConstraint = constraints.find(constraint => constraint.enabled
    && (!constraint.animationId || constraint.animationId === context.animationId)
    && [constraint.rootBoneId, constraint.tipBoneId].includes(boneId));
  const positionHelp = positionConstraint ? 'IK 下骨必须保持与上骨连接，不能单独移动关节。' : '';
  const rotationHelp = rotationConstraint ? '旋转由 IK 控制，请拖动 IK 目标调整姿态。'
    : positionConstraint ? '可以编辑旋转；如需独立移动此骨骼，请先移除关联 IK 约束。'
      : '拖动关节改变位置；拖动骨骼尖端调整旋转。动画模式下修改会记录到当前帧。';
  return { positionConstraint, rotationConstraint, help: positionHelp + rotationHelp };
}

/** Read the current local transform, preserving exact IK joint continuity when recording. */
export function sampledLocalBone(context: SamplePoseOptions, bone: Bone): Bone {
  if (!context.animationId) return bone;
  const pose = samplePose(context);
  const world = pose.bones[bone.id]; const parent = bone.parentId ? pose.bones[bone.parentId] : undefined;
  const radians = (parent?.rotation ?? 0) * Math.PI / 180;
  const deltaX = world.x - (parent?.x ?? 0); const deltaY = world.y - (parent?.y ?? 0);
  const constraint = getBoneEditRules(context, bone.id).positionConstraint;
  const root = constraint ? context.project.bones.find(item => item.id === constraint.rootBoneId) : undefined;
  return { ...bone, x: root?.length ?? deltaX * Math.cos(radians) + deltaY * Math.sin(radians),
    y: root ? 0 : -deltaX * Math.sin(radians) + deltaY * Math.cos(radians),
    rotation: world.rotation - (parent?.rotation ?? 0) };
}

/** Plan an explicit property edit; reject controlled transforms without losing the user's edit. */
export function planBoneEdit(options: {
  context: SamplePoseOptions; bone: Bone; changes: Partial<Omit<Bone, 'id'>>;
}): EditResult {
  const { context, bone, changes } = options;
  const rules = getBoneEditRules(context, bone.id); const current = sampledLocalBone(context, bone);
  const moved = (changes.x !== undefined && changes.x !== current.x) || (changes.y !== undefined && changes.y !== current.y);
  if ((rules.positionConstraint && moved) || (rules.rotationConstraint && changes.rotation !== undefined
    && changes.rotation !== current.rotation)) return { message: rules.help };
  const transform = changes.x !== undefined || changes.y !== undefined || changes.rotation !== undefined;
  if (context.animationId && transform) return { command: { type: 'keyframe.set', animationId: context.animationId,
    boneId: bone.id, keyframe: { time: context.time, x: changes.x ?? current.x, y: changes.y ?? current.y,
      rotation: changes.rotation ?? current.rotation } } };
  return { command: { type: 'bone.update', boneId: bone.id, changes } };
}

/** Record the sampled bone pose with connected IK joints represented in exact local coordinates. */
export function boneKeyframeCommand(context: SamplePoseOptions, bone: Bone): ProjectCommand {
  if (!context.animationId) throw new Error('请先选择动作，再记录骨骼关键帧。');
  const current = sampledLocalBone(context, bone);
  return { type: 'keyframe.set', animationId: context.animationId, boneId: bone.id,
    keyframe: { time: context.time, x: current.x, y: current.y, rotation: current.rotation } };
}
