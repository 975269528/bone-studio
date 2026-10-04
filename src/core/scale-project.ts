import type { Project, ProjectCommand } from './types';

type ScaleCommand = Extract<ProjectCommand, { type: 'project.scale' }>;

interface ScaleTransform {
  factor: number;
  pivotX: number;
  pivotY: number;
}

function scalePosition(point: { x: number; y: number }, transform: ScaleTransform, isLocal: boolean): void {
  const pivotX = isLocal ? 0 : transform.pivotX;
  const pivotY = isLocal ? 0 : transform.pivotY;
  point.x = pivotX + (point.x - pivotX) * transform.factor;
  point.y = pivotY + (point.y - pivotY) * transform.factor;
}

function scaleBones(project: Project, transform: ScaleTransform): void {
  const bones = new Map(project.bones.map((bone) => [bone.id, bone]));
  project.bones.forEach((bone) => {
    scalePosition(bone, transform, bone.parentId !== null);
    bone.length *= transform.factor;
  });
  project.animations.forEach((animation) => animation.tracks.forEach((track) => {
    const bone = bones.get(track.boneId);
    if (!bone) throw new Error(`动画引用不存在的骨骼：${track.boneId}`);
    track.keyframes.forEach((key) => scalePosition(key, transform, bone.parentId !== null));
  }));
}

function scaleAttachments(project: Project, transform: ScaleTransform): void {
  project.attachments.forEach((attachment) => {
    scalePosition(attachment, transform, attachment.boneId !== null);
    attachment.scaleX *= transform.factor;
    attachment.scaleY *= transform.factor;
  });
}

/** 等比缩放角色几何、动画和 IK；未传轴心坐标时使用对应画布中心，不改变素材或画布尺寸。 */
export function scaleProject(project: Project, command: ScaleCommand): void {
  const transform = { factor: command.factor,
    pivotX: command.pivotX ?? project.width / 2, pivotY: command.pivotY ?? project.height / 2 };
  scaleBones(project, transform);
  scaleAttachments(project, transform);
  project.ikConstraints.forEach((constraint) => {
    const target = { x: constraint.targetX, y: constraint.targetY };
    scalePosition(target, transform, false);
    constraint.targetX = target.x;
    constraint.targetY = target.y;
    constraint.targetKeys.forEach((key) => scalePosition(key, transform, false));
  });
}
