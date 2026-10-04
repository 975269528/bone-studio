import type { Attachment, Pose } from '../core/types';
import { DEGREES_TO_RADIANS } from '../core/kinematics';
import type { DrawOptions } from './types';

function applyPartTransform(options: { context: CanvasRenderingContext2D; attachment: Attachment; pose: Pose }): void {
  const { context, attachment, pose } = options;
  const bone = attachment.boneId ? pose.bones[attachment.boneId] : undefined;
  if (bone) { context.translate(bone.x, bone.y); context.rotate(bone.rotation * DEGREES_TO_RADIANS); }
  context.translate(attachment.x, attachment.y);
  context.rotate(attachment.rotation * DEGREES_TO_RADIANS);
  context.scale(attachment.scaleX, attachment.scaleY);
}

function drawParts(options: DrawOptions): void {
  const { context, project, pose, images, overlays } = options;
  const sorted = [...project.attachments].sort((left, right) => left.zIndex - right.zIndex);
  for (const attachment of sorted) {
    const asset = project.assets.find((item) => item.id === attachment.assetId);
    const image = images.get(attachment.assetId);
    if (!asset || !image) throw new Error(`部件素材不可用：${attachment.name}`);
    context.save();
    applyPartTransform({ context, attachment, pose });
    const left = -asset.width * attachment.anchorX;
    const top = -asset.height * attachment.anchorY;
    context.globalAlpha = attachment.opacity;
    context.drawImage(image, left, top, asset.width, asset.height);
    if (overlays?.selectedAttachmentId === attachment.id) {
      context.globalAlpha = 1;
      context.strokeStyle = '#ffbc66';
      context.lineWidth = 2;
      context.strokeRect(left, top, asset.width, asset.height);
    }
    context.restore();
  }
}

function drawGrid(options: DrawOptions): void {
  if (!options.overlays?.grid) return;
  const { context, project } = options;
  const step = Math.max(32, Math.ceil(Math.max(project.width, project.height) / 64));
  context.strokeStyle = '#6e889f22';
  context.lineWidth = 1;
  context.beginPath();
  for (let index = step; index < project.width; index += step) { context.moveTo(index, 0); context.lineTo(index, project.height); }
  for (let index = step; index < project.height; index += step) { context.moveTo(0, index); context.lineTo(project.width, index); }
  context.stroke();
}

function drawBones(options: DrawOptions): void {
  if (!options.overlays?.bones) return;
  const { context, pose } = options;
  for (const bone of Object.values(pose.bones)) {
    const selected = options.overlays.selectedBoneId === bone.id;
    context.strokeStyle = selected ? '#ffbe72' : '#b8f3ef';
    context.fillStyle = selected ? '#ffbe72' : '#163b50';
    context.lineWidth = selected ? 4 : 2;
    context.beginPath(); context.moveTo(bone.x, bone.y); context.lineTo(bone.endX, bone.endY); context.stroke();
    context.beginPath(); context.arc(bone.x, bone.y, selected ? 5 : 4, 0, Math.PI * 2); context.fill(); context.stroke();
  }
}

function drawTargets(options: DrawOptions): void {
  if (!options.overlays?.ik) return;
  const { context, pose } = options;
  for (const [id, target] of Object.entries(pose.ikTargets)) {
    context.strokeStyle = options.overlays.selectedIKId === id ? '#ffbe72' : '#f795c0';
    context.lineWidth = 2;
    context.beginPath(); context.arc(target.x, target.y, 8, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.moveTo(target.x - 12, target.y); context.lineTo(target.x + 12, target.y);
    context.moveTo(target.x, target.y - 12); context.lineTo(target.x, target.y + 12); context.stroke();
  }
}

/** 绘制一致的场景；导出调用时不提供 overlays，得到透明的纯角色图。 */
export function drawProject(options: DrawOptions): void {
  drawGrid(options);
  drawParts(options);
  drawBones(options);
  drawTargets(options);
}
