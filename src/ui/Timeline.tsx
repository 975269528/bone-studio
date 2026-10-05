import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Plus, Play, Pause, SkipBack, Diamond, Repeat2, Copy, ClipboardPaste, Spline, FlipHorizontal2 } from 'lucide-react';
import type { Bone } from '@/core/types';
import { DeleteButton, NumberField, TextField } from './controls';
import { applyCommands, getEditorState, reportError, runCommand, updateEditor, useEditor } from './store';
import { recordCurrentKeyframe } from './auto-keyframe';
import { AutoKeyframeControls, PoseRecordingStatus } from './AutoKeyframeControls';
import type { CommitOptions } from './store';
import { setEditorMode } from './editor-modes';
import { TimelineRuler } from './TimelineRuler';
import { TimelineResize } from './TimelineResize';
import { seekTimeline, TIMELINE_LAYOUT } from './timeline-layout';
import { keyframeDeletionKey } from './delete-shortcut';
import { CurveEditor, TimelineCurveEditor } from './CurveEditor';
import { clearKeyframeSelection, copySelectedKeyframes, pasteKeyframes, pasteReversedKeyframes, selectKeyframe, useTimelineKeyframes } from './timeline-keyframes';
import { keyframeIdentity } from './keyframe-clipboard';
import type { KeyframeRef } from './keyframe-clipboard';
import { commitAnimationDuration } from './timeline-duration';
import './timeline-layout.css';

function usePlayback() {
  const { isPlaying, animationId, project } = useEditor();
  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0; let previous = performance.now();
    const tick = (now: number) => {
      const state = getEditorState(); const animation = state.project.animations.find(item => item.id === state.animationId);
      if (!animation) { updateEditor({ isPlaying: false }); return; }
      const next = state.time + (now - previous) / 1000; previous = now;
      updateEditor({ time: animation.loop ? next % animation.duration : Math.min(next, animation.duration), isPlaying: animation.loop || next < animation.duration });
      if (getEditorState().isPlaying) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, animationId, project.animations]);
}

/** Record selected bone transforms or an IK target in the current animation frame. */
export function recordKeyframe(): void {
  recordCurrentKeyframe();
}

function addAnimation() {
  const animation = { id: crypto.randomUUID(), name: `动作 ${getEditorState().project.animations.length + 1}`, duration: 2, fps: 24, loop: true, tracks: [] };
  try { applyCommands([{ type: 'animation.add', animation }]); setEditorMode({ mode: 'animation', animationId: animation.id }); }
  catch (error) { reportError(error); }
}

type TimelineView = 'keys' | 'curves';

