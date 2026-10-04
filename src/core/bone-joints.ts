import type { Bone } from './types';
import { forwardKinematics } from './kinematics';
import { getBoneConnection } from './bone-connections';
import { nearestRotation } from './rotation';

const MIN_BONE_LENGTH = 1;
const LENGTH_TOLERANCE = 1e-8;

export interface JointPoint { x: number; y: number }
export interface BonePoints { head: JointPoint; tail: JointPoint }
export type RigPoints = Map<string, BonePoints>;

/** 快照基础世界端点；不应用动画和 IK。 */
export function snapshotBonePoints(bones: Bone[]): RigPoints {
  const world = forwardKinematics(bones);
  return new Map(bones.map((bone) => [bone.id, {
    head: { x: world[bone.id].x, y: world[bone.id].y },
    tail: { x: world[bone.id].endX, y: world[bone.id].endY },
  }]));
}

/** 合并拓扑相连的端点引用；单纯位置重叠不构成连接。 */
export function shareJointPoints(bones: Bone[], points: RigPoints): void {
  const lookup = new Map(bones.map((bone) => [bone.id, bone]));
  const resolved = new Set<string>();
  function resolve(bone: Bone): void {
    if (resolved.has(bone.id)) return;
    const parent = lookup.get(bone.parentId ?? '');
    if (parent) resolve(parent);
    const connection = getBoneConnection(bone, parent);
    if (parent && connection !== 'none') points.get(bone.id)!.head = points.get(parent.id)![connection];
    resolved.add(bone.id);
  }
  bones.forEach(resolve);
}

function worldFrame(points: BonePoints): { x: number; y: number; rotation: number; length: number } {
  const deltaX = points.tail.x - points.head.x;
  const deltaY = points.tail.y - points.head.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length < MIN_BONE_LENGTH - LENGTH_TOLERANCE) throw new Error('关节编辑失败：骨长不能小于 1 像素');
  // 世界端点相减可能把合法的 1 像素骨算得略短；仅吸收浮点误差。
  return { ...points.head, rotation: Math.atan2(deltaY, deltaX) * 180 / Math.PI,
    length: Math.max(MIN_BONE_LENGTH, length) };
}

function localFrame(world: ReturnType<typeof worldFrame>, parent?: ReturnType<typeof worldFrame>) {
  const angle = -(parent?.rotation ?? 0) * Math.PI / 180;
  const deltaX = world.x - (parent?.x ?? 0);
  const deltaY = world.y - (parent?.y ?? 0);
  return { x: deltaX * Math.cos(angle) - deltaY * Math.sin(angle),
    y: deltaX * Math.sin(angle) + deltaY * Math.cos(angle),
    rotation: world.rotation - (parent?.rotation ?? 0), length: world.length };
}

/** 以修改后的父骨世界坐标重建整套局部骨架，保全未移动的世界端点。 */
export function rebuildBoneFrames(bones: Bone[], points: RigPoints): void {
  const frames = new Map(bones.map((bone) => [bone.id, worldFrame(points.get(bone.id)!)]));
  bones.forEach((bone) => {
    const parent = frames.get(bone.parentId ?? '');
    const next = localFrame(frames.get(bone.id)!, parent);
    next.rotation = nearestRotation(next.rotation, bone.rotation);
    Object.assign(bone, next);
    if (parent && bone.connection !== 'none') {
      bone.x = bone.connection === 'tail' ? parent.length : 0;
      bone.y = 0;
    }
  });
}
