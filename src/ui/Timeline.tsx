import { useEffect } from 'react';
import { Plus, Play, Pause, SkipBack, Diamond, Repeat2, ChevronDown } from 'lucide-react';
import { samplePose } from '@/core/api';
import type { Bone } from '@/core/types';
import { DeleteButton, NumberField, TextField } from './controls';
import { applyCommands, getEditorState, reportError, runCommand, updateEditor, useEditor } from './store';
import { displayedTarget } from './pose-edit';

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
  const pose = samplePose({ project: state.project, animationId: state.animationId, time: state.time });
  if (selection.kind === 'ik') {
    const constraint = state.project.ikConstraints.find(item => item.id === selection.id)!;
    if (constraint.animationId && constraint.animationId !== state.animationId) {
      updateEditor({ message: '请切换到此 IK 约束关联的动作，再记录目标关键帧。' }); return;
    }
    const target = displayedTarget(constraint);
    runCommand({ type: 'ik.keyframe.set', constraintId: constraint.id, keyframe: { time: state.time, x: target.targetX, y: target.targetY } });
  } else if (selection.kind === 'bone') {
    const bone = pose.bones[selection.id]; const parent = bone.parentId ? pose.bones[bone.parentId] : undefined;
    const radians = (parent?.rotation ?? 0) * Math.PI / 180;
    const deltaX = bone.x - (parent?.x ?? 0); const deltaY = bone.y - (parent?.y ?? 0);
    runCommand({ type: 'keyframe.set', animationId: state.animationId, boneId: bone.id, keyframe: {
      time: state.time, x: deltaX * Math.cos(radians) + deltaY * Math.sin(radians),
      y: -deltaX * Math.sin(radians) + deltaY * Math.cos(radians), rotation: bone.rotation - (parent?.rotation ?? 0) } });
  } else updateEditor({ message: '图片随绑定骨骼移动，请选择绑定的骨骼记录关键帧。' });
}

function addAnimation() {
  const animation = { id: crypto.randomUUID(), name: `动作 ${getEditorState().project.animations.length + 1}`, duration: 2, fps: 24, loop: true, tracks: [] };
  try { applyCommands([{ type: 'animation.add', animation }]); updateEditor({ animationId: animation.id, time: 0, isPlaying: false }); }
  catch (error) { reportError(error); }
}

function TimelineHeader() {
  const state = useEditor(); const animation = state.project.animations.find(item => item.id === state.animationId);
  return <div className="timeline-header"><div className="toolbar-group"><span className="panel-label"><Diamond size={14} />时间轴</span>
    <select aria-label="当前动作" value={state.animationId ?? ''} onChange={event => updateEditor({ animationId: event.target.value || null, time: 0, isPlaying: false })}>
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
  if (!animation) return <div className="timeline-empty"><Diamond size={22} /><span>选择或添加动作，开始记录你的第一个姿态。</span><button onClick={addAnimation}>添加动作</button></div>;
  const ticks = Array.from({ length: 9 }, (_, index) => animation.duration * index / 8);
  return <div className="timeline-tracks"><div className="ruler"><span className="ruler-label">骨骼轨道 <ChevronDown size={12} /></span><div>{ticks.map(time => <span key={time} style={{ left: `${time / animation.duration * 100}%` }}>{time.toFixed(2)}</span>)}</div></div>
    <div className="tracks-scroll"><div className="playhead" style={{ left: `calc(150px + (100% - 174px) * ${state.time / animation.duration})` }}><i /></div>
      {state.project.bones.map(bone => <TimelineRow key={bone.id} bone={bone} duration={animation.duration} />)}
      {state.project.ikConstraints.filter(constraint => !constraint.animationId || constraint.animationId === animation.id).map(constraint => <div className="timeline-row" key={constraint.id}>
        <button className="track-name orange" onClick={() => updateEditor({ selection: { kind: 'ik', id: constraint.id } })}>⊕ {constraint.name}</button><div className="track-line">{constraint.targetKeys.map(keyframe => <button className="key-diamond ik-key" key={keyframe.time}
          style={{ left: `${keyframe.time / animation.duration * 100}%` }} aria-label={`${constraint.name} ${keyframe.time}秒目标帧`} onClick={() => updateEditor({ time: keyframe.time, isPlaying: false, selection: { kind: 'ik', id: constraint.id } })} />)}</div></div>)}
    </div><div className="scrubber"><span>拖动定位</span><input aria-label="时间轴定位" type="range" min={0} max={animation.duration} step={1 / animation.fps} value={state.time}
      onChange={event => updateEditor({ time: Number(event.target.value), isPlaying: false })} /></div></div>;
}

function AnimationSettings() {
  const state = useEditor(); const animation = state.project.animations.find(item => item.id === state.animationId);
  if (!animation) return null;
  const update = (changes: Partial<typeof animation>) => runCommand({ type: 'animation.update', animationId: animation.id, changes });
  const selectedTrack = animation.tracks.find(track => track.boneId === state.selection?.id);
  const selectedIK = state.project.ikConstraints.find(constraint => constraint.id === state.selection?.id);
  const keyframe = selectedTrack?.keyframes.find(key => Math.abs(key.time - state.time) < 0.001);
  const targetKey = selectedIK?.targetKeys.find(key => Math.abs(key.time - state.time) < 0.001);
  return <div className="animation-settings"><TextField label="动作名称" value={animation.name} onChange={name => update({ name })} />
    <div className="property-grid"><NumberField label="时长 / 秒" min={0.1} max={120} step={0.1} value={animation.duration} onChange={duration => update({ duration })} />
      <NumberField label="帧率 / FPS" min={1} max={120} step={1} value={animation.fps} onChange={fps => update({ fps })} /></div>
    {selectedTrack && <label className="field full"><span>插值</span><select value={selectedTrack.interpolation} onChange={event => update({ tracks: animation.tracks.map(track => track === selectedTrack ? { ...track, interpolation: event.target.value as 'linear' | 'smooth' | 'step' } : track) })}>
      <option value="linear">线性</option><option value="smooth">平滑</option><option value="step">阶梯</option></select></label>}
    {(keyframe || targetKey) && <DeleteButton label="删除当前关键帧" command={keyframe ? { type: 'keyframe.remove', animationId: animation.id, boneId: selectedTrack!.boneId, time: keyframe.time } : { type: 'ik.keyframe.remove', constraintId: selectedIK!.id, time: targetKey!.time }} />}
    <DeleteButton label="删除动作" command={{ type: 'animation.remove', animationId: animation.id }} /></div>;
}

/** Playback, seek, inspect and record the current animation's bone and IK tracks. */
export function Timeline() {
  usePlayback();
  return <section className="timeline panel"><TimelineHeader /><div className="timeline-body"><TimelineTracks /><AnimationSettings /></div></section>;
}
