import { beforeEach, expect, it } from 'vitest';
import { samplePose } from '@/core/api';
import { makeTestProject } from '@/core/test-fixtures';
import { applyCommands, getEditorState, replaceProject, undo, updateEditor } from './store';
import { displayedBone, displayedTarget, updateBone, updateIK } from './pose-edit';
import { recordCurrentKeyframe, setAutoKeyframe } from './auto-keyframe';
import { visiblePoseContext } from './pose-preview';

beforeEach(() => {
  const project = makeTestProject();
  project.animations[0].tracks = [{ boneId: 'tip', interpolation: 'linear', keyframes: [
    { time: 0.5, x: 80, y: 0, rotation: 20, interpolation: 'bezier', curve: { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9 } },
  ] }];
  replaceProject(project); updateEditor({ time: 0.5, isAutoKeyframe: false, selection: { kind: 'bone', id: 'tip' } });
});

it('previews FK edits without changing base transforms, canonical keys, revision, dirty or history; K records once', () => {
  const state = getEditorState(); const bone = state.project.bones[1];
  updateBone(bone, { x: 90 }); updateBone(bone, { y: 12 }); updateBone(bone, { rotation: 35 });
  const draft = getEditorState();
  expect(draft.project).toBe(state.project); expect(draft.revision).toBe(state.revision);
  expect(draft.isDirty).toBe(false); expect(draft.past).toHaveLength(0);
  expect(displayedBone(bone)).toMatchObject({ x: 90, y: 12, rotation: 35 });
  expect(visiblePoseContext(draft, { animationId: null, time: 0.5 }).project).toBe(state.project);
  expect(visiblePoseContext(draft, { animationId: 'walk', time: 0 }).project).toBe(state.project);
  recordCurrentKeyframe();
  expect(getEditorState().project.animations[0].tracks[0].keyframes[0]).toMatchObject({ x: 90, y: 12, rotation: 35, interpolation: 'bezier' });
  expect(getEditorState().project.animations[0].tracks[0].keyframes[0].curve).toEqual(state.project.animations[0].tracks[0].keyframes[0].curve);
  expect(getEditorState().past).toHaveLength(1); expect(getEditorState().poseDraft).toBeNull();
  undo(); expect(getEditorState().project).toEqual(state.project);
});

it('retains unselected FK drafts after recording and cancels pending changes before undoing a prior document command', () => {
  const state = getEditorState(); const [root, tip] = state.project.bones;
  applyCommands([{ type: 'project.update', changes: { name: '已保存的改动' } }]);
  updateBone(root, { x: 30 }); updateBone(tip, { rotation: 45 });
  recordCurrentKeyframe();
  expect(displayedBone(root).x).toBeCloseTo(30); expect(getEditorState().poseDraft?.commands).toHaveLength(1);
  const recorded = getEditorState().project; undo();
  expect(getEditorState().project).toBe(recorded); expect(getEditorState().poseDraft).toBeNull();
  undo(); expect(getEditorState().project.name).toBe('已保存的改动');
});

it('discards drafts on seek, playback, mode, action, external revision and policy change without implicit recording', () => {
  for (const change of [{ time: 1 }, { isPlaying: true }, { animationId: null }, { isAutoKeyframe: true }]) {
    replaceProject(makeTestProject()); updateEditor({ time: 0.5, isAutoKeyframe: false });
    updateBone(getEditorState().project.bones[1], { rotation: 45 });
    const state = getEditorState(); updateEditor(change);
    expect(getEditorState().poseDraft).toBeNull(); expect(getEditorState().project).toBe(state.project);
    expect(getEditorState().message).toContain('未录帧姿态已清除');
  }
  replaceProject(makeTestProject()); updateEditor({ time: 0.5, isAutoKeyframe: false });
  updateBone(getEditorState().project.bones[1], { rotation: 45 });
  applyCommands([{ type: 'project.update', changes: { name: 'AI 命令' } }]);
  expect(getEditorState().poseDraft).toBeNull(); expect(getEditorState().project.animations[0].tracks).toHaveLength(0);
});

it('records FK automatically with a single coalesced undo, leaves explicit commands independent and never records in rig mode', () => {
  const original = getEditorState().project; const bone = original.bones[1]; setAutoKeyframe(true);
  updateBone(bone, { rotation: 40 }); updateBone(bone, { rotation: 55 }, { coalesce: true });
  expect(getEditorState().past).toHaveLength(1); expect(getEditorState().poseDraft).toBeNull();
  undo(); expect(getEditorState().project).toEqual(original); setAutoKeyframe(false);
  applyCommands([{ type: 'keyframe.set', animationId: 'walk', boneId: 'tip', keyframe: { time: 1, x: 80, y: 0, rotation: 60 } }]);
  expect(getEditorState().project.animations[0].tracks[0].keyframes).toHaveLength(2);
  updateEditor({ animationId: null, tool: 'rig' }); const before = getEditorState().project.animations;
  updateBone(getEditorState().project.bones[1], { rotation: 5 }); recordCurrentKeyframe();
  expect(getEditorState().project.animations).toEqual(before); expect(getEditorState().project.bones[1].rotation).toBe(5);
});

it('previews and records IK targets while preserving connected joints and rejects unrelated animation edits', () => {
  const project = makeTestProject();
  project.ikConstraints = [{ id: 'ik', name: '手臂 IK', rootBoneId: 'root', tipBoneId: 'tip', targetX: 100, targetY: 70,
    bendDirection: 1, enabled: true, targetKeys: [], animationId: 'walk' }];
  replaceProject(project); updateEditor({ time: 0.5, isAutoKeyframe: false, selection: { kind: 'ik', id: 'ik' } });
  const constraint = getEditorState().project.ikConstraints[0];
  updateIK(constraint, { targetX: 120 }); updateIK(constraint, { targetY: 90 });
  expect(getEditorState().project.ikConstraints[0].targetKeys).toHaveLength(0);
  expect(displayedTarget(constraint)).toEqual({ targetX: 120, targetY: 90 });
  const pose = samplePose(visiblePoseContext(getEditorState()));
  expect(pose.bones.tip.x).toBeCloseTo(pose.bones.root.endX); expect(pose.bones.tip.y).toBeCloseTo(pose.bones.root.endY);
  recordCurrentKeyframe(); expect(getEditorState().project.ikConstraints[0].targetKeys[0]).toEqual({ time: 0.5, x: 120, y: 90 });
  setAutoKeyframe(true); updateIK(constraint, { targetY: 100 });
  expect(getEditorState().project.ikConstraints[0].targetKeys[0].y).toBe(100);
  applyCommands([{ type: 'animation.add', animation: { ...project.animations[0], id: 'other' } }]);
  updateEditor({ animationId: 'other' }); const before = getEditorState().project;
  updateIK(constraint, { targetX: 130 }); expect(getEditorState().project).toBe(before);
});
