import { samplePose } from '@/core/api';
import { nearestRotation } from '@/core/rotation';
import type { Attachment, Bone, ProjectCommand, SamplePoseOptions } from '@/core/types';
import { attachmentWorld } from './attachment-edit';
import { rigContext } from './rig-edit';
import type { CanvasTool, Selection } from './store';

export interface BindingContext extends SamplePoseOptions { tool?: CanvasTool }
interface BoneCreation { id: string; name: string; parentId: string | null; bindImage: boolean; selection: Selection; attachmentId: string }
const DEFAULT_LENGTH = 80;
const RADIANS = Math.PI / 180;

/** Match the visible setup or sampled animation pose when creating or binding image parts. */
export function bindingContext(context: BindingContext): SamplePoseOptions {
  return !context.animationId || context.tool === 'rig' || context.tool === 'draw' ? rigContext(context) : context;
}

function localTransform(options: { world: { x: number; y: number; rotation: number }; parent?: Bone; reference: number }) {
  const { world, parent, reference } = options; const angle = (parent?.rotation ?? 0) * RADIANS;
  const deltaX = world.x - (parent?.x ?? 0); const deltaY = world.y - (parent?.y ?? 0);
  return { x: deltaX * Math.cos(angle) + deltaY * Math.sin(angle),
    y: -deltaX * Math.sin(angle) + deltaY * Math.cos(angle),
    rotation: nearestRotation(world.rotation - (parent?.rotation ?? 0), reference) };
}

/** Rebind a part while preserving its currently displayed anchor, rotation and all appearance fields. */
export function planAttachmentBinding(options: { context: BindingContext; attachmentId: string; boneId: string | null }): ProjectCommand[] {
  const { attachmentId, boneId } = options; const context = bindingContext(options.context);
  const attachment = context.project.attachments.find(item => item.id === attachmentId);
  if (!attachment) throw new Error('图片部件已不存在，请重新选择。');
  if (attachment.boneId === boneId) return [];
  const parent = boneId ? samplePose(context).bones[boneId] : undefined;
  if (boneId && !parent) throw new Error('目标骨骼已不存在，请重新选择。');
  const transform = localTransform({ world: attachmentWorld(context, attachment), parent, reference: attachment.rotation });
  return [{ type: 'attachment.update', attachmentId, changes: { boneId, ...transform } }];
}

/** Build a reusable asset instance at a bone origin or at the canvas center; IDs must be unique. */
export function imageInstance(options: { context: SamplePoseOptions; assetId: string; id: string; boneId: string | null }): Attachment {
  const { context, assetId, id, boneId } = options; const asset = context.project.assets.find(item => item.id === assetId);
  if (!asset) throw new Error('图片素材已不存在，请重新选择。');
  return { id, name: asset.name, assetId, boneId, x: boneId ? 0 : context.project.width / 2,
    y: boneId ? 0 : context.project.height / 2, rotation: 0, scaleX: 1, scaleY: 1,
    anchorX: 0.5, anchorY: 0.5, opacity: 1, zIndex: Math.max(-1, ...context.project.attachments.map(item => item.zIndex)) + 1 };
}

/** Atomically create a bone and optionally bind the selected part, or create an instance from the selected asset. */
export function planBoneCreation(options: { context: BindingContext; creation: BoneCreation }): ProjectCommand[] {
  const context = bindingContext(options.context); const { creation } = options; const { selection } = creation;
  const parent = creation.parentId ? samplePose(context).bones[creation.parentId] : undefined;
  if (creation.parentId && !parent) throw new Error('父骨骼已不存在，请重新选择。');
  const existing = selection?.kind === 'attachment' ? context.project.attachments.find(item => item.id === selection.id) : undefined;
  if (creation.bindImage && selection?.kind === 'attachment' && !existing) throw new Error('所选图片部件已不存在，请关闭弹窗并重新选择。');
  const instance = selection?.kind === 'asset' && creation.bindImage
    ? imageInstance({ context, assetId: selection.id, id: creation.attachmentId, boneId: null }) : undefined;
  const image = creation.bindImage ? existing ?? instance : undefined;
  const world = image ? attachmentWorld(context, image) : { x: parent?.endX ?? context.project.width / 2,
    y: parent?.endY ?? context.project.height / 2, rotation: parent?.rotation ?? 0 };
  const transform = localTransform({ world: { ...world, rotation: parent?.rotation ?? 0 }, parent, reference: 0 });
  const bone: Bone = { id: creation.id, name: creation.name, parentId: creation.parentId, ...transform, length: DEFAULT_LENGTH };
  const commands: ProjectCommand[] = [{ type: 'bone.add', bone }];
  if (!image) return commands;
  const next = { ...context, project: { ...context.project, bones: [...context.project.bones, bone] } };
  const changes = { boneId: bone.id, ...localTransform({ world, parent: samplePose(next).bones[bone.id], reference: image.rotation }) };
  commands.push(existing ? { type: 'attachment.update', attachmentId: image.id, changes }
    : { type: 'attachment.add', attachment: { ...image, ...changes } });
  return commands;
}
