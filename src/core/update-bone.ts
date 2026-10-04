import type { Bone, Project, ProjectCommand } from './types';
import { CONNECTION_TOLERANCE, getBoneConnection } from './bone-connections';

type UpdateBoneCommand = Extract<ProjectCommand, { type: 'bone.update' }>;

function isConnected(point: { x: number; y: number }, length: number): boolean {
  return Math.abs(point.x - length) <= CONNECTION_TOLERANCE && Math.abs(point.y) <= CONNECTION_TOLERANCE;
}

function maintainChildren(project: Project, previous: Bone, nextLength: number): void {
  const connectedIds = new Set(project.bones.filter((bone) => bone.parentId === previous.id
    && getBoneConnection(bone, previous) === 'tail').map((bone) => bone.id));
  project.bones.forEach((bone) => {
    if (connectedIds.has(bone.id)) { bone.x = nextLength; bone.y = 0; }
  });
  project.animations.forEach((animation) => animation.tracks.forEach((track) => {
    if (!connectedIds.has(track.boneId)) return;
    track.keyframes.forEach((key) => {
      if (isConnected(key, previous.length)) { key.x = nextLength; key.y = 0; }
    });
  }));
}

/** 同步根骨长变化后 IK 适用动画的下骨位置；不改其他 FK 动画。 */
export function syncIKTipKeys(project: Project, boneId: string, length: number): void {
  project.ikConstraints.filter((constraint) => constraint.rootBoneId === boneId).forEach((constraint) => {
    project.animations.filter((animation) => !constraint.animationId || animation.id === constraint.animationId)
      .forEach((animation) => {
        animation.tracks.find((track) => track.boneId === constraint.tipBoneId)?.keyframes.forEach((key) => {
          key.x = length;
          key.y = 0;
        });
      });
  });
}

function maintainIK(project: Project, boneId: string, length: number): void {
  project.ikConstraints.filter((constraint) => constraint.rootBoneId === boneId).forEach((constraint) => {
    const tip = project.bones.find((bone) => bone.id === constraint.tipBoneId);
    if (!tip) throw new Error(`IK 骨骼不存在：${constraint.name}`);
    tip.x = length;
    tip.y = 0;
  });
  syncIKTipKeys(project, boneId, length);
}

/** 更新骨骼属性；骨长变化时维护已有末端连接及 IK 适用动画的下骨连接。 */
export function updateBone(project: Project, command: UpdateBoneCommand): void {
  const bone = project.bones.find((item) => item.id === command.boneId);
  if (!bone) throw new Error(`操作对象不存在：${command.boneId}`);
  const previous = { ...bone };
  Object.assign(bone, command.changes);
  if (previous.length === bone.length) return;
  maintainChildren(project, previous, bone.length);
  maintainIK(project, bone.id, bone.length);
}
