import type { Project, ProjectCommand, SamplePoseOptions } from '@/core/types';
import type { EditorState } from './store';

export type PoseCommand = Extract<ProjectCommand, { type: 'keyframe.set' | 'ik.keyframe.set' }>;
export interface PoseDraft { commands: PoseCommand[]; project: Project }
export const POSE_DRAFT_HELP = '姿态未录帧，按 K 记录；切换时刻、动作或模式会清除。';

/** Resolve the visible pose; only the active animation and exact playhead include unrecorded edits. */
export function visiblePoseContext(state: EditorState, request?: Pick<SamplePoseOptions, 'animationId' | 'time'>): SamplePoseOptions {
  const animationId = request?.animationId === undefined ? state.animationId : request.animationId;
  const time = request?.time ?? state.time;
  const hasDraft = animationId !== null && animationId === state.animationId && time === state.time;
  return { project: hasDraft && state.poseDraft ? state.poseDraft.project : state.project, animationId, time };
}

/** Identify pose edits separately from explicit document commands and curve metadata edits. */
export function isPoseCommand(command: ProjectCommand): command is PoseCommand {
  return command.type === 'keyframe.set' || command.type === 'ik.keyframe.set';
}

/** Match pending transforms for one bone or IK target; drafts all belong to the active time. */
export function samePoseObject(left: PoseCommand, right: PoseCommand): boolean {
  if (left.type === 'keyframe.set' && right.type === 'keyframe.set') return left.boneId === right.boneId;
  return left.type === 'ik.keyframe.set' && right.type === 'ik.keyframe.set' && left.constraintId === right.constraintId;
}

/** Discard transient poses when their sampling context or canonical document changes. */
export function mustDiscardPose(state: EditorState, changes: Partial<EditorState>): boolean {
  return !!state.poseDraft && ((changes.project !== undefined && changes.project !== state.project)
    || (changes.revision !== undefined && changes.revision !== state.revision)
    || (changes.documentId !== undefined && changes.documentId !== state.documentId)
    || (changes.animationId !== undefined && changes.animationId !== state.animationId)
    || (changes.time !== undefined && changes.time !== state.time)
    || (changes.isAutoKeyframe !== undefined && changes.isAutoKeyframe !== state.isAutoKeyframe)
    || changes.isPlaying === true);
}
