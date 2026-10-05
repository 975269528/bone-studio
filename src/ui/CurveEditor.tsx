import type { BezierCurve, Interpolation } from '@/core/types';
import { NumberField } from './controls';
import { getEditorState, runCommand, updateEditor, useEditor } from './store';
import type { CommitOptions } from './store';
import { CURVE_PRESETS, curveEditCommand, selectedCurveSegment, selectedCurveTrack } from './curve-editor';
import type { CurveSegment, CurveTrack } from './curve-editor';
import { CurveGraph } from './CurveGraph';
import { selectKeyframe } from './timeline-keyframes';
import { CurveTransferControls } from './CurveTransferControls';
import './curve-editor.css';

function commitCurve(options: { segment: CurveSegment; interpolation: Interpolation; curve?: BezierCurve }, commit?: CommitOptions): void {
  const current = selectedCurveSegment(getEditorState());
  if (current?.id !== options.segment.id || current.nextTime === undefined) return;
  updateEditor({ isPlaying: false });
  runCommand(curveEditCommand({ ...options, segment: current }), commit);
}

function CurveInterpolation(props: { segment: CurveSegment; label?: string }) {
  const { segment } = props;
  return <label className="field full"><span>当前关键帧 · 出段缓动</span>
    <select aria-label={props.label ?? '当前关键帧出段缓动'} disabled={segment.nextTime === undefined} value={segment.interpolation}
      onChange={event => commitCurve({ segment, interpolation: event.target.value as Interpolation })}>
      <option value="linear">线性 · 匀速</option><option value="smooth">平滑 · 缓入缓出</option>
      <option value="step">阶梯 · 保持后跳变</option><option value="step-start">阶梯 · 起始后跳变</option><option value="bezier">贝塞尔 · 自定义曲线</option>
    </select></label>;
}

function CurveControls(props: { segment: CurveSegment }) {
  const { segment } = props;
  const hasNext = segment.nextTime !== undefined;
  const handleChange = (curve: BezierCurve, options?: CommitOptions) => commitCurve({ segment, interpolation: 'bezier', curve }, options);
  return <aside className="curve-workspace-controls"><CurveInterpolation segment={segment} label="曲线编辑器缓动方式" />
    <div className="curve-presets" aria-label="常用缓动预设">{CURVE_PRESETS.map(preset =>
      <button key={preset.name} disabled={!hasNext} onClick={() => handleChange(preset.curve)}>{preset.name}</button>)}</div>
    <div className="curve-coordinates">{(['x1', 'y1', 'x2', 'y2'] as const).map(coordinate =>
      <NumberField key={coordinate} label={`${coordinate[0].toUpperCase()}${coordinate[1]} 控制点`} min={0} max={1} step={0.01}
        disabled={!hasNext || segment.interpolation !== 'bezier'} value={segment.curve[coordinate]}
        onChange={(value, options) => handleChange({ ...segment.curve, [coordinate]: value }, options)} />)}</div>
    <p className="curve-note">贝塞尔圆点可拖动；输入 0–1，方向键微调。每次拖动只记一次撤销。</p>
  </aside>;
}

function seekCurveKey(track: CurveTrack, time: number): void {
  selectKeyframe({ ref: { kind: track.kind, id: track.ownerId, time },
    trackKeys: track.keys.map(key => ({ kind: track.kind, id: track.ownerId, time: key.time })), additive: false, range: false });
}

function CurveKeyNavigation(props: { track: CurveTrack; segment: CurveSegment | null }) {
  const { track, segment } = props;
  const keys = [...track.keys].sort((left, right) => left.time - right.time);
  const selectedIndex = keys.findIndex(key => key.time === segment?.keyframe.time);
  return <div className="curve-key-navigation"><strong title={track.name}>{track.kind === 'ik' ? '⊕ ' : ''}{track.name}</strong>
    <button aria-label="选择前一关键帧" disabled={selectedIndex <= 0} onClick={() => seekCurveKey(track, keys[selectedIndex - 1].time)}>‹</button>
    <select aria-label="曲线关键帧" value={segment?.keyframe.time ?? ''} onChange={event => seekCurveKey(track, Number(event.target.value))}>
      <option value="" disabled>选择关键帧</option>{keys.map(key => <option key={key.time} value={key.time}>{key.time.toFixed(3)} 秒</option>)}
    </select><button aria-label="选择下一关键帧" disabled={!keys.length || selectedIndex === keys.length - 1}
      onClick={() => seekCurveKey(track, keys[selectedIndex + 1].time)}>›</button>
    <CurveTransferControls segment={segment} />
  </div>;
}

/** 在时间轴属性侧栏展示出段插值；完整曲线编辑器位于时间轴的曲线标签页。 */
export function CurveEditor() {
  const state = useEditor(); const segment = selectedCurveSegment(state);
  if (!segment) return state.selection?.kind === 'bone' || state.selection?.kind === 'ik'
    ? <p className="curve-note">在“曲线”标签选择关键帧，调整它到下一帧的缓动。</p> : null;
  return <div className="curve-editor"><CurveInterpolation segment={segment} />
    <p className="curve-segment-label">{segment.nextTime === undefined ? '最后一帧：前一段由前一帧控制。'
      : `${segment.keyframe.time.toFixed(2)} → ${segment.nextTime.toFixed(2)} 秒 · 完整编辑见“曲线”标签`}</p></div>;
}

/** 在时间轴原位置编辑归一化出段缓动，不改变关键帧的姿态数值。 */
export function TimelineCurveEditor() {
  const state = useEditor(); const track = selectedCurveTrack(state); const segment = selectedCurveSegment(state);
  if (!track) return <div className="timeline-empty"><strong>选择骨骼或 IK 轨道</strong><span>选择骨骼或 IK，再选择关键帧调整它到下一帧的缓动。</span></div>;
  return <section className="curve-workspace" aria-label="时间轴缓动曲线编辑器"><CurveKeyNavigation track={track} segment={segment} />
    {segment ? <div className="curve-workspace-body"><div className="curve-workspace-plot">
      <p className="curve-segment-label">{segment.nextTime === undefined ? '最后一个关键帧，没有下一段；请选前一帧。'
        : `${segment.keyframe.time.toFixed(3)} → ${segment.nextTime.toFixed(3)} 秒 · ${segment.kind === 'bone' ? 'X、Y、旋转' : '目标 X、Y'}共用缓动`}</p>
      <CurveGraph key={segment.id} curve={segment.curve} interpolation={segment.interpolation}
        onChange={segment.nextTime === undefined ? undefined : (curve, options) => commitCurve({ segment, interpolation: 'bezier', curve }, options)} />
      <p className="curve-note">横轴：本段时间进度 0–1 · 纵轴：变化进度 0–1</p>
    </div><CurveControls segment={segment} /></div>
      : <div className="timeline-empty"><span>{track.keys.length ? '选择上方关键帧，编辑它到下一帧的缓动。' : '此轨道尚无关键帧，请先记录两个姿态。'}</span></div>}
  </section>;
}
