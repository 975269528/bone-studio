import { beforeEach, expect, it } from 'vitest';
import { makeTestProject } from '@/core/test-fixtures';
import { cycleEditorMode, getEditorMode, planEditorMode, selectCanvasTool, setEditorMode } from './editor-modes';
import { getEditorState, replaceProject, updateEditor } from './store';

function loadActions(): void {
  const project = makeTestProject();
  project.animations.push({ ...project.animations[0], id: 'turn', name: '转身', duration: 4 });
  replaceProject(project);
}

beforeEach(loadActions);

it('cycles back to the last of several actions at its time and pauses without editing the document', () => {
  setEditorMode({ mode: 'animation', animationId: 'turn' });
  updateEditor({ time: 2.5, isPlaying: true, showBones: false });
  const original = getEditorState();
  cycleEditorMode();
  expect(getEditorState()).toMatchObject({ animationId: null, time: 0, tool: 'rig', showBones: true, isPlaying: false });
  cycleEditorMode();
  expect(getEditorState()).toMatchObject({ animationId: 'turn', time: 2.5, tool: 'select', isPlaying: false });
  expect(getEditorState().project).toBe(original.project);
  expect(getEditorState().revision).toBe(original.revision);
  expect(getEditorState().isDirty).toBe(false);
});

it('shares transitions across action selection, drawing and auxiliary tools', () => {
  setEditorMode({ mode: 'animation', animationId: 'turn' });
  updateEditor({ time: 1.5 });
  selectCanvasTool('pan');
  expect(getEditorMode(getEditorState())).toBe('animation');
  cycleEditorMode();
  selectCanvasTool('rotate');
  expect(getEditorMode(getEditorState())).toBe('rig');
  selectCanvasTool('select');
  expect(getEditorState()).toMatchObject({ animationId: 'turn', time: 1.5, tool: 'select' });
  selectCanvasTool('draw');
  expect(getEditorState()).toMatchObject({ animationId: null, time: 0, tool: 'draw' });
  setEditorMode({ mode: 'animation', animationId: 'walk' });
  expect(getEditorState()).toMatchObject({ animationId: 'walk', time: 0, tool: 'select' });
});

it('keeps a document with no actions in rig mode and explains how to create an action', () => {
  const project = makeTestProject(); project.animations = [];
  replaceProject(project);
  cycleEditorMode();
  expect(getEditorState()).toMatchObject({ animationId: null, time: 0, tool: 'rig', isPlaying: false, showBones: true });
  expect(getEditorState().message).toContain('添加动作');
  expect(getEditorState().project.animations).toEqual([]);
});

it('clamps remembered time and falls back safely when a remembered action has been removed', () => {
  const state = getEditorState();
  const memory = { documentId: state.documentId, animationId: 'turn', time: 10 };
  const rig = { ...state, animationId: null };
  expect(planEditorMode(rig, { mode: 'animation' }, memory).changes).toMatchObject({ animationId: 'turn', time: 4 });
  const removed = { ...rig, project: { ...state.project, animations: state.project.animations.slice(0, 1) } };
  expect(planEditorMode(removed, { mode: 'animation' }, memory).changes).toMatchObject({ animationId: 'walk', time: 0 });
});

it('isolates remembered actions from a new document even when action ids are reused', () => {
  setEditorMode({ mode: 'animation', animationId: 'turn' });
  updateEditor({ time: 3 });
  cycleEditorMode();
  const previousDocument = getEditorState().documentId;
  loadActions();
  expect(getEditorState().documentId).not.toBe(previousDocument);
  setEditorMode({ mode: 'rig' });
  cycleEditorMode();
  expect(getEditorState()).toMatchObject({ animationId: 'walk', time: 0, tool: 'select' });
});
