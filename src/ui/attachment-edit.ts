import { samplePose } from '@/core/api';
import type { Attachment, ProjectCommand, SamplePoseOptions } from '@/core/types';
import type { Point } from './canvas-edit';

export interface AttachmentDrag { attachment: Attachment; start: Point; mode: 'select' | 'rotate' | 'scale' }
const RADIANS = Math.PI / 180;
const MIN_SCALE = 0.01;

/** Read an attachment anchor and rotation in the displayed world pose. */
export function attachmentWorld(context: SamplePoseOptions, attachment: Attachment) {
  const bone = attachment.boneId ? samplePose(context).bones[attachment.boneId] : undefined;
  const angle = (bone?.rotation ?? 0) * RADIANS;
  return { x: (bone?.x ?? 0) + attachment.x * Math.cos(angle) - attachment.y * Math.sin(angle),
    y: (bone?.y ?? 0) + attachment.x * Math.sin(angle) + attachment.y * Math.cos(angle),
    rotation: (bone?.rotation ?? 0) + attachment.rotation, parentRotation: bone?.rotation ?? 0 };
}

/** Select the frontmost visible image rectangle, respecting rotation, anchor and signed scales. */
export function hitAttachment(context: SamplePoseOptions, point: Point): Attachment | undefined {
  const sorted = [...context.project.attachments].reverse().sort((left, right) => right.zIndex - left.zIndex);
  return sorted.find(attachment => {
    const asset = context.project.assets.find(item => item.id === attachment.assetId);
    if (!asset || attachment.opacity <= 0 || attachment.scaleX === 0 || attachment.scaleY === 0) return false;
    const world = attachmentWorld(context, attachment); const angle = world.rotation * RADIANS;
    const deltaX = point.x - world.x; const deltaY = point.y - world.y;
    const localX = (deltaX * Math.cos(angle) + deltaY * Math.sin(angle)) / attachment.scaleX;
    const localY = (-deltaX * Math.sin(angle) + deltaY * Math.cos(angle)) / attachment.scaleY;
    return localX >= -asset.width * attachment.anchorX && localX <= asset.width * (1 - attachment.anchorX)
      && localY >= -asset.height * attachment.anchorY && localY <= asset.height * (1 - attachment.anchorY);
  });
}

/** Move, rotate or uniformly scale a part from the gesture's original transform without cumulative drift. */
export function planAttachmentDrag(options: { context: SamplePoseOptions; drag: AttachmentDrag; point: Point }): ProjectCommand {
  const { context, drag, point } = options; const { attachment, start, mode } = drag;
  const world = attachmentWorld(context, attachment); const angle = world.parentRotation * RADIANS;
  const deltaX = point.x - start.x; const deltaY = point.y - start.y;
  let changes: Partial<Attachment>;
  if (mode === 'rotate') {
    const initialAngle = Math.atan2(start.y - world.y, start.x - world.x);
    const currentAngle = Math.atan2(point.y - world.y, point.x - world.x);
    changes = { rotation: attachment.rotation + (currentAngle - initialAngle) / RADIANS };
  } else if (mode === 'scale') {
    const initialDistance = Math.max(1, Math.hypot(start.x - world.x, start.y - world.y));
    const factor = Math.max(MIN_SCALE, Math.hypot(point.x - world.x, point.y - world.y) / initialDistance);
    changes = { scaleX: attachment.scaleX * factor, scaleY: attachment.scaleY * factor };
  } else changes = { x: attachment.x + deltaX * Math.cos(angle) + deltaY * Math.sin(angle),
    y: attachment.y - deltaX * Math.sin(angle) + deltaY * Math.cos(angle) };
  return { type: 'attachment.update', attachmentId: attachment.id, changes };
}
