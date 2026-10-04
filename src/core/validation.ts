import type { Animation, IKConstraint, Project } from './types';
import { projectSchema } from './schema';
import { CONNECTION_TOLERANCE, getBoneConnection } from './bone-connections';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function duplicateErrors(project: Project): string[] {
  const collections = [project.assets, project.bones, project.attachments,
    project.animations, project.ikConstraints];
  const seen = new Set<string>();
  return collections.flatMap((items) => items.flatMap((item) => {
    if (seen.has(item.id)) return [`对象 ID 重复：${item.id}`];
    seen.add(item.id);
    return [];
  }));
}

function hierarchyErrors(project: Project): string[] {
  const bones = new Map(project.bones.map((bone) => [bone.id, bone]));
  const errors: string[] = [];
  for (const bone of project.bones) {
    const visited = new Set([bone.id]);
    let parentId = bone.parentId;
    while (parentId !== null) {
      if (visited.has(parentId)) { errors.push(`骨骼层级存在循环：${bone.id}`); break; }
      visited.add(parentId);
      const parent = bones.get(parentId);
      if (!parent) { errors.push(`骨骼父节点不存在：${bone.id}`); break; }
      parentId = parent.parentId;
    }
  }
  return errors;
}

function keyErrors(keys: { time: number }[], duration: number, label: string): string[] {
  const errors: string[] = [];
  const times = new Set<number>();
  for (const key of keys) {
    if (key.time > duration) errors.push(`${label}关键帧超过动画时长`);
    if (times.has(key.time)) errors.push(`${label}关键帧时间重复：${key.time}`);
    times.add(key.time);
  }
  return errors;
}

function connectionErrors(project: Project): string[] {
  const lookup = new Map(project.bones.map((bone) => [bone.id, bone]));
  return project.bones.flatMap((bone) => {
    if (!bone.connection || bone.connection === 'none') return [];
    const parent = lookup.get(bone.parentId ?? '');
    if (!parent) return [`根骨骼不能声明父关节连接：${bone.name}`];
    const expectedX = bone.connection === 'tail' ? parent.length : 0;
    return Math.abs(bone.x - expectedX) > CONNECTION_TOLERANCE || Math.abs(bone.y) > CONNECTION_TOLERANCE
      ? [`骨骼共享关节坐标不一致：${bone.name}`] : [];
  });
}

function animationErrors(animation: Animation, boneIds: Set<string>): string[] {
  const tracks = new Set<string>();
  const errors: string[] = [];
  for (const track of animation.tracks) {
    if (!boneIds.has(track.boneId)) errors.push(`动画引用不存在的骨骼：${track.boneId}`);
    if (tracks.has(track.boneId)) errors.push(`动画骨骼轨道重复：${track.boneId}`);
    tracks.add(track.boneId);
    errors.push(...keyErrors(track.keyframes, animation.duration, animation.name));
  }
  return errors;
}

function constraintErrors(project: Project, constraint: IKConstraint): string[] {
  const root = project.bones.find((bone) => bone.id === constraint.rootBoneId);
  const tip = project.bones.find((bone) => bone.id === constraint.tipBoneId);
  if (!root || !tip) return [`IK 引用不存在的骨骼：${constraint.name}`];
  const errors: string[] = [];
  if (tip.parentId !== root.id || getBoneConnection(tip, root) !== 'tail' || Math.abs(tip.x - root.length) > CONNECTION_TOLERANCE
    || Math.abs(tip.y) > CONNECTION_TOLERANCE) errors.push(`IK 需要首尾相接的两根骨骼：${constraint.name}`);
  const animation = project.animations.find((item) => item.id === constraint.animationId);
  if (constraint.animationId && !animation) errors.push(`IK 引用不存在的动画：${constraint.name}`);
  const animations = animation ? [animation] : project.animations;
  const duration = Math.min(...animations.map((item) => item.duration), 600);
  errors.push(...keyErrors(constraint.targetKeys, duration, constraint.name));
  for (const item of animations) {
    const keys = item.tracks.find((track) => track.boneId === tip.id)?.keyframes ?? [];
    if (keys.some((key) => Math.abs(key.x - root.length) > CONNECTION_TOLERANCE
      || Math.abs(key.y) > CONNECTION_TOLERANCE)) errors.push(`IK 下骨关键帧必须保持连接：${constraint.name}`);
  }
  return errors;
}

function referenceErrors(project: Project): string[] {
  const assetIds = new Set(project.assets.map((asset) => asset.id));
  const boneIds = new Set(project.bones.map((bone) => bone.id));
  const errors: string[] = [];
  for (const attachment of project.attachments) {
    if (!assetIds.has(attachment.assetId)) errors.push(`部件素材不存在：${attachment.name}`);
    if (attachment.boneId && !boneIds.has(attachment.boneId)) errors.push(`部件绑定骨骼不存在：${attachment.name}`);
  }
  project.animations.forEach((animation) => errors.push(...animationErrors(animation, boneIds)));
  project.ikConstraints.forEach((constraint) => errors.push(...constraintErrors(project, constraint)));
  return errors;
}

function overlappingErrors(project: Project): string[] {
  const errors: string[] = [];
  for (const constraint of project.ikConstraints) {
    const overlaps = project.ikConstraints.some((other) => other.id !== constraint.id
      && (!other.animationId || !constraint.animationId || other.animationId === constraint.animationId)
      && [constraint.rootBoneId, constraint.tipBoneId].some((id) => id === other.rootBoneId || id === other.tipBoneId));
    if (overlaps) errors.push(`IK 骨链相互重叠：${constraint.name}`);
  }
  return errors;
}

/** 校验未知项目的结构、引用及动画边界；不会修改输入。 */
export function validateProject(input: unknown): ValidationResult {
  const result = projectSchema.safeParse(input);
  if (!result.success) return { valid: false, errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  const project: Project = result.data;
  const errors = [...duplicateErrors(project), ...hierarchyErrors(project),
    ...connectionErrors(project), ...referenceErrors(project), ...overlappingErrors(project)];
  return { valid: errors.length === 0, errors };
}

/** 从不可信输入读取项目；无效结构、循环和悬空引用均抛出可读错误。 */
export function parseProject(input: unknown): Project {
  const result = validateProject(input);
  if (!result.valid) throw new Error(`项目校验失败：${result.errors.join('；')}`);
  return projectSchema.parse(input);
}
