import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

function createHarness(directory) {
  const { createRecentProject } = require('../electron/recent-project.cjs');
  const { createProjectFiles } = require('../electron/project-files.cjs');
  const { readProject, writeOutput } = require('../electron/files.cjs');
  const recent = createRecentProject(directory);
  const saves = []; const opens = []; const openOptions = [];
  const dialog = {
    showSaveDialog: async () => saves.shift(),
    showOpenDialog: async (_window, options) => { openOptions.push(options); return opens.shift(); },
  };
  return { recent, saves, opens, openOptions, projects: createProjectFiles({ window: {}, dialog, readProject, writeOutput, recent }) };
}

function saveInput(documentId) { return { documentId, suggestedName: 'project.json', data: '{"project":"saved"}' }; }

/** Check durable restart, separate last-save dialog location, and one-use restore authorization. */
async function checkSuccessfulRecall(directory) {
  const harness = createHarness(directory);
  const documentId = randomUUID(); const openedId = randomUUID();
  await harness.projects.setSession({ documentId });
  assert.equal(await harness.projects.restore({ documentId }), null);
  const savedPath = path.join(directory, 'saved.json');
  const openedPath = path.join(directory, 'opened.json');
  harness.saves.push({ filePath: savedPath });
  await harness.projects.save(saveInput(documentId));
  await fs.writeFile(openedPath, '{"project":"opened"}');
  harness.opens.push({ filePaths: [openedPath] });
  const file = await harness.projects.open({ documentId });
  await harness.projects.setSession({ documentId: openedId, openToken: file.openToken });
  assert.equal(harness.openOptions[0].defaultPath, savedPath);
  assert.deepEqual(await harness.recent.read(), { version: 1, latestProjectPath: openedPath, savedProjectPath: savedPath });
  const restarted = createHarness(directory); const restartedId = randomUUID();
  await restarted.projects.setSession({ documentId: restartedId });
  const restored = await restarted.projects.restore({ documentId: restartedId });
  assert.equal(restored.text, '{"project":"opened"}');
  const adoptedId = randomUUID();
  await restarted.projects.setSession({ documentId: adoptedId, openToken: restored.openToken });
  await assert.rejects(restarted.projects.setSession({ documentId: randomUUID(), openToken: restored.openToken }), /授权已失效/);
  assert.equal(await restarted.projects.save(saveInput(adoptedId)), openedPath);
  await restarted.projects.setSession({ documentId: randomUUID() });
  assert.equal((await restarted.recent.read()).latestProjectPath, openedPath);
  return { savedPath, openedPath };
}

/** Canceled/failed saves and export-only writes cannot change the remembered project. */
async function checkFailureIsolation(directory) {
  const harness = createHarness(directory); const documentId = randomUUID();
  await harness.projects.setSession({ documentId });
  const before = await harness.recent.read();
  harness.saves.push({ canceled: true }, { filePath: path.join(directory, 'absent', 'failed.json') });
  assert.equal(await harness.projects.save(saveInput(documentId)), null);
  await assert.rejects(harness.projects.save(saveInput(documentId)), /ENOENT/);
  harness.opens.push({ filePaths: [path.join(directory, 'invalid.json')] });
  await fs.writeFile(path.join(directory, 'invalid.json'), '{}');
  await harness.projects.open({ documentId });
  assert.deepEqual(await harness.recent.read(), before);
  await assert.rejects(harness.projects.restore({ documentId, outputPath: path.join(directory, 'arbitrary.json') }));
  await fs.rm(before.savedProjectPath);
  harness.opens.push({ canceled: true });
  await harness.projects.open({ documentId });
  assert.equal(Object.hasOwn(harness.openOptions.at(-1), 'defaultPath'), false);
}

/** Missing projects and corrupt settings fail clearly without rewriting either source file. */
async function checkUnavailableRecall(directory) {
  const harness = createHarness(directory); const documentId = randomUUID();
  await harness.projects.setSession({ documentId });
  await assert.rejects(harness.projects.restore({ documentId }), /文件已移动或删除/);
  const settingsPath = path.join(directory, 'recent-project.json');
  await fs.writeFile(settingsPath, '{invalid');
  await assert.rejects(harness.projects.restore({ documentId }), /无法恢复上次项目/);
  assert.equal(await fs.readFile(settingsPath, 'utf8'), '{invalid');
}

/** A delayed restore cannot issue an authorization after the editor changes documents. */
async function checkStaleRecall(directory) {
  const { createProjectFiles } = require('../electron/project-files.cjs');
  const filePath = path.join(directory, 'opened.json');
  let finishRead;
  const reading = new Promise(resolve => { finishRead = resolve; });
  const projects = createProjectFiles({ recent: { read: async () => ({ latestProjectPath: filePath }) }, readProject: async () => reading });
  const oldId = randomUUID();
  await projects.setSession({ documentId: oldId });
  const restoring = projects.restore({ documentId: oldId });
  await new Promise(resolve => setImmediate(resolve));
  await projects.setSession({ documentId: randomUUID() });
  finishRead({ name: 'opened.json', text: '{}' });
  assert.equal(await restoring, null);
}

/** Run recent-project regression only inside the existing test's private temporary directory. */
export async function checkRecentProject(directory) {
  const profile = path.join(directory, 'recent-profile');
  await fs.mkdir(profile);
  await checkSuccessfulRecall(profile);
  await checkFailureIsolation(profile);
  await checkStaleRecall(profile);
  await checkUnavailableRecall(profile);
  console.log('最近项目：空白启动、重启读取、一次性授权、最近保存的打开位置、失效路径回退、取消/失败/未采纳隔离与损坏记录保护通过。');
}
