import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDemoProject } from '@/core/api';
import { newProject, openDesktopProject, saveProject } from './project-actions';
import { applyCommands, getEditorState, replaceProject, updateEditor } from './store';

function createBridge() {
  return {
    setProjectSession: vi.fn().mockResolvedValue(undefined),
    saveProject: vi.fn().mockResolvedValue('C:\\projects\\original.json'),
    openProject: vi.fn().mockResolvedValue(null),
    importImages: vi.fn().mockResolvedValue([]),
    saveFile: vi.fn().mockResolvedValue(null),
    exportFile: vi.fn().mockResolvedValue(null),
    onAutomationRequest: vi.fn(), replyAutomation: vi.fn(),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((complete, fail) => { resolve = complete; reject = fail; });
  return { promise, resolve, reject };
}

let bridge: ReturnType<typeof createBridge>;
beforeEach(() => {
  bridge = createBridge();
  vi.stubGlobal('window', { boneStudio: bridge });
  replaceProject(createDemoProject());
});
afterEach(() => { vi.unstubAllGlobals(); });

it('retains the document identity and destination through rename, with explicit save as', async () => {
  const documentId = getEditorState().documentId;
  await saveProject();
  applyCommands([{ type: 'project.update', changes: { name: '改名后' } }]);
  await saveProject();
  expect(getEditorState().documentPath).toBe('C:\\projects\\original.json');
  expect(getEditorState().documentId).toBe(documentId);
  expect(getEditorState().isDirty).toBe(false);
  expect(bridge.saveProject.mock.calls[1][0]).toMatchObject({ documentId, suggestedName: '改名后.bonestudio.json' });
  await saveProject({ saveAs: true });
  expect(bridge.saveProject.mock.calls[2][0].saveAs).toBe(true);
  expect(JSON.parse(bridge.saveProject.mock.calls[2][0].data)).not.toHaveProperty('documentPath');
});

it('keeps destination and dirty state when save as is canceled or fails', async () => {
  await saveProject();
  applyCommands([{ type: 'project.update', changes: { name: '未保存' } }]);
  bridge.saveProject.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('磁盘写入失败'));
  await saveProject({ saveAs: true });
  await saveProject({ saveAs: true });
  expect(getEditorState()).toMatchObject({ documentPath: 'C:\\projects\\original.json', isDirty: true, isSaving: false, message: '磁盘写入失败' });
});

it('blocks duplicate clicks and preserves edits made while saving', async () => {
  const saving = deferred<string>();
  bridge.saveProject.mockReturnValueOnce(saving.promise);
  const first = saveProject();
  await Promise.resolve();
  await saveProject();
  applyCommands([{ type: 'project.update', changes: { name: '保存期间改动' } }]);
  saving.resolve('C:\\projects\\original.json');
  await first;
  expect(bridge.saveProject).toHaveBeenCalledTimes(1);
  expect(getEditorState()).toMatchObject({ isDirty: true, isSaving: false });
});

it('ignores old save completion after a new document starts its own save', async () => {
  const old = deferred<string>(); const next = deferred<string>();
  bridge.saveProject.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const first = saveProject();
  await Promise.resolve();
  const oldDocumentId = getEditorState().documentId;
  newProject();
  applyCommands([{ type: 'project.update', changes: { name: '新文档' } }]);
  const second = saveProject();
  await Promise.resolve();
  old.resolve('C:\\projects\\old.json');
  await first;
  expect(getEditorState().documentId).not.toBe(oldDocumentId);
  expect(getEditorState()).toMatchObject({ documentPath: null, isDirty: true, isSaving: true });
  next.resolve('C:\\projects\\new.json');
  await second;
  expect(getEditorState()).toMatchObject({ documentPath: 'C:\\projects\\new.json', isDirty: false, isSaving: false });
});

it('adopts open authorization only after domain validation, and clears it on replacement', async () => {
  await saveProject();
  const documentId = getEditorState().documentId;
  bridge.openProject.mockResolvedValueOnce({ text: '{}', path: 'C:\\bad.json', openToken: 'invalid' });
  await openDesktopProject();
  expect(getEditorState()).toMatchObject({ documentId, documentPath: 'C:\\projects\\original.json' });
  const openToken = crypto.randomUUID();
  bridge.openProject.mockResolvedValueOnce({ text: JSON.stringify(createDemoProject()), path: 'C:\\opened.json', openToken });
  await openDesktopProject();
  expect(getEditorState().documentPath).toBe('C:\\opened.json');
  expect(bridge.setProjectSession).toHaveBeenLastCalledWith({ documentId: getEditorState().documentId, openToken });
  replaceProject(createDemoProject());
  expect(getEditorState().documentPath).toBeNull();
  expect(bridge.setProjectSession.mock.calls.at(-1)?.[0].openToken).toBeUndefined();
});

it('retries a failed session using the open token and ignores stale open errors', async () => {
  const openToken = crypto.randomUUID();
  bridge.openProject.mockResolvedValueOnce({ text: JSON.stringify(createDemoProject()), path: 'C:\\opened.json', openToken });
  bridge.setProjectSession.mockRejectedValueOnce(new Error('授权同步暂时失败'));
  await openDesktopProject();
  await vi.waitFor(() => expect(getEditorState().message).toBe('授权同步暂时失败'));
  bridge.saveProject.mockResolvedValueOnce('C:\\opened.json');
  await saveProject();
  expect(bridge.setProjectSession.mock.calls.slice(-2).map(call => call[0].openToken)).toEqual([openToken, openToken]);
  expect(getEditorState()).toMatchObject({ documentPath: 'C:\\opened.json', isSaving: false });
  const opening = deferred<null>();
  bridge.openProject.mockReturnValueOnce(opening.promise);
  const oldOpen = openDesktopProject();
  await Promise.resolve();
  newProject();
  updateEditor({ message: '新文档消息' });
  opening.reject(new Error('旧文档读取失败'));
  await oldOpen;
  expect(getEditorState().message).toBe('新文档消息');
});
