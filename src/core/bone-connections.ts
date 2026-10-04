import type { Bone, BoneConnection } from './types';

export const CONNECTION_TOLERANCE = 0.0001;

/** 读取基础骨架的共享关节关系；旧版无标记项目按父骨局部坐标推断。 */
export function getBoneConnection(bone: Bone, parent?: Bone): BoneConnection {
  if (!parent) return 'none';
  if (bone.connection !== undefined) return bone.connection;
  if (Math.abs(bone.y) > CONNECTION_TOLERANCE) return 'none';
  if (Math.abs(bone.x - parent.length) <= CONNECTION_TOLERANCE) return 'tail';
  return Math.abs(bone.x) <= CONNECTION_TOLERANCE ? 'head' : 'none';
}

/** 固定当前推断关系，避免编辑后偶然重叠被当作新连接；只用于事务副本。 */
export function materializeConnections(bones: Bone[]): void {
  const lookup = new Map(bones.map((bone) => [bone.id, bone]));
  bones.forEach((bone) => { bone.connection = getBoneConnection(bone, lookup.get(bone.parentId ?? '')); });
}
