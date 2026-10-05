import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Plus, Play, Pause, SkipBack, Diamond, Repeat2 } from 'lucide-react';
import type { Bone } from '@/core/types';
import { DeleteButton, NumberField, TextField } from './controls';
import { applyCommands, getEditorState, reportError, runCommand, updateEditor, useEditor } from './store';
import { displayedTarget } from './pose-edit';
import { boneKeyframeCommand } from './bone-edit';
import type { CommitOptions } from './store';
import { setEditorMode } from './editor-modes';
import { TimelineRuler } from './TimelineRuler';
import { TimelineResize } from './TimelineResize';
import { seekTimeline, TIMELINE_LAYOUT } from './timeline-layout';
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
  const state = getEditorState(); const selection = state.selection;
  if (!selection || !state.animationId) { updateEditor({ message: '请先选择一个骨骼或 IK 约束，并选择动作。' }); return; }
  if (selection.kind === 'ik') {
    const constraint = state.project.ikConstraints.find(item => item.id === selection.id)!;
    if (constraint.animationId && constraint.animationId !== state.animationId) {
      updateEditor({ message: '请切换到此 IK 约束关联的动作，再记录目标关键帧。' }); return;
    }
    const target = displayedTarget(constraint);
    runCommand({ type: 'ik.keyframe.set', constraintId: constraint.id, keyframe: { time: state.time, x: target.targetX, y: target.targetY } });
  } else if (selection.kind === 'bone') {
    const bone = state.project.bones.find(item => item.id === selection.id);
    if (bone) runCommand(boneKeyframeCommand(state, bone));
  } else updateEditor({ message: '图片随绑定骨骼移动，请选择绑定的骨骼记录关键帧。' });
}

function addAnimation() {
  const animation = { id: crypto.randomUUID(), name: `动作 ${getEditorState().project.animations.length + 1}`, duration: 2, fps: 24, loop: true, tracks: [] };
  try { applyCommands([{ type: 'animation.add', animation }]); setEditorMode({ mode: 'animation', animationId: animation.id }); }
  catch (error) { reportError(error); }
}

function TimelineHeader() {
  const state = useEditor(); const animation = state.project.animations.find(item => item.id === state.animationId);
  return <div className="timeline-header"><div className="toolbar-group"><span className="panel-label"><Diamond size={14} />时间轴</span>
    <select aria-label="当前动作" value={state.animationId ?? ''} onChange={event => setEditorMode(event.target.value ? { mode: 'animation', animationId: event.target.value } : { mode: 'rig' })}>
      <option value="">基础姿态</option>{state.project.animations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    <button className="icon-button" aria-label="添加动作" onClick={addAnimation}><Plus size={15} /></button></div>
    <div className="transport"><button className="icon-button" aria-label="返回起始帧" onClick={() => updateEditor({ time: 0 })}><SkipBack size={16} /></button>
      <button className="play-button" aria-label={state.isPlaying ? '暂停播放' : '播放动作'} disabled={!animation} onClick={() => updateEditor({ isPlaying: !state.isPlaying })}>{state.isPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}</button>
      <span className="time-code">{state.time.toFixed(2)} <small>/ {animation?.duration.toFixed(2) ?? '0.00'} s</small></span>
      <button className={`icon-button ${animation?.loop ? 'orange' : ''}`} disabled={!animation} aria-label="切换循环播放" onClick={() => { if (animation) runCommand({ type: 'animation.update', animationId: animation.id, changes: { loop: !animation.loop } }); }}><Repeat2 size={16} /></button></div>
    <button className="key-button" disabled={!animation} onClick={recordKeyframe}><Diamond size={13} />记录关键帧 <kbd>K</kbd></button></div>;
}

function TimelineRow(props: { bone: Bone; duration: number }) {
  const state = useEditor(); const animation = state.project.animations.find(item => item.id === state.animationId);
  const track = animation?.tracks.find(item => item.boneId === props.bone.id);
  return <div className={`timeline-row ${state.selection?.id === props.bone.id ? 'selected' : ''}`}>
    <button className="track-name" onClick={() => updateEditor({ selection: { kind: 'bone', id: props.bone.id } })}><Diamond size={10} />{props.bone.name}</button>
    <div className="track-line">{track?.keyframes.map(keyframe => <button key={keyframe.time} className={`key-diamond ${Math.abs(state.time - keyframe.time) < 0.01 ? 'current' : ''}`}
      style={{ left: `${keyframe.time / props.duration * 100}%` }} aria-label={`${props.bone.name} ${keyframe.time.toFixed(2)} 秒关键帧`}
      onClick={() => updateEditor({ time: keyframe.time, isPlaying: false, selection: { kind: 'bone', id: props.bone.id } })} />)}</div>
  </div>;
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
      {state.project.ikConstraints.filter(constraint => !constraint.animationId || constraint.animationId === animation.id).map(constraint => <div className="timeline-row" key={constraint.id}>
        <button className="track-name orange" onClick={() => updateEditor({ selection: { kind: 'ik', id: constraint.id } })}>⊕ {constraint.name}</button><div className="track-line">{constraint.targetKeys.map(keyframe => <button className="key-diamond ik-key" key={keyframe.time}
          style={{ left: `${keyframe.time / animation.duration * 100}%` }} aria-label={`${constraint.name} ${keyframe.time}秒目标帧`} onClick={() => updateEditor({ time: keyframe.time, isPlaying: false, selection: { kind: 'ik', id: constraint.id } })} />)}</div></div>)}
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
    <div className="property-grid"><NumberField label="时长 / 秒" min={0.1} max={120} step={0.1} value={animation.duration} onChange={(duration, options) => update({ duration }, options)} />
      <NumberField label="帧率 / FPS" isInteger min={1} max={120} step={1} value={animation.fps} onChange={(fps, options) => update({ fps }, options)} /></div>
    {selectedTrack && <label className="field full"><span>插值</span><select value={selectedTrack.interpolation} onChange={event => update({ tracks: animation.tracks.map(track => track === selectedTrack ? { ...track, interpolation: event.target.value as 'linear' | 'smooth' | 'step' } : track) })}>
      <option value="linear">线性</option><option value="smooth">平滑</option><option value="step">阶梯</option></select></label>}
    {(keyframe || targetKey) && <DeleteButton label="删除当前关键帧" command={keyframe ? { type: 'keyframe.remove', animationId: animation.id, boneId: selectedTrack!.boneId, time: keyframe.time } : { type: 'ik.keyframe.remove', constraintId: selectedIK!.id, time: targetKey!.time }} />}
    <DeleteButton label="删除动作" command={{ type: 'animation.remove', animationId: animation.id }} /></div>;
}

/** Playback, seek, inspect and record the current animation's bone and IK tracks. */
export function Timeline() {
  usePlayback(); const [height, setHeight] = useState<number>(TIMELINE_LAYOUT.initial);
  return <section className="timeline panel" style={{ height }}><TimelineResize height={height} onResize={setHeight} /><TimelineHeader /><div className="timeline-body"><TimelineTracks /><AnimationSettings /></div></section>;
}
