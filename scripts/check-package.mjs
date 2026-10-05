import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { _electron as electron } from 'playwright';
import JSZip from 'jszip';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { checkPackageContent } from './check-package-content.mjs';
import { removePackageTestDirectory, stopPortableProcess } from './check-package-cleanup.mjs';
import { checkPackagedMcpConfiguration, checkCopiedMcpRestart, saveHiddenScreenshot } from './check-packaged-mcp.mjs';
const executeFile = promisify(execFile);
const regression = await executeFile(process.execPath, ['--test', path.resolve('scripts/check-packaged-clipboard.mjs'), path.resolve('scripts/check-package-cleanup-regression.mjs')], { windowsHide: true, timeout: 15000 });
console.log(regression.stdout.trim());
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bone-studio-package-test-'));
const artifacts = path.resolve('output/package-check');
const executablePath = path.resolve('release/BoneStudio.exe');
const connectionPath = path.join(directory, 'profile', 'ai-connection.json');

/** Call the existing source MCP adapter against only the isolated packaged editor. */
async function callTool(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, `MCP ${name} failed: ${JSON.stringify(result.content)}`);
  const text = result.content.find(item => item.type === 'text');
  assert.ok(text, `MCP ${name} returned no metadata`);
  return JSON.parse(text.text);
}

/** Create explicit small image fixtures outside the user's workspace and profile. */
async function createFixtures(page) {
  const png = page ? Buffer.from(await page.evaluate(() => {
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = 2; canvas.height = 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable for the image fixture.');
    context.fillStyle = '#bc50a0'; context.fillRect(0, 0, 2, 2);
    return canvas.toDataURL('image/png').split(',')[1];
  }), 'base64') : await fs.readFile(path.join(directory, 'head.png'));
  const files = ['head.png', 'body.png'].map(name => path.join(directory, name));
  await Promise.all(files.map(file => fs.writeFile(file, png)));
  const broken = path.join(directory, 'broken.png');
  await fs.writeFile(broken, 'invalid PNG');
  return { files, broken };
}

/** Verify native multi-file import, failure atomicity, undo and local project save/open. */
async function checkDesktopFiles(options) {
  const { application, page, client, fixtures } = options;
  const before = await callTool(client, 'get_project');
  await application.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
  }, fixtures.files);
  await page.getByRole('button', { name: /^素材/ }).click();
  await page.getByRole('button', { name: '导入图片', exact: true }).click();
  await page.getByText('已导入 2 张图片', { exact: true }).waitFor();
  const imported = await callTool(client, 'get_project');
  assert.equal(imported.project.assets.length, before.project.assets.length + 2);
  assert.deepEqual(imported.project.attachments, before.project.attachments);
  await application.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
  }, [fixtures.files[0], fixtures.broken]);
  await page.getByRole('button', { name: '导入图片', exact: true }).click();
  await page.getByText(/图片无法解码或边长超过/).waitFor();
  assert.deepEqual((await callTool(client, 'get_project')).project, imported.project);
  await page.keyboard.press('Control+z');
  assert.deepEqual((await callTool(client, 'get_project')).project, before.project);
  await callTool(client, 'redo');
  const projectPath = path.join(directory, 'desktop-save.json');
  await application.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, projectPath);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByText('项目已保存', { exact: true }).waitFor();
  assert.deepEqual(JSON.parse(await fs.readFile(projectPath, 'utf8')), imported.project);
  await application.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, projectPath);
  await page.getByRole('button', { name: '打开', exact: true }).click();
  await page.getByText('项目已打开', { exact: true }).waitFor();
  assert.deepEqual((await callTool(client, 'get_project')).project, imported.project);
}

