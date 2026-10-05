import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDemoProject } from '@/core/api';

function createBridge() {
  return { setProjectSession: vi.fn().mockResolvedValue(undefined), restoreProject: vi.fn().mockResolvedValue(null) };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}

let bridge: ReturnType<typeof createBridge>;
beforeEach(() => {
  vi.resetModules();
  bridge = createBridge();
  vi.stubGlobal('window', { boneStudio: bridge });
});
afterEach(() => { vi.unstubAllGlobals(); });

it('starts with a clean empty skeleton in the browser and a fresh desktop profile', async () => {
  const store = await import('./store');
  const { restoreStartupProject } = await import('./project-actions');
  await restoreStartupProject();
  expect(store.getEditorState()).toMatchObject({ tool: 'rig', animationId: null, documentPath: null, isDirty: false, past: [] });
  expect(store.getEditorState().project).toMatchObject({ bones: [], assets: [], attachments: [], animations: [] });
  expect(bridge.setProjectSession).toHaveBeenCalledOnce();
  vi.stubGlobal('window', {});
  await restoreStartupProject();
  expect(bridge.restoreProject).toHaveBeenCalledOnce();
});

it('validates and adopts the restored token before startup completes', async () => {
  const store = await import('./store');
  const { restoreStartupProject } = await import('./project-actions');
  const project = createDemoProject();
  const file = { text: JSON.stringify(project), path: 'C:\\projects\\restored.json', openToken: crypto.randomUUID() };
  const adopted = deferred<void>();
  bridge.restoreProject.mockResolvedValueOnce(file);
  bridge.setProjectSession.mockResolvedValueOnce(undefined).mockReturnValueOnce(adopted.promise);
  let isReady = false;
  const startup = restoreStartupProject().then(() => { isReady = true; });
  await vi.waitFor(() => expect(bridge.setProjectSession).toHaveBeenCalledTimes(2));
  expect(isReady).toBe(false);
  adopted.resolve();
  await startup;
  expect(store.getEditorState()).toMatchObject({ project, documentPath: file.path, isDirty: false, message: '已恢复上次编辑的项目' });
  expect(bridge.setProjectSession).toHaveBeenLastCalledWith({ documentId: store.getEditorState().documentId, openToken: file.openToken });
});

it.each(['{', '{}', null])('keeps the empty skeleton when startup content is invalid or its file is unavailable: %s', async text => {
  const store = await import('./store');
  const { restoreStartupProject } = await import('./project-actions');
  if (text === null) bridge.restoreProject.mockRejectedValueOnce(new Error('无法恢复上次项目：文件已移动或删除。 已启动空白骨架。'));
  else bridge.restoreProject.mockResolvedValueOnce({ text, path: 'C:\\bad.json', openToken: crypto.randomUUID() });
  await restoreStartupProject();
  expect(store.getEditorState()).toMatchObject({ documentPath: null, isDirty: false, past: [] });
  expect(store.getEditorState().project.bones).toEqual([]);
  expect(store.getEditorState().message).toContain('无法恢复上次项目：');
  expect(bridge.setProjectSession).toHaveBeenCalledOnce();
});

it('does not replace edits made while a startup read is in flight', async () => {
  const store = await import('./store');
  const { restoreStartupProject } = await import('./project-actions');
  const reading = deferred<{ text: string; path: string; openToken: string }>();
  bridge.restoreProject.mockReturnValueOnce(reading.promise);
  const startup = restoreStartupProject();
  await vi.waitFor(() => expect(bridge.restoreProject).toHaveBeenCalledOnce());
  store.applyCommands([{ type: 'project.update', changes: { name: '启动期间的编辑' } }]);
  reading.resolve({ text: JSON.stringify(createDemoProject()), path: 'C:\\old.json', openToken: crypto.randomUUID() });
  await startup;
  expect(store.getEditorState()).toMatchObject({ documentPath: null, isDirty: true, project: { name: '启动期间的编辑', bones: [] } });
  expect(bridge.setProjectSession).toHaveBeenCalledOnce();
});

it('falls back to an empty skeleton if adopting the restored authorization fails', async () => {
  const store = await import('./store');
  const { restoreStartupProject } = await import('./project-actions');
  bridge.restoreProject.mockResolvedValueOnce({ text: JSON.stringify(createDemoProject()), path: 'C:\\old.json', openToken: crypto.randomUUID() });
  bridge.setProjectSession.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('打开授权已失效'));
  await restoreStartupProject();
  expect(store.getEditorState()).toMatchObject({ documentPath: null, project: { bones: [], animations: [] }, isDirty: false });
  expect(store.getEditorState().message).toContain('无法恢复上次项目：打开授权已失效');
  expect(bridge.setProjectSession.mock.calls.at(-1)?.[0].openToken).toBeUndefined();
});
