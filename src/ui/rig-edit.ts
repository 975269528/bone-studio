import { samplePose } from '@/core/api';
import type { SamplePoseOptions, WorldBone } from '@/core/types';
import type { DragTarget, Point } from './canvas-edit';
import type { Selection } from './store';

interface RigContext extends SamplePoseOptions { zoom?: number; selection?: Selection }
interface EndpointHit { bone: WorldBone; endpoint: 'head' | 'tail'; distance: number }
const HANDLE_RADIUS = 8;
const BODY_RADIUS = 6;

/** Read unposed setup geometry without running IK; the canonical project is never mutated. */
export function rigContext(context: SamplePoseOptions): SamplePoseOptions {
  return { project: { ...context.project, ikConstraints: [] }, animationId: null, time: 0 };
}

function endpointHits(bone: WorldBone, point: Point): EndpointHit[] {
  return [{ bone, endpoint: 'head', distance: Math.hypot(point.x - bone.x, point.y - bone.y) },
    { bone, endpoint: 'tail', distance: Math.hypot(point.x - bone.endX, point.y - bone.endY) }];
}

function bodyDistance(bone: WorldBone, point: Point): number {
  const deltaX = bone.endX - bone.x; const deltaY = bone.endY - bone.y;
  const fraction = Math.max(0, Math.min(1, ((point.x - bone.x) * deltaX + (point.y - bone.y) * deltaY) / bone.length ** 2));
  return Math.hypot(point.x - bone.x - fraction * deltaX, point.y - bone.y - fraction * deltaY);
}

/** Pick the nearest visible setup endpoint, resolving shared joints in favor of the selected bone. */
export function hitRigTarget(context: RigContext, point: Point): DragTarget | null {
  const bones = Object.values(samplePose(rigContext(context)).bones).reverse();
  const selectedId = context.selection?.kind === 'bone' ? context.selection.id : null;
  const radius = HANDLE_RADIUS / (context.zoom ?? 1);
  const hits = bones.flatMap(bone => endpointHits(bone, point)).filter(hit => hit.distance <= radius);
  hits.sort((left, right) => Math.abs(left.distance - right.distance) > 0.001 ? left.distance - right.distance
    : Number(right.bone.id === selectedId) - Number(left.bone.id === selectedId));
  const hit = hits[0];
  if (hit) return { kind: hit.endpoint === 'head' ? 'rig-head' : 'rig-tail', id: hit.bone.id };
  const body = bones.filter(bone => bodyDistance(bone, point) <= BODY_RADIUS / (context.zoom ?? 1))
    .sort((left, right) => Number(right.id === selectedId) - Number(left.id === selectedId))[0];
  return body ? { kind: 'rig-body', id: body.id, origin: point } : null;
}
