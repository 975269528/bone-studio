import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/** Launch exactly the copied command from an empty folder without external package lookup. */
async function connectCopiedConfiguration(options) {
  const configuration = JSON.parse(await fs.readFile(options.filePath, 'utf8'));
  const server = configuration.mcpServers['bone-studio'];
  const client = new Client({ name: 'copied-configuration-check', version: '1.0.0' });
  try {
    await client.connect(new StdioClientTransport({ command: server.command, args: server.args, cwd: options.directory,
      env: { ...process.env, ...server.env, NODE_PATH: '', NODE_OPTIONS: '' } }));
  } catch (error) {
    const [closed] = await Promise.allSettled([client.close()]);
    if (closed.status === 'rejected') console.error('Copied MCP adapter cleanup failed:', closed.reason?.code ?? 'unknown');
    throw error;
  }
  return client;
}

/** Keep every existing ClipboardItem in the main process without exposing its contents. */
async function captureClipboard(application) {
  const testPath = { prefix: path.join(os.tmpdir(), 'bone-studio-package-test-'), suffix: `${path.sep}${path.join('profile', 'mcp-adapter.cjs')}` };
  return application.evaluateHandle(async ({ clipboard, ClipboardItem }, testPath) => {
    let isTestContent = false;
    try {
      const server = JSON.parse(await clipboard.readText())?.mcpServers?.['bone-studio'];
      const argument = server?.args?.[0];
      isTestContent = server?.command === 'node' && typeof argument === 'string'
        && argument.startsWith(testPath.prefix) && argument.endsWith(testPath.suffix);
    } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
    const items = [];
    if (!isTestContent) for (const item of await clipboard.read()) {
      if (item.types.length === 0) continue;
      const data = {};
      for (const type of item.types) data[type] = await item.getType(type);
      items.push(new ClipboardItem(data));
    }
    return { clipboard, items, isTestContent };
  }, testPath);
}

/** Restore only when the clipboard still contains this test's copied configuration. */
async function restoreClipboard(options) {
  try {
    if (!options.expected) return;
    await options.previous.evaluate(async (snapshot, expected) => {
      if (await snapshot.clipboard.readText() !== expected) return;
      const MAX_RESTORE_ATTEMPTS = 3;
      const RETRY_DELAY_MS = 100;
      for (let index = 0; index < MAX_RESTORE_ATTEMPTS; index += 1) {
        try {
          if (snapshot.items.length) await snapshot.clipboard.write(snapshot.items);
          else await snapshot.clipboard.clear();
          return;
        } catch (error) {
          if (index === MAX_RESTORE_ATTEMPTS - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          if (await snapshot.clipboard.readText() !== expected) return;
        }
      }
    }, options.expected);
  } finally { await options.previous.dispose(); }
}

/** Verify direct MCP PNG output while the native editor remains hidden. */
async function checkDirectPreview(client, artifacts) {
  const preview = await client.callTool({ name: 'render_preview', arguments: {} });
  assert.ok(!preview.isError);
  const image = preview.content.find(item => item.type === 'image');
  assert.equal(image?.mimeType, 'image/png');
  const png = Buffer.from(image.data, 'base64');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const metadata = JSON.parse(preview.content.find(item => item.type === 'text').text);
  assert.equal(png.readUInt32BE(16), metadata.width);
  assert.equal(png.readUInt32BE(20), metadata.height);
  await fs.writeFile(path.join(artifacts, 'mcp-preview.png'), png);
}

/** Capture only the isolated test window while keeping it hidden and unfocused. */
export async function saveHiddenScreenshot(options) {
  const base64 = await options.application.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const image = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    if (window.isVisible()) throw new Error('Test capture unexpectedly exposed the window.');
    return image.toPNG().toString('base64');
  });
  await fs.writeFile(options.outputPath, Buffer.from(base64, 'base64'));
}

/** Exercise the desktop configuration dialog, native clipboard and the emitted standalone adapter. */
export async function checkPackagedMcpConfiguration(options) {
  const { application, page, directory, artifacts } = options;
  const previousClipboard = await captureClipboard(application);
  let expectedClipboard;
  let client;
  let failure;
  try {
    const expected = await page.evaluate(() => globalThis.window.boneStudio.getMcpConfiguration());
    assert.ok(expected.requirements.some(value => value.includes('22.12')));
    assert.ok(!expected.configuration.includes('token'));
    assert.ok(!expected.configuration.includes(process.cwd()));
    expectedClipboard = expected.configuration;
    await page.getByRole('button', { name: 'AI / MCP', exact: true }).click();
    await page.getByRole('button', { name: '复制 MCP 配置', exact: true }).click();
    await page.getByText('配置已复制，可以粘贴到 Agent 客户端。', { exact: true }).waitFor();
    const copied = await application.evaluate(({ clipboard }) => clipboard.readText());
    assert.equal(copied, expected.configuration);
    const filePath = path.join(directory, 'copied-mcp.json');
    await fs.writeFile(filePath, copied);
    client = await connectCopiedConfiguration({ filePath, directory });
    assert.equal((await client.listTools()).tools.length, 8);
    assert.ok(!(await client.callTool({ name: 'get_project', arguments: {} })).isError);
    await checkDirectPreview(client, artifacts);
    await saveHiddenScreenshot({ application, outputPath: path.join(artifacts, 'mcp-dialog.png') });
    await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  } catch (error) { failure = error; }
  const closed = await Promise.allSettled([client?.close(), restoreClipboard({ previous: previousClipboard, expected: expectedClipboard })]);
  failure ??= closed.find(result => result.status === 'rejected')?.reason;
  if (failure) throw failure;
}

/** Keep one copied adapter alive while the packaged editor closes and reopens twice. */
export async function checkCopiedMcpRestart(options) {
  const { directory, profile } = options;
  const client = await connectCopiedConfiguration({ filePath: path.join(directory, 'copied-mcp.json'), directory });
  let application;
  let failure;
  const env = { ...process.env, BONE_STUDIO_DEV_URL: '', BONE_STUDIO_USER_DATA: profile, BONE_STUDIO_HIDDEN: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  try {
    assert.equal((await client.callTool({ name: 'get_project', arguments: {} })).isError, true);
    for (let index = 0; index < 2; index += 1) {
      application = await electron.launch({ executablePath: path.resolve('release/win-unpacked/BoneStudio.exe'), cwd: directory, env, timeout: 30000 });
      const page = await application.firstWindow();
      await page.getByRole('button', { name: '保存', exact: true }).waitFor();
      assert.ok(!(await client.callTool({ name: 'get_project', arguments: {} })).isError);
      await application.close();
      application = undefined;
      assert.equal((await client.callTool({ name: 'get_project', arguments: {} })).isError, true);
    }
    console.log('实际复制配置：空目录 standalone Node stdio、同一适配器进程跨两次 EXE 重启连接恢复通过。');
  } catch (error) { failure = error; }
  const closed = await Promise.allSettled([client.close(), application?.close()]);
  failure ??= closed.find(result => result.status === 'rejected')?.reason;
  if (failure) throw failure;
}
