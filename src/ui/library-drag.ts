import type { DragEvent } from 'react';
import type { ProjectCommand } from '@/core/types';
import { imageInstance, planAttachmentBinding } from './binding-plan';
import type { BindingContext } from './binding-plan';
import { applyCommands, getEditorState, updateEditor } from './store';

export interface LibraryItem { kind: 'bone' | 'attachment' | 'asset'; id: string }
const DRAG_TYPE = 'application/x-bonestudio-library';

/** Start an internal library drag with only an object kind and identifier. */
export function startLibraryDrag(event: DragEvent, item: LibraryItem): void {
  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item)); event.dataTransfer.effectAllowed = item.kind === 'asset' ? 'copy' : 'move';
  updateEditor({ isPlaying: false });
}

/** Recognize internal drags without accepting external text or files as object identifiers. */
export function isLibraryDrag(event: DragEvent): boolean { return event.dataTransfer.types.includes(DRAG_TYPE); }

function readItem(event: DragEvent): LibraryItem {
  const item: unknown = JSON.parse(event.dataTransfer.getData(DRAG_TYPE));
  if (!item || typeof item !== 'object' || !('kind' in item) || !('id' in item) || typeof item.id !== 'string'
    || (item.kind !== 'bone' && item.kind !== 'attachment' && item.kind !== 'asset')) throw new Error('拖拽对象无效，请重新拖动。');
  return { kind: item.kind, id: item.id };
}

/** Plan a legal tree drop; bone changes preserve setup placement and image bindings preserve the displayed pose. */
export function planLibraryDrop(options: { context: BindingContext; item: LibraryItem; boneId: string | null }): ProjectCommand[] {
  const { context, item, boneId } = options;
  if (item.kind === 'attachment') return planAttachmentBinding({ context, attachmentId: item.id, boneId });
  if (item.kind === 'asset') return [{ type: 'attachment.add', attachment: imageInstance({ context, assetId: item.id, id: crypto.randomUUID(), boneId }) }];
  const bone = context.project.bones.find(candidate => candidate.id === item.id);
  if (!bone) throw new Error('骨骼已不存在，请重新拖动。');
  if (bone.parentId === boneId) return [];
  let parent = boneId ? context.project.bones.find(candidate => candidate.id === boneId) : undefined;
  if (boneId && !parent) throw new Error('目标骨骼已不存在，请重新拖动。');
  while (parent) {
    if (parent.id === item.id) throw new Error('不能将骨骼拖到自身或自己的子骨骼上。');
    parent = context.project.bones.find(candidate => candidate.id === parent?.parentId);
  }
  if (context.project.ikConstraints.some(constraint => constraint.tipBoneId === bone.id)) throw new Error('IK 第二段需保持原父级；先移除 IK 才能更换父骨骼。');
  return [{ type: 'bone.reparent', boneId: bone.id, parentId: boneId, connection: 'none', keepImages: true }];
}

/** Apply a tree drop as one undoable transaction and reveal the resulting part or bone. */
export function dropLibraryItem(event: DragEvent, boneId: string | null): void {
  const item = readItem(event); const commands = planLibraryDrop({ context: getEditorState(), item, boneId });
  if (!commands.length) return;
  applyCommands(commands);
  const added = commands.find(command => command.type === 'attachment.add');
  updateEditor({ selection: added?.type === 'attachment.add' ? { kind: 'attachment', id: added.attachment.id } : item,
    message: item.kind === 'bone' ? '已更换父级，保持基础姿态；动画仍沿用原局部关键帧。'
      : '已更新图片绑定，保持当前画面位置与旋转；后续姿态随新骨骼运动。' });
}
