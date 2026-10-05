import type { Project } from '@/core/types';
import type { Selection } from './store';

/** Stable section identifiers shared by collapse state and pointer drop targets. */
export const LIBRARY_SECTIONS = { bones: '$bones', unbound: '$unbound', ik: '$ik', root: '$root' } as const;

/** Return the owning section and bone ancestors that must open to reveal a selection. */
export function selectionPath(project: Project, selection: Selection): string[] {
  if (!selection || selection.kind === 'asset') return [];
  if (selection.kind === 'ik') return [LIBRARY_SECTIONS.ik];
  const attachment = selection.kind === 'attachment' ? project.attachments.find(item => item.id === selection.id) : undefined;
  if (attachment && !attachment.boneId) return [LIBRARY_SECTIONS.unbound];
  let parentId = attachment?.boneId ?? project.bones.find(item => item.id === selection.id)?.parentId;
  const path: string[] = [LIBRARY_SECTIONS.bones];
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId); path.push(parentId);
    parentId = project.bones.find(item => item.id === parentId)?.parentId;
  }
  return path;
}

/** Convert wheel units to bounded vertical pixels for the list under a pointer drag. */
export function dragWheelPixels(options: { delta: number; mode: number; pageHeight: number }): number {
  const lineHeight = 28;
  return options.delta * (options.mode === 1 ? lineHeight : options.mode === 2 ? options.pageHeight : 1);
}
