import { expect, it } from 'vitest';
import { executeCommand, samplePose } from '@/core/api';
import { makeTestProject } from '@/core/test-fixtures';
import { boneOptions } from './BonePicker';
import { hitCanvasTarget, planCanvasDrag } from './canvas-edit';
import { rigContext } from './rig-edit';
import { getEditorState, replaceProject, updateEditor } from './store';

it('distinguishes short bone endpoints and prioritizes the selected bone at a shared joint', () => {
  const project = makeTestProject(); project.bones[0].length = 18; project.bones[1].x = 18;
  const context = { project, time: 0, zoom: 1, selection: { kind: 'bone' as const, id: 'root' } };
  expect(hitCanvasTarget(context, { x: 10, y: 20 }, 'rig')).toMatchObject({ id: 'root', kind: 'rig-head' });
  expect(hitCanvasTarget(context, { x: 28, y: 20 }, 'rig')).toMatchObject({ id: 'root', kind: 'rig-tail' });
  expect(hitCanvasTarget({ ...context, selection: { kind: 'bone', id: 'tip' } }, { x: 28, y: 20 }, 'rig'))
    .toMatchObject({ id: 'tip', kind: 'rig-head' });
  expect(hitCanvasTarget({ ...context, zoom: 4 }, { x: 10, y: 23 }, 'rig')).toBeNull();
  expect(hitCanvasTarget({ ...context, showBones: false }, { x: 10, y: 20 }, 'rig')).toBeNull();
});

it('drags either endpoint while retaining the opposite endpoint and all animation keys', () => {
  const project = makeTestProject(); const before = samplePose(rigContext({ project, time: 0 }));
  const context = { project, animationId: 'walk', time: 0.5, keepImages: true };
  const result = planCanvasDrag({ context, drag: { kind: 'rig-head', id: 'root' }, point: { x: 20, y: 40 } });
  if (!('command' in result)) throw new Error(result.message);
  const edited = executeCommand({ project, command: result.command });
  const after = samplePose(rigContext({ project: edited, time: 0 }));
  expect(after.bones.root).toMatchObject({ x: 20, y: 40 });
  expect(after.bones.root.endX).toBeCloseTo(before.bones.root.endX);
  expect(after.bones.root.endY).toBeCloseTo(before.bones.root.endY);
  expect(edited.animations).toEqual(project.animations);
});

it('plans body movement by pointer displacement and updates both ends through shared joints', () => {
  const project = makeTestProject(); const context = { project, time: 0, keepImages: false };
  const drag = hitCanvasTarget(context, { x: 40, y: 20 }, 'rig');
  expect(drag?.kind).toBe('rig-body'); if (!drag) throw new Error('Missing body');
  const result = planCanvasDrag({ context, drag, point: { x: 55, y: 30 } });
  if (!('command' in result)) throw new Error(result.message);
  expect(result.command).toMatchObject({ type: 'bone.edit', endpoint: 'body', x: 25, y: 30, keepImages: false });
  const edited = executeCommand({ project, command: result.command });
  const after = samplePose(rigContext({ project: edited, time: 0 }));
  expect(after.bones.root.x).toBeCloseTo(25); expect(after.bones.root.endX).toBeCloseTo(105);
  expect(after.bones.tip.x).toBeCloseTo(105); expect(after.bones.tip.endX).toBeCloseTo(150);
});

it('displays unsolved setup endpoints while animation mode retains IK target picking', () => {
  const project = makeTestProject(); project.ikConstraints.push({ id: 'ik', name: 'IK', rootBoneId: 'root', tipBoneId: 'tip',
    targetX: 100, targetY: 100, enabled: true, bendDirection: 1, targetKeys: [] });
  const context = { project, animationId: 'walk', time: 0 };
  const setup = samplePose(rigContext(context));
  expect(hitCanvasTarget(context, { x: setup.bones.tip.endX, y: setup.bones.tip.endY }, 'rig'))
    .toMatchObject({ id: 'tip', kind: 'rig-tail' });
  expect(hitCanvasTarget(context, { x: 100, y: 100 }, 'select')).toMatchObject({ id: 'ik', kind: 'ik' });
  expect(project.ikConstraints).toHaveLength(1);
});

it('keeps torso available for head parenting, rejects descendants and disambiguates repeated names', () => {
  const project = makeTestProject(); project.bones[0].name = '躯干'; project.bones[1].name = '头部';
  project.bones.push({ id: 'child', name: '头部', parentId: 'tip', x: 60, y: 0, length: 20, rotation: 0 });
  expect(boneOptions(project, 'tip').map(option => option.bone.id)).toEqual(['root']);
  expect(boneOptions(project, 'tip')[0].path).toBe('躯干');
  expect(boneOptions(project).find(option => option.bone.id === 'child')?.path).toBe('躯干 / 头部 / 头部');
});

it('keeps the canvas tool and animation mode consistent when opening a project from rig editing', () => {
  updateEditor({ tool: 'rig', animationId: null });
  replaceProject(makeTestProject());
  expect(getEditorState()).toMatchObject({ tool: 'select', animationId: 'walk', isPlaying: false });
  const empty = makeTestProject(); empty.animations = [];
  replaceProject(empty);
  expect(getEditorState()).toMatchObject({ tool: 'rig', animationId: null });
});
