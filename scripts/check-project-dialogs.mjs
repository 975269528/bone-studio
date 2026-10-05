import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bone-studio-dialog-test-'));
const handlers = new Map();
const mainFrame = {};
const window = { webContents: { mainFrame } };
const sender = { sender: window.webContents, senderFrame: mainFrame };
const saveResults = [];
const openResults = [];
let saveDialogCount = 0;
const dialog = {
  showSaveDialog: async () => { saveDialogCount += 1; return await saveResults.shift(); },
  showOpenDialog: async () => await openResults.shift(),
};
const electronPath = require.resolve('electron');
const previousElectron = require.cache[electronPath];
require.cache[electronPath] = { exports: { dialog, nativeImage: {} } };
const { registerDialogs } = require('../electron/dialogs.cjs');
const { createProjectFiles } = require('../electron/project-files.cjs');
registerDialogs(window, { handle: (name, handler) => handlers.set(name, handler) });

/** Invoke the registered IPC boundary with a trusted or explicitly rejected sender. */
function invoke(name, input, event = sender) { return Promise.resolve().then(() => handlers.get(name)(event, input)); }

function destination(name) { return path.join(directory, name); }
function saveInput(documentId, data = '{"revision":1}') { return { documentId, suggestedName: 'document.json', data }; }
function deferred() {
  let resolve;
  const promise = new Promise(complete => { resolve = complete; });
  return { promise, resolve };
}

/** Verify first-save prompting, persistent overwrite, explicit save-as, and export isolation. */
async function checkPersistentSave() {
  const documentId = randomUUID();
  const original = destination('original.json');
  await invoke('project:session', { documentId });
  saveResults.push({ filePath: original });
  assert.equal(await invoke('project:save', saveInput(documentId)), original);
  assert.equal(saveDialogCount, 1);
  assert.equal(await invoke('project:save', saveInput(documentId, '{"revision":2}')), original);
  assert.equal(saveDialogCount, 1);
  assert.equal(await fs.readFile(original, 'utf8'), '{"revision":2}');
  saveResults.push({ canceled: true });
  assert.equal(await invoke('project:save', { ...saveInput(documentId), saveAs: true }), null);
  saveResults.push({ filePath: destination('absent/fail.json') });
  await assert.rejects(invoke('project:save', { ...saveInput(documentId), saveAs: true }), /ENOENT/);
  assert.equal(await invoke('project:save', saveInput(documentId)), original);
  const alternate = destination('alternate.json');
  saveResults.push({ filePath: alternate });
  assert.equal(await invoke('project:save', { ...saveInput(documentId), saveAs: true }), alternate);
  saveResults.push({ filePath: destination('export.zip') });
  await invoke('file:save', { suggestedName: 'export.zip', data: 'export' });
  assert.equal(await invoke('project:save', saveInput(documentId)), alternate);
  return documentId;
}

/** Grant opened files only after a validated renderer adopts the one-use token. */
async function checkOpen(documentId) {
  const opened = destination('opened.json');
  await fs.writeFile(opened, '{}');
  openResults.push({ filePaths: [opened] });
  const file = await invoke('project:open', { documentId });
  // A domain-invalid file can be read, but has no effect without token adoption.
  assert.equal(await invoke('project:save', saveInput(documentId)), destination('alternate.json'));
  openResults.push({ filePaths: [destination('missing.json')] });
  await assert.rejects(invoke('project:open', { documentId }), /ENOENT/);
  assert.equal(await invoke('project:save', saveInput(documentId)), destination('alternate.json'));
  const nextDocumentId = randomUUID();
  await invoke('project:session', { documentId: nextDocumentId, openToken: file.openToken });
  const dialogsBefore = saveDialogCount;
  assert.equal(await invoke('project:save', saveInput(nextDocumentId)), opened);
  assert.equal(saveDialogCount, dialogsBefore);
  await assert.rejects(invoke('project:session', { documentId: randomUUID(), openToken: file.openToken }), /授权已失效/);
  return nextDocumentId;
}

