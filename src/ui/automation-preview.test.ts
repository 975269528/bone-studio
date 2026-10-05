import { beforeEach, expect, it, vi } from 'vitest';
import { makeTestProject } from '@/core/test-fixtures';
import { capturePreview, exportAnimation } from '@/render';
import { handleAutomation } from './automation';
import { getEditorState, replaceProject, updateEditor } from './store';
import { updateBone } from './pose-edit';

vi.mock('@/render', () => ({ capturePreview: vi.fn(async () => 'data:image/png;base64,preview'), exportAnimation: vi.fn(async () => ({})) }));

beforeEach(() => {
  vi.clearAllMocks(); replaceProject(makeTestProject()); updateEditor({ time: 0.5, isAutoKeyframe: false });
  updateBone(getEditorState().project.bones[1], { rotation: 35 });
});

it('renders the visible unrecorded pose for the current action/time, including omitted params', async () => {
  const state = getEditorState();
  await handleAutomation({ id: 'current', method: 'render_preview', params: {} });
  expect(capturePreview).toHaveBeenLastCalledWith({ project: state.poseDraft?.project, animationId: 'walk', time: 0.5 });
  await handleAutomation({ id: 'explicit', method: 'render_preview', params: { animationId: 'walk', time: 0.5 } });
  expect(capturePreview).toHaveBeenLastCalledWith({ project: state.poseDraft?.project, animationId: 'walk', time: 0.5 });
});

it('uses the canonical project for another time or the explicitly requested base pose', async () => {
  const project = getEditorState().project;
  await handleAutomation({ id: 'other', method: 'render_preview', params: { time: 1 } });
  expect(capturePreview).toHaveBeenLastCalledWith({ project, animationId: 'walk', time: 1 });
  await handleAutomation({ id: 'rig', method: 'render_preview', params: { animationId: null, time: 0.5 } });
  expect(capturePreview).toHaveBeenLastCalledWith({ project, animationId: null, time: 0.5 });
});

it('keeps project reads, saves and exports canonical; explicit commands remain independent of Auto K', async () => {
  const original = getEditorState().project;
  expect(await handleAutomation({ id: 'save', method: 'save_project', params: {} })).toBe(original);
  expect(await handleAutomation({ id: 'read', method: 'get_project', params: {} })).toMatchObject({ project: original, dirty: false });
  await handleAutomation({ id: 'export', method: 'export_animation', params: { format: 'sequence' } });
  expect(exportAnimation).toHaveBeenCalledWith(expect.objectContaining({ project: original }));
  await handleAutomation({ id: 'edit', method: 'apply_commands', params: { commands: [
    { type: 'keyframe.set', animationId: 'walk', boneId: 'tip', keyframe: { time: 1, x: 80, y: 0, rotation: 60 } },
  ] } });
  expect(getEditorState().poseDraft).toBeNull(); expect(getEditorState().project.animations[0].tracks[0].keyframes[0].rotation).toBe(60);
});
