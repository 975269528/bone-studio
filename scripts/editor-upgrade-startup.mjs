import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { callUpgradeTool } from './editor-upgrade-session.mjs';

/** Build a deterministic animated image fixture without importing unbuilt renderer modules. */
export function createUpgradeProject() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="24"><rect x="0" y="2" width="112" height="20" rx="9" fill="#f2954e"/><circle cx="100" cy="12" r="7" fill="#fff1cb"/></svg>';
  const bone = { id: 'upgrade-bone', name: '验收骨骼', parentId: null, x: 130, y: 180, rotation: 0, length: 110 };
  const secondary = { ...bone, id: 'upgrade-secondary', name: '辅助骨骼', x: 100, y: 90, length: 60 };
  const keyframes = [0, 1, 2, 3].map((time, index) => ({ time, x: bone.x, y: bone.y, rotation: [-45, 0, 60, 100][index] }));
  return { version: 1, id: 'upgrade-project', name: '桌面升级验收', width: 320, height: 320,
    assets: [{ id: 'upgrade-image', name: '验收图片', width: 120, height: 24, dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` }],
    bones: [bone, secondary], ikConstraints: [],
    attachments: [{ id: 'upgrade-part', name: '验收部件', assetId: 'upgrade-image', boneId: bone.id, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0, anchorY: 0.5, opacity: 1, zIndex: 0 }],
    animations: [{ id: 'upgrade-animation', name: '验收动作', duration: 4, fps: 20, loop: true,
      tracks: [{ boneId: bone.id, keyframes, interpolation: 'linear' }, { boneId: secondary.id, interpolation: 'linear', keyframes: [{ time: 0, x: 100, y: 90, rotation: 0 }, { time: 3, x: 100, y: 90, rotation: 90 }] }] }],
  };
}

/** Mock native dialogs only inside the dedicated hidden application; never open real system dialogs. */
export async function configureUpgradeDialogs(options) {
  await options.context.application.evaluate(({ dialog }, paths) => {
    globalThis.upgradeDialogs = { saveCalls: 0, openDefaults: [] };
    dialog.showSaveDialog = async () => { globalThis.upgradeDialogs.saveCalls += 1; return { canceled: false, filePath: paths.savedPath }; };
    dialog.showOpenDialog = async (_window, choices) => {
      globalThis.upgradeDialogs.openDefaults.push(choices.defaultPath ?? null);
      return { canceled: false, filePaths: [paths.fixturePath] };
    };
  }, { fixturePath: options.fixturePath, savedPath: options.savedPath });
}

/** Open a native-approved fixture through actual toolbar and confirmation clicks. */
export async function openUpgradeFixture(context) {
  await context.page.getByRole('button', { name: '打开', exact: true }).click();
  const pending = context.page.getByRole('button', { name: '继续打开', exact: true });
  if (await pending.isVisible()) await pending.click();
  await context.page.getByText('项目已打开', { exact: true }).waitFor();
  assert.equal((await callUpgradeTool(context.client, 'get_project')).project.id, 'upgrade-project');
}

/** A new profile begins as a clean empty skeleton with a visible textual New control. */
export async function checkFreshUpgrade(context) {
  const initial = await callUpgradeTool(context.client, 'get_project');
  for (const field of ['bones', 'assets', 'attachments', 'animations', 'ikConstraints']) assert.deepEqual(initial.project[field], []);
  assert.equal(initial.dirty, false);
  assert.equal((await context.page.getByRole('button', { name: '新建项目', exact: true }).innerText()).trim(), '新建');
  await context.page.getByRole('button', { name: '新建项目', exact: true }).click();
  await context.page.getByRole('button', { name: '加载示例人物', exact: true }).click();
  assert.ok((await callUpgradeTool(context.client, 'get_project')).project.animations.length);
}

/** Save, reopen after process restart, overwrite without a dialog, and inspect the open default. */
export async function checkRestoredUpgrade(options) {
  const { context, savedPath, expected } = options;
  const restored = await callUpgradeTool(context.client, 'get_project');
  assert.deepEqual(restored.project, expected);
  assert.equal(restored.dirty, false);
  assert.equal(await context.page.locator('.project-title').getAttribute('title'), savedPath);
  await configureUpgradeDialogs({ context, fixturePath: savedPath, savedPath });
  await context.page.getByRole('button', { name: '保存', exact: true }).click();
  await context.page.getByText('项目已保存', { exact: true }).waitFor();
  assert.equal(await context.application.evaluate(() => globalThis.upgradeDialogs.saveCalls), 0);
  await context.page.getByRole('button', { name: '打开', exact: true }).click();
  await context.page.getByText('项目已打开', { exact: true }).waitFor();
  assert.equal(await context.application.evaluate(() => globalThis.upgradeDialogs.openDefaults.at(-1)), savedPath);
  assert.deepEqual(JSON.parse(await fs.readFile(savedPath, 'utf8')), expected);
}

/** Prepare missing/corrupt restart inputs only after the owning hidden process has closed. */
export async function prepareUnavailableUpgrade(options) {
  const { profile, directory, kind } = options;
  const settings = path.join(profile, 'recent-project.json');
  if (kind === 'metadata') return fs.writeFile(settings, '{invalid');
  const filePath = path.join(directory, `${kind}.json`);
  if (kind === 'project') await fs.writeFile(filePath, '{invalid');
  await fs.writeFile(settings, JSON.stringify({ version: 1, latestProjectPath: filePath }));
}

/** Failed automatic restore must show a clear fallback and preserve every source byte. */
export async function checkUnavailableUpgrade(options) {
  const { context, savedPath, expected } = options;
  const current = await callUpgradeTool(context.client, 'get_project');
  assert.deepEqual(current.project.bones, []);
  assert.deepEqual(current.project.animations, []);
  assert.equal(current.dirty, false);
  await context.page.getByText(/无法恢复上次项目：/).waitFor();
  assert.equal(await fs.readFile(savedPath, 'utf8'), expected);
}