/** Reject arbitrary paths, other frames, stale sessions, and duplicate native save requests. */
async function checkBoundary(documentId) {
  await assert.rejects(invoke('project:save', { ...saveInput(documentId), outputPath: destination('unauthorized.json') }));
  await assert.rejects(invoke('project:save', saveInput(documentId), { ...sender, senderFrame: {} }), /无权访问/);
  await assert.rejects(invoke('project:session', { documentId: 'untrusted' }));
  const nextDocumentId = randomUUID();
  await invoke('project:session', { documentId: nextDocumentId });
  await assert.rejects(invoke('project:save', saveInput(documentId)), /文档已切换/);
  const delayed = deferred();
  saveResults.push(delayed.promise);
  const oldSave = invoke('project:save', saveInput(nextDocumentId));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await invoke('project:save', saveInput(nextDocumentId)), null);
  const currentDocumentId = randomUUID();
  await invoke('project:session', { documentId: currentDocumentId });
  delayed.resolve({ filePath: destination('stale.json') });
  assert.equal(await oldSave, null);
  await assert.rejects(fs.stat(destination('stale.json')), /ENOENT/);
  saveResults.push({ filePath: destination('new.json') });
  assert.equal(await invoke('project:save', saveInput(currentDocumentId)), destination('new.json'));
}

/** A completed write for an old document cannot grant its path to a replacement session. */
async function checkLateWrite() {
  const delayed = deferred();
  let writeCount = 0;
  let dialogs = 0;
  const projects = createProjectFiles({ window, readProject: async () => ({}),
    dialog: { showSaveDialog: async () => { dialogs += 1; return { filePath: destination(`late-${dialogs}.json`) }; } },
    writeOutput: async options => { writeCount += 1; if (writeCount === 1) await delayed.promise; return options.outputPath; },
  });
  const documentId = randomUUID();
  projects.setSession({ documentId });
  const oldSave = projects.save(saveInput(documentId));
  await new Promise(resolve => setImmediate(resolve));
  // Even a reused renderer id must invalidate old grants and in-flight results.
  projects.setSession({ documentId });
  delayed.resolve();
  assert.equal(await oldSave, null);
  assert.equal(await projects.save(saveInput(documentId)), destination('late-2.json'));
  assert.equal(dialogs, 2);
}

/** Serialize real publications to one approved path across document replacements. */
async function checkSamePathWrites() {
  const delayed = deferred();
  const published = [];
  const outputPath = destination('shared.json');
  const projects = createProjectFiles({ window, readProject: async () => ({}),
    dialog: { showSaveDialog: async () => ({ filePath: outputPath }) },
    writeOutput: async options => {
      if (options.data === 'old') await delayed.promise;
      await fs.writeFile(options.outputPath, options.data);
      published.push(options.data);
      return options.outputPath;
    },
  });
  const oldId = randomUUID(); const newId = randomUUID();
  projects.setSession({ documentId: oldId });
  const oldSave = projects.save(saveInput(oldId, 'old'));
  await new Promise(resolve => setImmediate(resolve));
  projects.setSession({ documentId: newId });
  const newSave = projects.save(saveInput(newId, 'new'));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(published, []);
  delayed.resolve();
  assert.equal(await oldSave, null);
  assert.equal(await newSave, outputPath);
  assert.deepEqual(published, ['old', 'new']);
  assert.equal(await fs.readFile(outputPath, 'utf8'), 'new');
}

try {
  const documentId = await checkPersistentSave();
  await checkBoundary(await checkOpen(documentId));
  await checkLateWrite();
  await checkSamePathWrites();
  console.log('项目保存 IPC：首次选址、原路径覆盖、另存为、打开授权、取消/失败、导出隔离、重复请求及文档切换保护通过（模拟对话框 + 真实临时文件）。');
} finally {
  if (previousElectron) require.cache[electronPath] = previousElectron;
  else delete require.cache[electronPath];
  assert.ok(path.resolve(directory).startsWith(path.join(os.tmpdir(), 'bone-studio-dialog-test-')));
  await fs.rm(directory, { recursive: true, force: true });
}
