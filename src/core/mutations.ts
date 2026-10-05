import type { Project, ProjectCommand } from './types';
import { removeBone } from './remove-bone';
import { scaleProject } from './scale-project';
import { updateBone } from './update-bone';
import { editRigBone, reparentRigBone } from './edit-rig';

function requireItem<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`操作对象不存在：${id}`);
  return item;
}

function setKeyframe<T extends { time: number }>(keys: T[], keyframe: T): T[] {
  const previous = keys.find((key) => key.time === keyframe.time);
  return [...keys.filter((key) => key.time !== keyframe.time), { ...previous, ...keyframe }]
    .sort((left, right) => left.time - right.time);
}

function mutateBone(project: Project, command: ProjectCommand): boolean {
  switch (command.type) {
    case 'bone.add': project.bones.push(command.bone); return true;
    case 'bone.update': updateBone(project, command); return true;
    case 'bone.edit': editRigBone(project, command); return true;
    case 'bone.reparent': reparentRigBone(project, command); return true;
    case 'bone.remove': removeBone(project, command); return true;
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
      track.keyframes = setKeyframe(track.keyframes, command.keyframe);
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
      constraint.targetKeys = setKeyframe(constraint.targetKeys, command.keyframe);
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
  if (command.type === 'project.scale') { scaleProject(project, command); return; }
  if (command.type === 'asset.add') { project.assets.push(command.asset); return; }
  if (command.type === 'asset.update') { Object.assign(requireItem(project.assets, command.assetId), command.changes); return; }
  if (mutateBone(project, command) || mutateAnimation(project, command) || mutateIK(project, command)) return;
  throw new Error('无法识别编辑命令');
}
