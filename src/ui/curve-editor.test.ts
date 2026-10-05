import { beforeEach, expect, it } from 'vitest';
import { makeTestProject } from '@/core/test-fixtures';
import { DEFAULT_BEZIER_CURVE } from '@/core/curves';
import { curveEditCommand, selectedCurveSegment } from './curve-editor';
import { getEditorState, replaceProject, runCommand, undo, updateEditor } from './store';

beforeEach(() => {
  const project = makeTestProject();
  project.animations[0].tracks = [{ boneId: 'root', interpolation: 'smooth', keyframes: [
    { time: 2, x: 20, y: 30, rotation: 90 }, { time: 0, x: 10, y: 20, rotation: 0 },
  ] }];
  project.ikConstraints = [{ id: 'ik', name: '目标', rootBoneId: 'root', tipBoneId: 'tip',
    targetX: 100, targetY: 80, bendDirection: 1, enabled: true, animationId: 'walk',
    targetKeys: [{ time: 0, x: 100, y: 80 }, { time: 2, x: 100, y: 40 }] }];
  replaceProject(project); updateEditor({ time: 0, selection: { kind: 'bone', id: 'root' } });
});

it('选择 FK 出段沿用轨道缓动，乱序寻找下一帧并正确识别最后帧', () => {
  const first = selectedCurveSegment(getEditorState());
  expect(first).toMatchObject({ kind: 'bone', interpolation: 'smooth', curve: DEFAULT_BEZIER_CURVE, nextTime: 2 });
  updateEditor({ time: 2 });
  expect(selectedCurveSegment(getEditorState())?.nextTime).toBeUndefined();
  updateEditor({ time: 1 });
  expect(selectedCurveSegment(getEditorState())).toBeNull();
  updateEditor({ time: 0, selection: { kind: 'attachment', id: 'root' } });
  expect(selectedCurveSegment(getEditorState())).toBeNull();
});

it('IK 出段默认线性，拒绝不关联当前动作的目标帧及基础姿态', () => {
  updateEditor({ selection: { kind: 'ik', id: 'ik' } });
  expect(selectedCurveSegment(getEditorState())).toMatchObject({ kind: 'ik', interpolation: 'linear', nextTime: 2 });
  const project = structuredClone(getEditorState().project);
  project.animations.push({ ...project.animations[0], id: 'other', tracks: [] });
  replaceProject(project); updateEditor({ selection: { kind: 'ik', id: 'ik' }, animationId: 'other' });
  expect(selectedCurveSegment(getEditorState())).toBeNull();
  updateEditor({ animationId: null });
  expect(selectedCurveSegment(getEditorState())).toBeNull();
});

it('FK 修改只影响出段帧、保留姿态值、轨道和后帧，连续曲线修改合并一次撤销', () => {
  const original = getEditorState().project;
  let segment = selectedCurveSegment(getEditorState());
  if (!segment) throw new Error('缺少选中帧');
  runCommand(curveEditCommand({ segment, interpolation: 'bezier', curve: DEFAULT_BEZIER_CURVE }));
  segment = selectedCurveSegment(getEditorState());
  if (!segment) throw new Error('缺少选中帧');
  runCommand(curveEditCommand({ segment, interpolation: 'bezier', curve: { ...DEFAULT_BEZIER_CURVE, y1: 0.5 } }), { coalesce: true });
  const state = getEditorState();
  expect(state.past).toHaveLength(1);
  expect(state.project.animations[0].tracks[0].interpolation).toBe('smooth');
  expect(state.project.animations[0].tracks[0].keyframes[1]).toEqual(original.animations[0].tracks[0].keyframes[0]);
  expect(state.project.animations[0].tracks[0].keyframes[0]).toMatchObject({ x: 10, y: 20, rotation: 0, interpolation: 'bezier', curve: { y1: 0.5 } });
  undo(); expect(getEditorState().project).toEqual(original);
});

it('IK 缓动命令保留坐标、只更新目标帧，不碰 FK 默认设置', () => {
  updateEditor({ selection: { kind: 'ik', id: 'ik' } });
  const segment = selectedCurveSegment(getEditorState());
  if (!segment) throw new Error('缺少选中目标帧');
  runCommand(curveEditCommand({ segment, interpolation: 'step' }));
  expect(getEditorState().project.ikConstraints[0].targetKeys[0]).toEqual({ time: 0, x: 100, y: 80, interpolation: 'step' });
  expect(getEditorState().project.animations[0].tracks[0].interpolation).toBe('smooth');
});
