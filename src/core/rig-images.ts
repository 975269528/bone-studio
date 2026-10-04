import type { Project } from './types';
import { forwardKinematics } from './kinematics';
import { nearestRotation } from './rotation';

interface ImageFrame { id: string; x: number; y: number; rotation: number }

/** 保存图片锚点与旋转的基础世界坐标，保持缩放和锚点参数不变。 */
export function snapshotImageFrames(project: Project): ImageFrame[] {
  const world = forwardKinematics(project.bones);
  return project.attachments.map((attachment) => {
    const bone = world[attachment.boneId ?? ''];
    const angle = (bone?.rotation ?? 0) * Math.PI / 180;
    return { id: attachment.id,
      x: (bone?.x ?? 0) + attachment.x * Math.cos(angle) - attachment.y * Math.sin(angle),
      y: (bone?.y ?? 0) + attachment.x * Math.sin(angle) + attachment.y * Math.cos(angle),
      rotation: attachment.rotation + (bone?.rotation ?? 0) };
  });
}

/** 将保存的图片世界姿态反算到新骨架，供静态骨架编辑补偿图片位置。 */
export function restoreImageFrames(project: Project, frames: ImageFrame[]): void {
  const world = forwardKinematics(project.bones);
  const lookup = new Map(frames.map((frame) => [frame.id, frame]));
  project.attachments.forEach((attachment) => {
    const frame = lookup.get(attachment.id)!;
    const bone = world[attachment.boneId ?? ''];
    const angle = -(bone?.rotation ?? 0) * Math.PI / 180;
    const deltaX = frame.x - (bone?.x ?? 0);
    const deltaY = frame.y - (bone?.y ?? 0);
    attachment.x = deltaX * Math.cos(angle) - deltaY * Math.sin(angle);
    attachment.y = deltaX * Math.sin(angle) + deltaY * Math.cos(angle);
    attachment.rotation = nearestRotation(frame.rotation - (bone?.rotation ?? 0), attachment.rotation);
  });
}
