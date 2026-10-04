import { beforeEach, expect, it } from 'vitest';
import { executeCommand, samplePose, validateProject } from '@/core/api';
import { makeTestProject } from '@/core/test-fixtures';
import type { Project, SamplePoseOptions } from '@/core/types';
import { getBoneEditRules, planBoneEdit } from './bone-edit';
import { hitCanvasTarget, planCanvasDrag } from './canvas-edit';
import { updateBone } from './pose-edit';
import { getEditorState, replaceProject, updateEditor } from './store';
import { recordKeyframe } from './Timeline';

function ikProject(): Project {
const project = makeTestProject();
project.ikConstraints = [{ id: 'ik', name: '手臂 IK', rootBoneId: 'root', tipBoneId: 'tip',
  targetX: 100, targetY: 70, bendDirection: 1, enabled: true, targetKeys: [], animationId: 'walk' }];
return project;
}

function context(project: Project, animationId: string | null = 'walk'): SamplePoseOptions {
return { project, animationId, time: 0.5 };
}

beforeEach(() => { replaceProject(ikProject()); updateEditor({ time: 0.5, message: '' }); });

it('drags the hand or target into a valid IK keyframe, and edits global targets in setup mode', () => {
  const state = getEditorState(); const pose = samplePose(state); const hand = pose.bones.tip;
  expect(hitCanvasTarget(state, { x: hand.endX, y: hand.endY })).toEqual({ kind: 'ik', id: 'ik' });
  const result = planCanvasDrag({ context: state, drag: { kind: 'ik', id: 'ik' }, point: { x: 90, y: 90 } });
  expect('command' in result).toBe(true);
  if (!('command' in result)) throw new Error(result.message);
  const edited = executeCommand({ project: state.project, command: result.command });
  expect(edited.ikConstraints[0].targetKeys).toEqual([{ time: 0.5, x: 90, y: 90 }]);
  expect(validateProject(edited).valid).toBe(true);
  delete edited.ikConstraints[0].animationId;
  const setup = planCanvasDrag({ context: context(edited, null), drag: { kind: 'ik', id: 'ik' }, point: { x: 80, y: 100 } });
  expect('command' in setup && setup.command.type).toBe('ik.update');
});

it('selects an elbow but rejects its movement and property edits, and rejects solved rotations', () => {
  const state = getEditorState(); const elbow = samplePose(state).bones.tip;
  expect(hitCanvasTarget(state, elbow)).toEqual({ kind: 'bone', id: 'tip' });
  const drag = planCanvasDrag({ context: state, drag: { kind: 'bone', id: 'tip' }, point: { x: elbow.x + 20, y: elbow.y + 10 } });
  expect('message' in drag && drag.message).toContain('请拖动 IK 目标');
  for (const boneId of ['root', 'tip']) {
    const rotation = planCanvasDrag({ context: state, drag: { kind: 'tip', id: boneId }, point: { x: 30, y: 120 } });
    expect('message' in rotation).toBe(true);
  }
  const tip = state.project.bones[1];
  updateBone(tip, { x: 81 }); updateBone(tip, { y: 1 }); updateBone(tip, { rotation: 30 });
  expect(getEditorState().project).toBe(state.project);
  expect(getEditorState().revision).toBe(state.revision);
  expect(getEditorState().message).toContain('保持与上骨连接');
});

it('allows ordinary FK movement and rotation in setup and animation modes', () => {
  const project = makeTestProject(); const bone = project.bones[1];
  for (const animationId of [null, 'walk']) {
    const current = context(project, animationId);
    expect(getBoneEditRules(current, bone.id).positionConstraint).toBeUndefined();
    const move = planBoneEdit({ context: current, bone, changes: { x: 85, y: 5 } });
    const rotation = planCanvasDrag({ context: current, drag: { kind: 'tip', id: 'tip' }, point: { x: 100, y: 100 } });
    for (const result of [move, rotation]) {
      if (!('command' in result)) throw new Error(result.message);
      expect(validateProject(executeCommand({ project, command: result.command })).valid).toBe(true);
    }
  }
});

it('allows disabled IK rotation and unrelated animation movement while retaining structural locks', () => {
  const project = ikProject(); const bone = project.bones[1]; project.ikConstraints[0].enabled = false;
  for (const animationId of [null, 'walk']) {
    const current = context(project, animationId); const rules = getBoneEditRules(current, bone.id);
    expect(rules.positionConstraint).toBeDefined(); expect(rules.rotationConstraint).toBeUndefined();
    const rotate = planBoneEdit({ context: current, bone, changes: { rotation: 25 } });
    if (!('command' in rotate)) throw new Error(rotate.message);
    expect(validateProject(executeCommand({ project, command: rotate.command })).valid).toBe(true);
    expect('message' in planBoneEdit({ context: current, bone, changes: { x: 90 } })).toBe(true);
  }
  project.animations.push({ ...project.animations[0], id: 'other', tracks: [] });
  project.ikConstraints[0].enabled = true;
  const move = planBoneEdit({ context: context(project, 'other'), bone, changes: { x: 90, y: 10, rotation: 25 } });
  if (!('command' in move)) throw new Error(move.message);
  expect(validateProject(executeCommand({ project, command: move.command })).valid).toBe(true);
  expect('message' in planBoneEdit({ context: context(project, null), bone, changes: { x: 90 } })).toBe(true);
  delete project.ikConstraints[0].animationId;
  expect(getBoneEditRules(context(project, null), bone.id).rotationConstraint).toBeDefined();
});

it('records exact connected coordinates without weakening validation or losing ordinary translations', () => {
  const state = getEditorState(); updateEditor({ selection: { kind: 'bone', id: 'tip' } }); recordKeyframe();
  const recorded = getEditorState().project; const key = recorded.animations[0].tracks[0].keyframes[0];
  expect(key.x).toBe(recorded.bones[0].length); expect(key.y).toBe(0);
  expect(validateProject(recorded).valid).toBe(true);
  expect(() => executeCommand({ project: state.project, command: { type: 'keyframe.set', animationId: 'walk',
    boneId: 'tip', keyframe: { time: 0.5, x: 81, y: 0, rotation: 0 } } })).toThrow('下骨关键帧必须保持连接');
  const project = makeTestProject(); project.animations[0].tracks = [{ boneId: 'tip', interpolation: 'linear',
    keyframes: [{ time: 0.5, x: 90, y: 10, rotation: 25 }] }];
  replaceProject(project); updateEditor({ time: 0.5, selection: { kind: 'bone', id: 'tip' } }); recordKeyframe();
  const ordinary = getEditorState().project.animations[0].tracks[0].keyframes[0];
  expect(ordinary.x).toBeCloseTo(90); expect(ordinary.y).toBeCloseTo(10); expect(ordinary.rotation).toBeCloseTo(25);
});
