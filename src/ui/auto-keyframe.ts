import { executeCommands, samplePose } from '@/core/api';
import type { ProjectCommand } from '@/core/types';
import { applyCommands, getEditorState, reportError, updateEditor } from './store';
import type { CommitOptions } from './store';
import { boneKeyframeCommand } from './bone-edit';
import { isPoseCommand, POSE_DRAFT_HELP, samePoseObject, visiblePoseContext } from './pose-preview';
import type { PoseCommand } from './pose-preview';

/** Apply a UI pose edit according to Auto K; explicit core/MCP commands bypass this policy. */
export function applyPoseEdit(command: ProjectCommand, options?: CommitOptions): void {
  const state = getEditorState();
  if (!isPoseCommand(command) || !state.animationId || state.isAutoKeyframe) {
    applyCommands([command], options); return;
  }
  const commands = [...(state.poseDraft?.commands.filter(item => !samePoseObject(item, command)) ?? []), command];
  const project = executeCommands({ project: state.project, commands });
  updateEditor({ poseDraft: { commands, project }, isPlaying: false,
    ...(state.poseDraft ? {} : { message: POSE_DRAFT_HELP }) });
}

/** Present errors from UI pose edits while keeping the current draft and document intact. */
export function runPoseEdit(command: ProjectCommand, options?: CommitOptions): void {
  try { applyPoseEdit(command, options); }
  catch (error) { reportError(error); }
}

function selectedPoseCommand(): PoseCommand {
  const state = getEditorState(); const selection = state.selection;
  if (!state.animationId) throw new Error('请切换到动画模式，再按 K 记录关键帧。');
  const context = visiblePoseContext(state);
  if (selection?.kind === 'bone') {
    const bone = state.project.bones.find(item => item.id === selection.id);
    if (bone) {
      const command = boneKeyframeCommand(context, bone);
      if (isPoseCommand(command)) return command;
    }
  }
  if (selection?.kind === 'ik') {
    const constraint = state.project.ikConstraints.find(item => item.id === selection.id);
    if (constraint && (!constraint.animationId || constraint.animationId === state.animationId)) {
      const target = samplePose(context).ikTargets[constraint.id];
      return { type: 'ik.keyframe.set', constraintId: constraint.id, keyframe: { time: state.time, x: target?.x ?? constraint.targetX, y: target?.y ?? constraint.targetY } };
    }
    throw new Error('请切换到此 IK 约束关联的动作，再记录目标关键帧。');
  }
  throw new Error('请先选择一个骨骼或 IK 目标，再按 K 记录关键帧。');
}

/** Record the selected visible transform atomically; retain drafts for other selected objects. */
export function recordCurrentKeyframe(): void {
  try {
    const state = getEditorState(); const command = selectedPoseCommand();
    const commands = state.poseDraft?.commands.filter(item => !samePoseObject(item, command)) ?? [];
    const project = executeCommands({ project: state.project, commands: [command] });
    const poseDraft = commands.length ? { commands, project: executeCommands({ project, commands }) } : null;
    applyCommands([command]);
    updateEditor({ poseDraft, isPlaying: false, message: poseDraft ? `当前对象已录帧。${POSE_DRAFT_HELP}` : '当前对象已记录关键帧。' });
  } catch (error) { reportError(error); }
}

/** Toggle session-only Auto K without recording any pending transform. */
export function setAutoKeyframe(isAutoKeyframe: boolean): void {
  updateEditor({ isAutoKeyframe, message: isAutoKeyframe ? '自动 K 已开启：调整骨骼或 IK 目标会记录当前帧。' : '自动 K 已关闭：调整后按 K 记录所选骨骼或 IK 目标。' });
}