function TimelineHeader(props: { view: TimelineView; onViewChange: (view: TimelineView) => void }) {
  const state = useEditor(); const animation = state.project.animations.find(item => item.id === state.animationId);
  const keys = useTimelineKeyframes();
  return <div className="timeline-header"><div className="toolbar-group"><span className="panel-label"><Diamond size={14} />时间轴</span>
    <select aria-label="当前动作" value={state.animationId ?? ''} onChange={event => setEditorMode(event.target.value ? { mode: 'animation', animationId: event.target.value } : { mode: 'rig' })}>
      <option value="">基础姿态</option>{state.project.animations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    <button className="icon-button" aria-label="添加动作" onClick={addAnimation}><Plus size={15} /></button>
    <div className="timeline-view-tabs" role="tablist" aria-label="时间轴视图"><button id="keyframe-view-tab" role="tab" aria-selected={props.view === 'keys'} aria-controls="keyframe-view" onClick={() => props.onViewChange('keys')}><Diamond size={12} />关键帧</button>
      <button id="curve-view-tab" role="tab" disabled={!animation} aria-selected={props.view === 'curves'} aria-controls="curve-view" onClick={() => props.onViewChange('curves')}><Spline size={13} />曲线</button></div></div>
    <div className="transport"><button className="icon-button" aria-label="返回起始帧" onClick={() => updateEditor({ time: 0 })}><SkipBack size={16} /></button>
      <button className="play-button" aria-label={state.isPlaying ? '暂停播放' : '播放动作'} disabled={!animation} onClick={() => updateEditor({ isPlaying: !state.isPlaying })}>{state.isPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}</button>
      <span className="time-code">{state.time.toFixed(2)} <small>/ {animation?.duration.toFixed(2) ?? '0.00'} s</small></span>
      <button className={`icon-button ${animation?.loop ? 'orange' : ''}`} disabled={!animation} aria-label="切换循环播放" onClick={() => { if (animation) runCommand({ type: 'animation.update', animationId: animation.id, changes: { loop: !animation.loop } }); }}><Repeat2 size={16} /></button></div>
    <div className="timeline-key-actions"><button className="icon-button" title="复制所选关键帧 (Ctrl/Cmd+C)" aria-label="复制关键帧" disabled={!keys.selected.length} onClick={copySelectedKeyframes}><Copy size={15} /></button>
      <button className="icon-button" title="粘贴到播放头 (Ctrl/Cmd+V)" aria-label="粘贴关键帧" disabled={!animation || !keys.clipboardCount} onClick={pasteKeyframes}><ClipboardPaste size={15} /></button>
      <button className="icon-button" title="将复制区间倒序粘贴到播放头，并反转缓动曲线" aria-label="倒序粘贴关键帧" disabled={!animation || !keys.clipboardCount} onClick={pasteReversedKeyframes}><FlipHorizontal2 size={15} /></button>
      <AutoKeyframeControls /></div></div>;
}

function TimelineKey(props: { refKey: KeyframeRef; trackKeys: KeyframeRef[]; duration: number; name: string }) {
  const state = useEditor(); const { selected } = useTimelineKeyframes();
  const isSelected = selected.some(key => keyframeIdentity(key) === keyframeIdentity(props.refKey));
  const command = props.refKey.kind === 'bone' ? { type: 'keyframe.remove' as const, animationId: state.animationId!, boneId: props.refKey.id, time: props.refKey.time }
    : { type: 'ik.keyframe.remove' as const, constraintId: props.refKey.id, time: props.refKey.time };
  const className = `key-diamond ${props.refKey.kind === 'ik' ? 'ik-key' : ''} ${Math.abs(state.time - props.refKey.time) < 0.01 ? 'current' : ''} ${isSelected ? 'key-selected' : ''}`;
  return <button className={className} data-keyframe-delete={keyframeDeletionKey(command)} aria-keyshortcuts="Delete" aria-pressed={isSelected}
    style={{ left: `${props.refKey.time / props.duration * 100}%` }} aria-label={`${props.name} ${props.refKey.time.toFixed(2)} 秒关键帧`}
    onClick={event => selectKeyframe({ ref: props.refKey, trackKeys: props.trackKeys, additive: event.ctrlKey || event.metaKey, range: event.shiftKey })} />;
}

function selectTrack(selection: { kind: 'bone' | 'ik'; id: string }): void {
  updateEditor({ selection }); clearKeyframeSelection();
}

function TimelineRow(props: { bone: Bone; duration: number }) {
  const state = useEditor(); const animation = state.project.animations.find(item => item.id === state.animationId);
  const track = animation?.tracks.find(item => item.boneId === props.bone.id);
  const keys: KeyframeRef[] = track?.keyframes.map(key => ({ kind: 'bone', id: props.bone.id, time: key.time })) ?? [];
  return <div className={`timeline-row ${state.selection?.id === props.bone.id ? 'selected' : ''}`}>
    <button className="track-name" onClick={() => selectTrack({ kind: 'bone', id: props.bone.id })}><Diamond size={10} />{props.bone.name}</button>
    <div className="track-line" onClick={event => { if (event.target === event.currentTarget) clearKeyframeSelection(); }}>{keys.map(ref => <TimelineKey key={ref.time} refKey={ref} trackKeys={keys} duration={props.duration} name={props.bone.name} />)}</div>
  </div>;
}

function TimelineIKRow(props: { id: string; duration: number }) {
  const state = useEditor(); const constraint = state.project.ikConstraints.find(item => item.id === props.id)!;
  const keys: KeyframeRef[] = constraint.targetKeys.map(key => ({ kind: 'ik', id: constraint.id, time: key.time }));
  return <div className={`timeline-row ${state.selection?.id === constraint.id ? 'selected' : ''}`}>
    <button className="track-name orange" onClick={() => selectTrack({ kind: 'ik', id: constraint.id })}>⊕ {constraint.name}</button>
    <div className="track-line" onClick={event => { if (event.target === event.currentTarget) clearKeyframeSelection(); }}>{keys.map(ref => <TimelineKey key={ref.time} refKey={ref} trackKeys={keys} duration={props.duration} name={constraint.name} />)}</div></div>;
}

function TimelineTracks() {
  const state = useEditor(); const animation = state.project.animations.find(item => item.id === state.animationId);
  const scroll = useRef<HTMLDivElement>(null); const [gutter, setGutter] = useState(0);
  useLayoutEffect(() => {
    const element = scroll.current; if (!element) return;
    const measure = () => setGutter(element.offsetWidth - element.clientWidth);
    const observer = new ResizeObserver(measure); observer.observe(element); measure(); return () => observer.disconnect();
  }, [animation?.id]);
  if (!animation) return <div className="timeline-empty"><Diamond size={22} /><span>选择或添加动作，开始记录你的第一个姿态。</span><button onClick={addAnimation}>添加动作</button></div>;
  return <div className="timeline-tracks" style={{ '--track-gutter': `${gutter}px` } as CSSProperties}><TimelineRuler duration={animation.duration} fps={animation.fps} time={state.time} />
    <div className="track-viewport"><div className="tracks-scroll" ref={scroll}>
      {state.project.bones.map(bone => <TimelineRow key={bone.id} bone={bone} duration={animation.duration} />)}
      {state.project.ikConstraints.filter(constraint => !constraint.animationId || constraint.animationId === animation.id).map(constraint => <TimelineIKRow key={constraint.id} id={constraint.id} duration={animation.duration} />)}
    </div><div className="playhead" style={{ left: `calc(150px + (100% - 174px - var(--track-gutter)) * ${state.time / animation.duration})` }} /></div>
    <div className="scrubber"><span><output>{state.time.toFixed(2)} s</output><small>拖动定位</small></span><div className="scrubber-range"><input aria-label="时间轴定位" type="range" min={0} max={animation.duration} step="any" value={state.time}
      onChange={event => updateEditor({ time: seekTimeline({ ratio: Number(event.target.value) / animation.duration, duration: animation.duration, fps: animation.fps }), isPlaying: false })} /></div></div></div>;
}

function AnimationSettings() {
  const state = useEditor(); const animation = state.project.animations.find(item => item.id === state.animationId);
  if (!animation) return null;
  const update = (changes: Partial<typeof animation>, options?: CommitOptions) => runCommand({ type: 'animation.update', animationId: animation.id, changes }, options);
  const selectedTrack = animation.tracks.find(track => track.boneId === state.selection?.id);
  const selectedIK = state.project.ikConstraints.find(constraint => constraint.id === state.selection?.id);
  const keyframe = selectedTrack?.keyframes.find(key => Math.abs(key.time - state.time) < 0.001);
  const targetKey = selectedIK?.targetKeys.find(key => Math.abs(key.time - state.time) < 0.001);
  return <div className="animation-settings"><TextField key={animation.id} label="动作名称" value={animation.name} onChange={name => update({ name })} />
    <div className="property-grid"><NumberField label="时长 / 秒" min={1 / 120} max={600} step={1 / animation.fps} value={animation.duration} onChange={commitAnimationDuration} />
      <NumberField label="帧率 / FPS" isInteger min={1} max={120} step={1} value={animation.fps} onChange={(fps, options) => update({ fps }, options)} /></div>
    <CurveEditor />
    {(keyframe || targetKey) && <DeleteButton label="删除当前关键帧" command={keyframe ? { type: 'keyframe.remove', animationId: animation.id, boneId: selectedTrack!.boneId, time: keyframe.time } : { type: 'ik.keyframe.remove', constraintId: selectedIK!.id, time: targetKey!.time }} />}
    <DeleteButton label="删除动作" command={{ type: 'animation.remove', animationId: animation.id }} /></div>;
}

/** Playback, seek, inspect and record the current animation's bone and IK tracks. */
export function Timeline() {
  usePlayback(); const [height, setHeight] = useState<number>(TIMELINE_LAYOUT.initial);
  const [view, setView] = useState<TimelineView>('keys');
  const handleViewChange = (next: TimelineView) => { setView(next); if (next === 'curves') setHeight(current => Math.max(current, 360)); };
  return <section className="timeline panel" style={{ height }}><TimelineResize height={height} onResize={setHeight} /><TimelineHeader view={view} onViewChange={handleViewChange} /><PoseRecordingStatus />
    <div className="timeline-body"><div className="timeline-main-view" id={view === 'keys' ? 'keyframe-view' : 'curve-view'} role="tabpanel" aria-labelledby={view === 'keys' ? 'keyframe-view-tab' : 'curve-view-tab'}>
      {view === 'keys' ? <TimelineTracks /> : <TimelineCurveEditor />}</div><AnimationSettings /></div></section>;
}