/** Exercise packaged production dependencies through preview, import, ZIP and save tools. */
async function checkMcpFiles(options) {
  const { client, fixtures } = options;
  const outputDirectory = await fs.mkdtemp(path.join(directory, 'mcp-files-'));
  const before = await callTool(client, 'get_project');
  const imported = await callTool(client, 'import_images', { paths: fixtures.files });
  assert.equal(imported.project.assets.length, before.project.assets.length + 2);
  await callTool(client, 'undo');
  const preview = await callTool(client, 'render_preview');
  assert.equal(preview.mimeType, 'image/png');
  assert.equal(preview.width, before.project.width);
  for (const format of ['sequence', 'sheet']) {
    const outputPath = path.join(outputDirectory, `${format}.zip`);
    const exported = await callTool(client, 'export_animation', { animationId: before.project.animations[0].id, format, fps: 1, outputPath });
    const archive = await JSZip.loadAsync(await fs.readFile(outputPath));
    assert.ok(archive.file('animation.json'));
    assert.ok(Object.keys(archive.files).some(name => name.endsWith('.png')));
    assert.ok(exported.frameCount > 0);
  }
  const outputPath = path.join(outputDirectory, 'mcp-save.json');
  await callTool(client, 'save_project', { outputPath });
  assert.deepEqual(JSON.parse(await fs.readFile(outputPath, 'utf8')), before.project);
  const existing = await client.callTool({ name: 'save_project', arguments: { outputPath } });
  assert.equal(existing.isError, true);
  const invalid = await client.callTool({ name: 'import_images', arguments: { paths: [fixtures.broken] } });
  assert.equal(invalid.isError, true);
  assert.deepEqual((await callTool(client, 'get_project')).project, before.project);
}

/** Inspect only this launcher process tree; reject command shells and console hosts. */
async function checkProcessTree(rootPid) {
  const script = `$items=Get-CimInstance Win32_Process; $ids=@(${rootPid}); do { $next=@($items | Where-Object { $_.ParentProcessId -in $ids -and $_.ProcessId -notin $ids }); $ids+=@($next.ProcessId) } while ($next.Count -gt 0); $items | Where-Object { $_.ProcessId -in $ids } | Select-Object Name,ProcessId,ParentProcessId | ConvertTo-Json -Compress`;
  const { stdout } = await executeFile('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 15000 });
  const tree = [].concat(JSON.parse(stdout));
  await fs.writeFile(path.join(artifacts, 'process-tree.json'), JSON.stringify(tree, null, 2));
  assert.ok(tree.some(item => item.Name.toLowerCase() === 'bonestudio.exe'));
  assert.ok(tree.every(item => !/^(?:cmd|powershell|pwsh|conhost|node)\.exe$/i.test(item.Name)), JSON.stringify(tree));
  return tree;
}

/** Launch the packaged editor in a fresh hidden profile, never the user's live session. */
async function checkPackagedEditor() {
  if (process.platform !== 'win32') throw new Error('Packaged EXE verification requires Windows.');
  await fs.mkdir(artifacts, { recursive: true });
  const content = await checkPackageContent(executablePath);
  const env = { ...process.env, BONE_STUDIO_DEV_URL: '', BONE_STUDIO_DEBUG_PORT: '', BONE_STUDIO_USER_DATA: path.dirname(connectionPath), BONE_STUDIO_HIDDEN: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const application = await electron.launch({ executablePath: path.resolve('release/win-unpacked/BoneStudio.exe'), cwd: directory, env, timeout: 30000 });
  const client = new Client({ name: 'bone-studio-package-check', version: '1.0.0' });
  let failure;
  try {
    const page = await application.firstWindow();
    const fixtures = await createFixtures(page);
    await page.getByRole('button', { name: '保存', exact: true }).waitFor();
    assert.ok(page.url().startsWith('file:'));
    assert.ok(page.url().includes('app.asar/dist/index.html'));
    const profile = await application.evaluate(({ app, BrowserWindow }) => ({ userData: app.getPath('userData'), sessionData: app.getPath('sessionData'), visible: BrowserWindow.getAllWindows()[0].isVisible(), packaged: app.isPackaged }));
    assert.deepEqual(profile, { userData: path.dirname(connectionPath), sessionData: path.dirname(connectionPath), visible: false, packaged: true });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.resolve('electron/mcp.cjs')], env: { ...process.env, BONE_STUDIO_CONNECTION: connectionPath } }));
    await checkDesktopFiles({ application, page, client, fixtures });
    await checkMcpFiles({ client, fixtures });
    await checkPackagedMcpConfiguration({ application, page, directory, artifacts });
    const connection = JSON.parse(await fs.readFile(connectionPath, 'utf8'));
    const unauthorized = await fetch(`http://127.0.0.1:${connection.port}/command`, { method: 'POST', signal: AbortSignal.timeout(5000) });
    assert.equal(unauthorized.status, 403);
    await saveHiddenScreenshot({ application, outputPath: path.join(artifacts, 'editor.png') });
    const mainPid = await application.evaluate(() => process.pid);
    const tree = await checkProcessTree(mainPid);
    console.log(JSON.stringify({ executablePath, ...content, profile, processNames: tree.map(item => item.Name), checks: 'native batch import/error/undo/save/open; MCP import/preview/export/save/auth; file UI; GUI PE; isolated profile', screenshot: path.join(artifacts, 'editor.png') }, null, 2));
  } catch (error) { failure = error; }
  const closed = await Promise.allSettled([client.close(), application.close()]);
  failure ??= closed.find(result => result.status === 'rejected')?.reason;
  if (failure) throw failure;
  await assert.rejects(fs.stat(connectionPath), error => error.code === 'ENOENT');
}

