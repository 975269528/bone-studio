import { samplePose } from '@/core/api';
import type { Bone, SamplePoseOptions } from '@/core/types';
import type { Point } from './canvas-edit';

/** Create a root or branch at freely drawn world coordinates, preserving the parent's local frame. */
export function drawnBone(options: { context: SamplePoseOptions; start: Point; end: Point; parentId: string | null }): Bone {
  const { context, start, end, parentId } = options;
  const parent = parentId ? samplePose(context).bones[parentId] : undefined;
  const radians = (parent?.rotation ?? 0) * Math.PI / 180;
  const deltaX = start.x - (parent?.x ?? 0); const deltaY = start.y - (parent?.y ?? 0);
  return { id: crypto.randomUUID(), name: `骨骼 ${context.project.bones.length + 1}`, parentId,
    x: deltaX * Math.cos(radians) + deltaY * Math.sin(radians), y: -deltaX * Math.sin(radians) + deltaY * Math.cos(radians),
    rotation: Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI - (parent?.rotation ?? 0),
    length: Math.hypot(end.x - start.x, end.y - start.y) };
}
