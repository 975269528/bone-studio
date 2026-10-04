import type { Bone, TwoBoneIKOptions, TwoBoneIKResult, WorldBone } from './types';

export const DEGREES_TO_RADIANS = Math.PI / 180;
const EPSILON = 1e-8;

/** 按层级计算世界姿态；输入必须是无循环、父节点有效的骨骼集合。 */
export function forwardKinematics(bones: Bone[]): Record<string, WorldBone> {
  const lookup = new Map(bones.map((bone) => [bone.id, bone]));
  const result = new Map<string, WorldBone>();
  const visiting = new Set<string>();
  function resolve(bone: Bone): WorldBone {
    const existing = result.get(bone.id);
    if (existing) return existing;
    if (visiting.has(bone.id)) throw new Error('骨骼层级存在循环');
    visiting.add(bone.id);
    const parentBone = bone.parentId ? lookup.get(bone.parentId) : undefined;
    if (bone.parentId && !parentBone) throw new Error(`骨骼父节点不存在：${bone.parentId}`);
    const parent = parentBone ? resolve(parentBone) : undefined;
    const angle = (parent?.rotation ?? 0) * DEGREES_TO_RADIANS;
    const x = (parent?.x ?? 0) + bone.x * Math.cos(angle) - bone.y * Math.sin(angle);
    const y = (parent?.y ?? 0) + bone.x * Math.sin(angle) + bone.y * Math.cos(angle);
    const rotation = bone.rotation + (parent?.rotation ?? 0);
    const world: WorldBone = { ...bone, x, y, rotation,
      endX: x + bone.length * Math.cos(rotation * DEGREES_TO_RADIANS),
      endY: y + bone.length * Math.sin(rotation * DEGREES_TO_RADIANS) };
    result.set(bone.id, world);
    visiting.delete(bone.id);
    return world;
  }
  bones.forEach(resolve);
  return Object.fromEntries(result);
}

/** 解析求解不拉伸的两骨 IK；返回上骨世界角度、下骨局部角度与可达性。 */
export function solveTwoBoneIK(options: TwoBoneIKOptions): TwoBoneIKResult {
  const values = [options.rootX, options.rootY, options.targetX, options.targetY,
    options.rootLength, options.tipLength, options.fallbackRotation ?? 0];
  if (!values.every(Number.isFinite) || options.rootLength <= 0 || options.tipLength <= 0) throw new Error('IK 坐标必须有限且骨长必须为正数');
  if (options.bendDirection !== 1 && options.bendDirection !== -1) throw new Error('IK 弯曲方向必须为 1 或 -1');
  const deltaX = options.targetX - options.rootX;
  const deltaY = options.targetY - options.rootY;
  const distance = Math.hypot(deltaX, deltaY);
  const minimum = Math.abs(options.rootLength - options.tipLength);
  const maximum = options.rootLength + options.tipLength;
  const clamped = Math.max(minimum, Math.min(maximum, distance));
  const cosine = (clamped ** 2 - options.rootLength ** 2 - options.tipLength ** 2)
    / (2 * options.rootLength * options.tipLength);
  const tipAngle = options.bendDirection * Math.acos(Math.max(-1, Math.min(1, cosine)));
  const direction = distance < EPSILON ? (options.fallbackRotation ?? 0) * DEGREES_TO_RADIANS : Math.atan2(deltaY, deltaX);
  const offset = distance < EPSILON && minimum < EPSILON ? 0
    : Math.atan2(options.tipLength * Math.sin(tipAngle), options.rootLength + options.tipLength * Math.cos(tipAngle));
  const rootAngle = direction - offset;
  return { rootRotation: rootAngle / DEGREES_TO_RADIANS, tipRotation: tipAngle / DEGREES_TO_RADIANS,
    reachable: distance >= minimum - EPSILON && distance <= maximum + EPSILON, distance,
    endX: options.rootX + options.rootLength * Math.cos(rootAngle) + options.tipLength * Math.cos(rootAngle + tipAngle),
    endY: options.rootY + options.rootLength * Math.sin(rootAngle) + options.tipLength * Math.sin(rootAngle + tipAngle) };
}