/** Wait until the portable's own connection metadata is complete without exposing credentials. */
async function waitForConnection(filePath) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { JSON.parse(await fs.readFile(filePath, 'utf8')); return; }
    catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Portable EXE did not publish its isolated connection within 60 seconds.');
}

/** Verify the portable launcher without inspector flags, using its independent MCP connection. */
async function checkPortableLauncher({ isSmoke = false } = {}) {
  const profile = path.join(directory, 'portable-profile');
  const connection = path.join(profile, 'ai-connection.json');
  const env = { ...process.env, BONE_STUDIO_DEV_URL: 'http://127.0.0.1:5173', BONE_STUDIO_USER_DATA: profile, BONE_STUDIO_HIDDEN: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(executablePath, [], { cwd: directory, env, windowsHide: true, stdio: 'ignore' });
  const closed = new Promise(resolve => child.once('close', resolve));
  const launched = new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  const client = new Client({ name: 'bone-studio-portable-check', version: '1.0.0' });
  let failure;
  try {
    await launched;
    await waitForConnection(connection);
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.resolve('electron/mcp.cjs')], env: { ...process.env, BONE_STUDIO_CONNECTION: connection } }));
    if (isSmoke) await checkPortablePreview(client);
    else await checkMcpFiles({ client, fixtures: await createFixtures() });
    const tree = await checkProcessTree(child.pid);
    const checks = isSmoke ? 'renamed portable EXE; isolated MCP PNG preview; no console process; ASAR local-load guard' : 'real portable EXE; MCP batch/undo/preview/export/save; local loading verified by ASAR guard plus packaged file URL';
    console.log(JSON.stringify({ portableLauncher: executablePath, processNames: tree.map(item => item.Name), checks }, null, 2));
  } catch (error) { failure = error; }
  const cleanup = await Promise.allSettled([client.close(), stopPortableProcess({ child, closed, executeFile })]);
  failure ??= cleanup.find(result => result.status === 'rejected')?.reason;
  if (failure) throw failure;
}

/** Check the renamed portable through direct PNG output without GUI or clipboard interactions. */
async function checkPortablePreview(client) {
  const result = await client.callTool({ name: 'render_preview', arguments: {} });
  assert.ok(!result.isError);
  const image = result.content.find(item => item.type === 'image');
  assert.equal(image?.mimeType, 'image/png');
  const png = Buffer.from(image.data, 'base64');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const metadata = JSON.parse(result.content.find(item => item.type === 'text').text);
  assert.equal(png.readUInt32BE(16), metadata.width);
  assert.equal(png.readUInt32BE(20), metadata.height);
  await fs.writeFile(path.join(artifacts, 'portable-preview.png'), png);
}

/** Invalid storage overrides must exit explicitly before adopting any existing profile. */
async function checkInvalidProfile() {
  const env = { ...process.env, BONE_STUDIO_USER_DATA: 'relative-profile', BONE_STUDIO_HIDDEN: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  await assert.rejects(executeFile(path.resolve('release/win-unpacked/BoneStudio.exe'), [], { cwd: directory, env, windowsHide: true, timeout: 10000 }), error => {
    assert.equal(error.code, 1);
    assert.ok(error.stderr.includes('BONE_STUDIO_USER_DATA 必须是绝对目录路径。'));
    assert.ok(!error.stderr.includes('Unhandled'));
    return true;
  });
}

let failure;
try {
  if (process.argv.includes('--portable-smoke')) {
    await fs.mkdir(artifacts, { recursive: true });
    console.log(JSON.stringify(await checkPackageContent(executablePath)));
    await checkPortableLauncher({ isSmoke: true });
  } else {
    await checkInvalidProfile();
    await checkPackagedEditor();
    await checkCopiedMcpRestart({ directory, profile: path.dirname(connectionPath) });
    await checkPortableLauncher();
  }
} catch (error) { failure = error; }
try { await removePackageTestDirectory({ directory }); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Package verification and temporary directory cleanup both failed.') : error; }
if (failure) throw failure;
