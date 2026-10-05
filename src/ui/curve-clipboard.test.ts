import { beforeEach, expect, it } from 'vitest';
import { makeTestProject } from '@/core/test-fixtures';
import { copySelectedCurve, getCurveClipboard, pasteSelectedCurve, reverseSelectedCurve } from './curve-clipboard';
import { getEditorState, replaceProject, undo, updateEditor } from './store';

const CURVE = { x1: 0.42, y1: 0, x2: 1, y2: 1 };

beforeEach(() => {
  const project = makeTestProject();
  project.animations[0].tracks = [{ boneId: 'root', interpolation: 'linear', keyframes: [
    { time: 0, x: 10, y: 20, rotation: 0, interpolation: 'bezier', curve: CURVE }, { time: 2, x: 30, y: 40, rotation: 90 },
  ] }];
  project.ikConstraints = [{ id: 'ik', name: '目标', rootBoneId: 'root', tipBoneId: 'tip',
    targetX: 100, targetY: 80, bendDirection: 1, enabled: true, animationId: 'walk',
    targetKeys: [{ time: 0, x: 100, y: 80 }, { time: 2, x: 100, y: 90 }] }];
  replaceProject(project); updateEditor({ time: 0, selection: { kind: 'bone', id: 'root' } });
});

it('复制贝塞尔缓动到 IK 仅改曲线，深拷贝不污染源，粘贴一次撤销恢复', () => {
  expect(copySelectedCurve()).toBe(true);
  const copy = getCurveClipboard(); if (copy?.curve) copy.curve.x1 = 0;
  expect(getCurveClipboard()?.curve?.x1).toBe(0.42);
  const before = getEditorState().project;
  updateEditor({ selection: { kind: 'ik', id: 'ik' } });
  expect(pasteSelectedCurve()).toBe(true);
  expect(getEditorState().project.ikConstraints[0].targetKeys[0]).toEqual({ time: 0, x: 100, y: 80, interpolation: 'bezier', curve: CURVE });
  expect(getEditorState().project.animations).toEqual(before.animations);
  expect(getEditorState().past).toHaveLength(1);
  undo(); expect(getEditorState().project).toEqual(before);
});

it('反转贝塞尔出段保持姿态值，每次反转一次撤销；曲线源剪贴板保持', () => {
  copySelectedCurve(); const before = getEditorState().project;
  expect(reverseSelectedCurve()).toBe(true);
  const key = getEditorState().project.animations[0].tracks[0].keyframes[0];
  expect(key).toMatchObject({ x: 10, y: 20, rotation: 0, curve: { x1: 0, y1: 0, y2: 1 } });
  expect(key.curve?.x2).toBeCloseTo(0.58, 12);
  expect(getCurveClipboard()?.curve).toEqual(CURVE);
  expect(getEditorState().past).toHaveLength(1);
  undo(); expect(getEditorState().project).toEqual(before);
});

it('最后帧和未选中关键帧禁止曲线操作，不写项目和撤销栈', () => {
  updateEditor({ time: 2 }); const before = getEditorState().project;
  expect(copySelectedCurve()).toBe(false);
  expect(pasteSelectedCurve()).toBe(false);
  expect(reverseSelectedCurve()).toBe(false);
  updateEditor({ time: 1 });
  expect(reverseSelectedCurve()).toBe(false);
  expect(getEditorState().project).toBe(before);
  expect(getEditorState().past).toHaveLength(0);
});
