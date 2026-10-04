import type { Bone, Project, ProjectCommand } from './types';
import { materializeConnections } from './bone-connections';
import { rebuildBoneFrames, shareJointPoints, snapshotBonePoints } from './bone-joints';
import type { BonePoints, JointPoint, RigPoints } from './bone-joints';
import { restoreImageFrames, snapshotImageFrames } from './rig-images';
import { syncIKTipKeys } from './update-bone';

type EditCommand = Extract<ProjectCommand, { type: 'bone.edit' }>;
type ReparentCommand = Extract<ProjectCommand, { type: 'bone.reparent' }>;

function requireBone(project: Project, boneId: string): Bone {
  const bone = project.bones.find((item) => item.id === boneId);
  if (!bone) throw new Error(`操作对象不存在：${boneId}`);
  return bone;
}

function translatePoints(points: BonePoints, delta: JointPoint): void {
  new Set([points.head, points.tail]).forEach((point) => {
    point.x += delta.x;
    point.y += delta.y;
  });
}

function finishRigEdit(options: { project: Project; points: RigPoints;
  lengths: Map<string, number>; images?: ReturnType<typeof snapshotImageFrames> }): void {
  const { project, points, lengths, images } = options;
  rebuildBoneFrames(project.bones, points);
  project.bones.forEach((bone) => {
    if (bone.length !== lengths.get(bone.id)) syncIKTipKeys(project, bone.id, bone.length);
  });
  if (images) restoreImageFrames(project, images);
}

/** 编辑基础世界头、尾或骨身；移动共享关节，其他世界端点固定，默认补偿图片。 */
export function editRigBone(project: Project, command: EditCommand): void {
  requireBone(project, command.boneId);
  const images = command.keepImages === false ? undefined : snapshotImageFrames(project);
  const lengths = new Map(project.bones.map((bone) => [bone.id, bone.length]));
  materializeConnections(project.bones);
  const points = snapshotBonePoints(project.bones);
  shareJointPoints(project.bones, points);
  const selected = points.get(command.boneId)!;
  if (command.endpoint === 'body') {
    translatePoints(selected, { x: command.x - selected.head.x, y: command.y - selected.head.y });
  } else {
    Object.assign(selected[command.endpoint], { x: command.x, y: command.y });
  }
  finishRigEdit({ project, points, lengths, images });
}

function validateParent(project: Project, command: ReparentCommand): void {
  let parentId = command.parentId;
  const visited = new Set<string>();
  while (parentId) {
    if (parentId === command.boneId || visited.has(parentId)) throw new Error('换父失败：不能连接自身或后代骨骼');
    visited.add(parentId);
    parentId = requireBone(project, parentId).parentId;
  }
  if (!command.parentId && command.connection && command.connection !== 'none') {
    throw new Error('换父失败：根骨骼不能连接父关节');
  }
}

function moveReparentedBone(options: { project: Project; command: ReparentCommand; points: RigPoints }): void {
  const { project, command, points } = options;
  const bone = requireBone(project, command.boneId);
  bone.parentId = command.parentId;
  bone.connection = 'none';
  shareJointPoints(project.bones, points);
  const connection = command.connection ?? 'none';
  if (command.parentId && connection !== 'none') {
    const target = points.get(command.parentId)![connection];
    const selected = points.get(bone.id)!;
    translatePoints(selected, { x: target.x - selected.head.x, y: target.y - selected.head.y });
  }
  bone.connection = connection;
}

/** 保全基础世界骨架换父；显式连接时吸附骨头并平移骨身和其共享关节。 */
export function reparentRigBone(project: Project, command: ReparentCommand): void {
  requireBone(project, command.boneId);
  validateParent(project, command);
  const images = command.keepImages === false ? undefined : snapshotImageFrames(project);
  const lengths = new Map(project.bones.map((bone) => [bone.id, bone.length]));
  materializeConnections(project.bones);
  const points = snapshotBonePoints(project.bones);
  moveReparentedBone({ project, command, points });
  finishRigEdit({ project, points, lengths, images });
}
