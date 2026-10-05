import { Diamond } from 'lucide-react';
import { useEditor } from './store';
import { recordCurrentKeyframe, setAutoKeyframe } from './auto-keyframe';
import { POSE_DRAFT_HELP } from './pose-preview';

/** Session-only Auto K and explicit recording of the selected bone or IK target. */
export function AutoKeyframeControls() {
  const state = useEditor(); const selection = state.selection;
  const constraint = selection?.kind === 'ik' ? state.project.ikConstraints.find(item => item.id === selection.id) : undefined;
  const canRecord = !!state.animationId && (selection?.kind === 'bone'
    || (selection?.kind === 'ik' && !!constraint && (!constraint.animationId || constraint.animationId === state.animationId)));
  return <div className="auto-key-controls"><button className={`auto-key-toggle ${state.isAutoKeyframe ? 'enabled' : ''}`}
    title="开启后，动画模式下调整骨骼或 IK 目标会在当前时刻创建或更新关键帧。Enter 切换开关，Space 播放动作。开关只影响手动编辑，不影响 AI 命令。"
    role="switch" aria-label="自动 K 帧" aria-checked={state.isAutoKeyframe} disabled={!state.animationId} onClick={() => setAutoKeyframe(!state.isAutoKeyframe)}>
    <span aria-hidden="true" className="auto-key-indicator" />自动 K <small>{state.isAutoKeyframe ? '开' : '关'}</small></button>
    <button className="key-button" aria-label="记录关键帧" aria-keyshortcuts="K" disabled={!canRecord}
      title="记录所选骨骼或 IK 目标的当前姿态 · K（输入框中不触发）" onClick={recordCurrentKeyframe}><Diamond size={13} />记录关键帧 <kbd>K</kbd></button></div>;
}

/** Keep recording policy and pending-pose persistence visible alongside the timeline. */
export function PoseRecordingStatus() {
  const state = useEditor();
  const help = state.poseDraft ? `${POSE_DRAFT_HELP} 待录姿态不会保存或导出。`
    : !state.animationId ? '骨架模式 · 编辑基础骨架，不记录动画关键帧。'
      : state.isAutoKeyframe ? '自动 K 开启 · 调整骨骼或 IK 目标会记录到当前时刻。'
        : '自动 K 关闭 · 调整后按 K 记录所选骨骼或 IK 目标；未录姿态不会保存或导出。';
  return <div className={`timeline-pose-status ${state.poseDraft ? 'pending' : ''}`} role="status">{help}</div>;
}
