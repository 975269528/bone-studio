import type { Project, ProjectCommand } from './types';

function requireItem<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`操作对象不存在：${id}`);
  return item;
}

function removeBone(project: Project, id: string): void {
  requireItem(project.bones, id);
  const removed = new Set([id]);
  let previousSize = 0;
  while (previousSize !== removed.size) {
    previousSize = removed.size;
    project.bones.forEach((bone) => {
      if (bone.parentId && removed.has(bone.parentId)) removed.add(bone.id);
    });
  }
  project.bones = project.bones.filter((bone) => !removed.has(bone.id));
  project.attachments = project.attachments.filter((item) => !item.boneId || !removed.has(item.boneId));
  project.animations.forEach((animation) => {
    animation.tracks = animation.tracks.filter((track) => !removed.has(track.boneId));
  });
  project.ikConstraints = project.ikConstraints.filter((item) => !removed.has(item.rootBoneId) && !removed.has(item.tipBoneId));
}

function mutateBone(project: Project, command: ProjectCommand): boolean {
  switch (command.type) {
    case 'bone.add': project.bones.push(command.bone); return true;
    case 'bone.update': Object.assign(requireItem(project.bones, command.boneId), command.changes); return true;
    case 'bone.remove': removeBone(project, command.boneId); return true;
    case 'attachment.add': project.attachments.push(command.attachment); return true;
    case 'attachment.update': Object.assign(requireItem(project.attachments, command.attachmentId), command.changes); return true;
    case 'attachment.remove':
      requireItem(project.attachments, command.attachmentId);
      project.attachments = project.attachments.filter((item) => item.id !== command.attachmentId);
      return true;
    default: return false;
  }
}

function mutateAnimation(project: Project, command: ProjectCommand): boolean {
  switch (command.type) {
    case 'animation.add': project.animations.push(command.animation); return true;
    case 'animation.update': Object.assign(requireItem(project.animations, command.animationId), command.changes); return true;
    case 'animation.remove':
      requireItem(project.animations, command.animationId);
      project.animations = project.animations.filter((item) => item.id !== command.animationId);
      project.ikConstraints = project.ikConstraints.filter((item) => item.animationId !== command.animationId);
      return true;
    case 'keyframe.set': {
      requireItem(project.bones, command.boneId);
      const animation = requireItem(project.animations, command.animationId);
      let track = animation.tracks.find((item) => item.boneId === command.boneId);
      if (!track) { track = { boneId: command.boneId, keyframes: [], interpolation: command.interpolation ?? 'linear' }; animation.tracks.push(track); }
      if (command.interpolation) track.interpolation = command.interpolation;
      track.keyframes = track.keyframes.filter((key) => key.time !== command.keyframe.time);
      track.keyframes.push(command.keyframe);
      track.keyframes.sort((left, right) => left.time - right.time);
      return true;
    }
    case 'keyframe.remove': {
      const animation = requireItem(project.animations, command.animationId);
      const track = animation.tracks.find((item) => item.boneId === command.boneId);
      if (!track) throw new Error(`骨骼轨道不存在：${command.boneId}`);
      track.keyframes = track.keyframes.filter((key) => key.time !== command.time);
      return true;
    }
    default: return false;
  }
}

function mutateIK(project: Project, command: ProjectCommand): boolean {
  switch (command.type) {
    case 'ik.add': project.ikConstraints.push(command.constraint); return true;
    case 'ik.update': Object.assign(requireItem(project.ikConstraints, command.constraintId), command.changes); return true;
    case 'ik.remove':
      requireItem(project.ikConstraints, command.constraintId);
      project.ikConstraints = project.ikConstraints.filter((item) => item.id !== command.constraintId);
      return true;
    case 'ik.keyframe.set': {
      const constraint = requireItem(project.ikConstraints, command.constraintId);
      constraint.targetKeys = constraint.targetKeys.filter((key) => key.time !== command.keyframe.time);
      constraint.targetKeys.push(command.keyframe);
      constraint.targetKeys.sort((left, right) => left.time - right.time);
      return true;
    }
    case 'ik.keyframe.remove': {
      const constraint = requireItem(project.ikConstraints, command.constraintId);
      constraint.targetKeys = constraint.targetKeys.filter((key) => key.time !== command.time);
      return true;
    }
    default: return false;
  }
}

/** 仅用于已校验命令在隔离事务副本上的应用；调用者负责最终项目校验。 */
export function applyMutation(project: Project, command: ProjectCommand): void {
  if (command.type === 'project.update') { Object.assign(project, command.changes); return; }
  if (command.type === 'asset.add') { project.assets.push(command.asset); return; }
  if (mutateBone(project, command) || mutateAnimation(project, command) || mutateIK(project, command)) return;
  throw new Error('无法识别编辑命令');
}
