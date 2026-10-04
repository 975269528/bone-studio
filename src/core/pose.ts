import type { Bone, IKConstraint, Pose, SamplePoseOptions } from './types';
import { forwardKinematics, solveTwoBoneIK } from './kinematics';
import { sampleBoneTrack, sampleTargetTrack } from './sampling';

export { solveTwoBoneIK } from './kinematics';

function normalizedTime(time: number, duration: number, loop: boolean): number {
  if (!Number.isFinite(time)) throw new Error('采样时间必须是有限数值');
  if (time < 0) return 0;
  if (time <= duration) return time;
  return loop ? time % duration : Math.min(time, duration);
}

function boneDepth(bones: Bone[], id: string): number {
  const lookup = new Map(bones.map((bone) => [bone.id, bone]));
  let parentId = lookup.get(id)?.parentId;
  let depth = 0;
  while (parentId) {
    parentId = lookup.get(parentId)?.parentId;
    depth += 1;
    if (depth > bones.length) throw new Error('骨骼层级存在循环');
  }
  return depth;
}

function applyConstraint(options: { bones: Bone[]; constraint: IKConstraint; pose: Pose }): void {
  const { bones, constraint, pose } = options;
  const root = bones.find((bone) => bone.id === constraint.rootBoneId);
  const tip = bones.find((bone) => bone.id === constraint.tipBoneId);
  if (!root || !tip) throw new Error(`IK 骨骼不存在：${constraint.name}`);
  const worldRoot = pose.bones[root.id];
  const target = pose.ikTargets[constraint.id];
  const result = solveTwoBoneIK({ rootX: worldRoot.x, rootY: worldRoot.y,
    rootLength: root.length, tipLength: tip.length, targetX: target.x, targetY: target.y,
    bendDirection: constraint.bendDirection, fallbackRotation: worldRoot.rotation });
  root.rotation = result.rootRotation - (root.parentId ? pose.bones[root.parentId].rotation : 0);
  tip.rotation = result.tipRotation;
  pose.bones = forwardKinematics(bones);
  pose.ikDiagnostics.push({ constraintId: constraint.id, reachable: result.reachable, distance: result.distance });
}

/** 在秒时间轴上采样动画并求解 IK；所有计算独立于播放帧率且不修改项目。 */
export function samplePose(options: SamplePoseOptions): Pose {
  const animation = options.animationId ? options.project.animations.find((item) => item.id === options.animationId) : undefined;
  if (options.animationId && !animation) throw new Error(`动画不存在：${options.animationId}`);
  const time = animation ? normalizedTime(options.time, animation.duration, animation.loop) : normalizedTime(options.time, 600, false);
  const bones = options.project.bones.map((bone) => ({ ...bone }));
  for (const track of animation?.tracks ?? []) {
    const bone = bones.find((item) => item.id === track.boneId);
    const keyframe = sampleBoneTrack({ keys: track.keyframes, time, interpolation: track.interpolation });
    if (bone && keyframe) { bone.x = keyframe.x; bone.y = keyframe.y; bone.rotation = keyframe.rotation; }
  }
  const pose: Pose = { bones: forwardKinematics(bones), ikDiagnostics: [], ikTargets: {} };
  const constraints = options.project.ikConstraints.filter((item) => !item.animationId || item.animationId === animation?.id);
  pose.ikTargets = Object.fromEntries(constraints.map((constraint) => {
    const target = animation ? sampleTargetTrack({ keys: constraint.targetKeys, time }) : null;
    return [constraint.id, { x: target?.x ?? constraint.targetX, y: target?.y ?? constraint.targetY }];
  }));
  constraints.sort((left, right) => boneDepth(bones, left.rootBoneId) - boneDepth(bones, right.rootBoneId));
  constraints.filter((item) => item.enabled).forEach((constraint) => applyConstraint({ bones, constraint, pose }));
  return pose;
}
