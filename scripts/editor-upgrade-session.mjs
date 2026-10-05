import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const PREFIX = 'bone-studio-editor-upgrade-';
const RETRYABLE_REMOVE = new Set(['EBUSY', 'EPERM', 'ENOTEMPTY']);

/** Launch only the packaged editor with a hidden window and this run's exclusive absolute profile. */
export async function launchUpgradeSession(options) {
  const { directory, profile } = options;
  const env = { ...process.env, BONE_STUDIO_DEV_URL: '', BONE_STUDIO_DEBUG_PORT: '', BONE_STUDIO_USER_DATA: profile, BONE_STUDIO_HIDDEN: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const application = await electron.launch({ executablePath: path.resolve('release/win-unpacked/BoneStudio.exe'), cwd: directory, env, timeout: 30000 });
  const context = { application, client: null, page: null, errors: [] };
  try {
    context.page = await application.firstWindow();
    context.page.setDefaultTimeout(15000);
    context.page.on('pageerror', error => context.errors.push(error.message));
    await context.page.getByRole('button', { name: '保存', exact: true }).waitFor();
    assert.ok(context.page.url().includes('app.asar/dist/index.html'));
    const actual = await application.evaluate(({ app, BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.webContents.setBackgroundThrottling(false);
      return { profile: app.getPath('userData'), visible: window.isVisible() };
    });
    assert.deepEqual(actual, { profile, visible: false });
    const connectionPath = path.join(profile, 'ai-connection.json');
    await waitForConnection(connectionPath);
    context.client = new Client({ name: 'editor-upgrade-check', version: '1.0.0' });
    await context.client.connect(new StdioClientTransport({ command: process.execPath, args: [path.resolve('electron/mcp.cjs')], env: { ...process.env, BONE_STUDIO_CONNECTION: connectionPath } }));
    return context;
  } catch (error) {
    try { await closeUpgradeSession(context); }
    catch (cleanup) { throw new AggregateError([error, cleanup], 'Upgrade launch and cleanup failed.', { cause: cleanup }); }
    throw error;
  }
}

async function waitForConnection(filePath) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { JSON.parse(await fs.readFile(filePath, 'utf8')); return; }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Isolated upgrade session did not publish its connection.');
}

/** Call validated MCP against this test session, retaining clear command failure evidence. */
export async function callUpgradeTool(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, `Upgrade MCP ${name}: ${JSON.stringify(result.content)}`);
  return JSON.parse(result.content.find(item => item.type === 'text').text);
}

/** Capture only this run's native hidden window without making it visible or changing focus. */
export async function captureUpgrade(options) {
  await options.context.page.evaluate(async () => {
    await globalThis.document.fonts.ready;
    await Promise.all(globalThis.document.getAnimations().map(animation => animation.finished));
    await new Promise(resolve => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)));
  });
  const image = await options.context.application.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const image = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    assertHidden(window);
    return image.toPNG().toString('base64');
    function assertHidden(target) { if (target.isVisible()) throw new Error('Upgrade capture exposed its window.'); }
  });
  await fs.writeFile(options.outputPath, Buffer.from(image, 'base64'));
}

/** Close all resources created by this test; preserve failures from either resource. */
export async function closeUpgradeSession(context) {
  if (!context) return;
  const results = await Promise.allSettled([context.client?.close(), context.application?.close()]);
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length) throw new AggregateError(failures, 'Upgrade session cleanup failed.');
}

/** Delete only the unique root created by this test, with bounded Windows lock retries. */
export async function removeUpgradeDirectory(directory) {
  const absolute = path.resolve(directory);
  assert.ok(path.isAbsolute(directory) && path.dirname(absolute) === path.resolve(os.tmpdir()));
  assert.ok(path.basename(absolute).startsWith(PREFIX) && path.basename(absolute).length > PREFIX.length);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try { await fs.rm(absolute, { recursive: true, force: true }); return; }
    catch (error) {
      if (!RETRYABLE_REMOVE.has(error.code) || attempt === 5) throw error;
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
}
