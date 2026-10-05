import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const require = createRequire(import.meta.url);
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bone-studio-mcp-config-test-'));
const handlers = new Map();
const clipboard = { value: '', failure: null, async writeText(value) {
  if (this.failure) throw this.failure;
  this.value = value;
} };
const mainFrame = {};
const window = { webContents: { mainFrame } };
const sender = { sender: window.webContents, senderFrame: mainFrame };
const electronPath = require.resolve('electron');
const previousElectron = require.cache[electronPath];
require.cache[electronPath] = { exports: { app: { getPath: () => directory }, clipboard, nativeImage: {} } };
const { registerMcpConfiguration } = require('../electron/mcp-configuration.cjs');
registerMcpConfiguration(window, { handle: (name, handler) => handlers.set(name, handler) });

/** Validate the emitted adapter runs from an empty directory without node_modules or NODE_PATH. */
async function checkStandalone(configuration) {
  const server = configuration.mcpServers['bone-studio'];
  const client = new Client({ name: 'standalone-adapter-check', version: '1.0.0' });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: server.args, cwd: directory,
      env: { ...process.env, ...server.env, NODE_PATH: '', NODE_OPTIONS: '' } }));
    assert.equal((await client.listTools()).tools.length, 8);
    const invalid = await client.callTool({ name: 'apply_commands', arguments: { commands: [{ type: 'execute_code' }] } });
    assert.equal(invalid.isError, true);
    await handlers.get('mcp:copy')(sender);
    assert.equal(clipboard.value, JSON.stringify(configuration, null, 2));
    assert.equal((await client.listTools()).tools.length, 8);
  } finally { await client.close(); }
}

try {
  await assert.rejects(handlers.get('mcp:configuration')({ ...sender, senderFrame: {} }), /无权访问/);
  await assert.rejects(handlers.get('mcp:copy')({ ...sender, sender: {} }), /无权访问/);
  const result = await handlers.get('mcp:configuration')(sender);
  const configuration = JSON.parse(result.configuration);
  assert.deepEqual(configuration.mcpServers['bone-studio'], { command: 'node', args: [path.join(directory, 'mcp-adapter.cjs')], env: { BONE_STUDIO_CONNECTION: path.join(directory, 'ai-connection.json') } });
  assert.ok(result.requirements.some(value => value.includes('22.12')));
  assert.ok(!result.configuration.includes('token'));
  assert.ok(!result.configuration.includes(process.cwd()));
  await checkStandalone(configuration);
  clipboard.failure = new Error('模拟剪贴板写入失败');
  await assert.rejects(handlers.get('mcp:copy')(sender), /模拟剪贴板写入失败/);
  console.log('MCP 配置 IPC 来源保护、无令牌 JSON、空目录单文件 stdio 握手、运行中原子替换、剪贴板一致性与异步失败传播通过。');
} finally {
  if (previousElectron) require.cache[electronPath] = previousElectron;
  else delete require.cache[electronPath];
  assert.ok(directory.startsWith(path.join(os.tmpdir(), 'bone-studio-mcp-config-test-')));
  await fs.rm(directory, { recursive: true, force: true });
}
