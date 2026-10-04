import type { Attachment, Bone, BoneKeyframe, Pose, Project, ProjectCommand } from './types';
import { DEGREES_TO_RADIANS } from './kinematics';
import { samplePose } from './pose';

type RemoveBoneCommand = Extract<ProjectCommand, { type: 'bone.remove' }>;

function descendants(project: Project, boneId: string): Set<string> {
  if (!project.bones.some((bone) => bone.id === boneId)) throw new Error(`操作对象不存在：${boneId}`);
  const removed = new Set([boneId]);
  let previousSize = 0;
  while (previousSize !== removed.size) {
    previousSize = removed.size;
    project.bones.forEach((bone) => {
      if (bone.parentId && removed.has(bone.parentId)) removed.add(bone.id);
    });
  }
  return removed;
}

function detachAttachment(attachment: Attachment, pose: Pose): void {
  const bone = attachment.boneId ? pose.bones[attachment.boneId] : undefined;
  if (!bone) throw new Error(`部件绑定骨骼不存在：${attachment.name}`);
  const angle = bone.rotation * DEGREES_TO_RADIANS;
  const worldX = bone.x + attachment.x * Math.cos(angle) - attachment.y * Math.sin(angle);
  const worldY = bone.y + attachment.x * Math.sin(angle) + attachment.y * Math.cos(angle);
  attachment.x = worldX;
  attachment.y = worldY;
  attachment.rotation += bone.rotation;
  attachment.boneId = null;
}

function sampledLocalTransform(bone: Bone, pose: Pose): Omit<BoneKeyframe, 'time'> {
  const world = pose.bones[bone.id];
  const parent = bone.parentId ? pose.bones[bone.parentId] : undefined;
  const angle = -(parent?.rotation ?? 0) * DEGREES_TO_RADIANS;
  const deltaX = world.x - (parent?.x ?? 0);
  const deltaY = world.y - (parent?.y ?? 0);
  return { x: deltaX * Math.cos(angle) - deltaY * Math.sin(angle),
    y: deltaX * Math.sin(angle) + deltaY * Math.cos(angle), rotation: world.rotation - (parent?.rotation ?? 0) };
}

function bakeSurvivingRoots(options: { project: Project; command: RemoveBoneCommand; removed: Set<string>; pose: Pose }): void {
  const { project, command, removed, pose } = options;
  const animation = project.animations.find((item) => item.id === command.animationId);
  const requestedTime = command.time ?? 0;
  const time = animation && requestedTime > animation.duration
    ? (animation.loop ? requestedTime % animation.duration : animation.duration) : requestedTime;
  project.ikConstraints.filter((constraint) => constraint.enabled && removed.has(constraint.tipBoneId)
    && !removed.has(constraint.rootBoneId) && (!constraint.animationId || constraint.animationId === animation?.id))
    .forEach((constraint) => {
      const bone = project.bones.find((item) => item.id === constraint.rootBoneId);
      if (!bone) throw new Error(`IK 骨骼不存在：${constraint.name}`);
      const local = sampledLocalTransform(bone, pose);
      if (!animation) { bone.rotation = local.rotation; return; }
      let track = animation.tracks.find((item) => item.boneId === bone.id);
      if (!track) { track = { boneId: bone.id, interpolation: 'linear', keyframes: [] }; animation.tracks.push(track); }
      track.keyframes = track.keyframes.filter((key) => key.time !== time);
      track.keyframes.push({ time, ...local });
      track.keyframes.sort((left, right) => left.time - right.time);
    });
}

/** 删除骨骼子树及关联轨道和 IK；部件保留并烘焙指定采样姿态，默认使用基础姿态。 */
export function removeBone(project: Project, command: RemoveBoneCommand): void {
  const removed = descendants(project, command.boneId);
  const pose = samplePose({ project, animationId: command.animationId, time: command.time ?? 0 });
  bakeSurvivingRoots({ project, command, removed, pose });
  project.attachments.forEach((attachment) => {
    if (attachment.boneId && removed.has(attachment.boneId)) detachAttachment(attachment, pose);
  });
  project.bones = project.bones.filter((bone) => !removed.has(bone.id));
  project.animations.forEach((animation) => {
    animation.tracks = animation.tracks.filter((track) => !removed.has(track.boneId));
  });
  project.ikConstraints = project.ikConstraints.filter((item) => !removed.has(item.rootBoneId) && !removed.has(item.tipBoneId));
}
