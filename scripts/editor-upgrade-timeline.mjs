import assert from 'node:assert/strict';
import path from 'node:path';
import { callUpgradeTool, captureUpgrade } from './editor-upgrade-session.mjs';

function boneTrack(project) { return project.animations[0].tracks.find(track => track.boneId === 'upgrade-bone'); }
async function readProject(context) { return (await callUpgradeTool(context.client, 'get_project')).project; }

async function selectFirstKeys(page) {
  await page.getByRole('tab', { name: '关键帧', exact: true }).click();
  await page.getByRole('button', { name: '验收骨骼 0.00 秒关键帧', exact: true }).click();
  await page.getByRole('button', { name: '验收骨骼 1.00 秒关键帧', exact: true }).click({ modifiers: ['Shift'] });
  assert.equal(await page.locator('.key-diamond[aria-pressed="true"]').count(), 2);
}

async function seekRatio(page, ratio) {
  const bounds = await page.getByRole('slider', { name: '时间刻度定位', exact: true }).boundingBox();
  assert.ok(bounds);
  await page.mouse.click(bounds.x + bounds.width * ratio, bounds.y + bounds.height / 2);
}

/** Multi-key normal/reverse paste and Delete each publish one transaction recoverable by one Undo. */
export async function checkUpgradeKeyframes(context) {
  const before = await readProject(context);
  await selectFirstKeys(context.page);
  await context.page.getByRole('button', { name: '复制关键帧', exact: true }).click();
  await seekRatio(context.page, 0.5);
  await context.page.getByRole('button', { name: '粘贴关键帧', exact: true }).click();
  const forward = boneTrack(await readProject(context)).keyframes;
  assert.equal(forward.find(key => key.time === 2).rotation, -45);
  assert.equal(forward.find(key => key.time === 3).rotation, 0);
  await context.page.getByRole('button', { name: '撤销', exact: true }).click();
  assert.deepEqual(await readProject(context), before);
  await seekRatio(context.page, 0.5);
  await context.page.getByRole('button', { name: '倒序粘贴关键帧', exact: true }).click();
  const reversed = boneTrack(await readProject(context)).keyframes;
  assert.equal(reversed.find(key => key.time === 2).rotation, 0);
  assert.equal(reversed.find(key => key.time === 3).rotation, -45);
  await context.page.getByRole('button', { name: '撤销', exact: true }).click();
  assert.deepEqual(await readProject(context), before);
  await selectFirstKeys(context.page);
  await context.page.keyboard.press('Delete');
  const deleted = await readProject(context);
  assert.equal(boneTrack(deleted).keyframes.length, 2);
  assert.deepEqual(deleted.bones, before.bones);
  assert.deepEqual(deleted.animations[0].tracks[1], before.animations[0].tracks[1]);
  assert.equal(await context.page.getByRole('dialog').count(), 0);
  await context.page.keyboard.press('Control+z');
  assert.deepEqual(await readProject(context), before);
}

async function preview(context) {
  const result = await context.client.callTool({ name: 'render_preview', arguments: { animationId: 'upgrade-animation', time: 0.5 } });
  assert.ok(!result.isError);
  const image = result.content.find(item => item.type === 'image');
  assert.equal(image?.mimeType, 'image/png');
  return Buffer.from(image.data, 'base64');
}

/** Curve selection remains inline; actual pointer movement changes both saved easing and sampled PNG. */
export async function checkUpgradeCurve(context) {
  await context.page.getByRole('button', { name: '验收骨骼 0.00 秒关键帧', exact: true }).click();
  await context.page.getByRole('tab', { name: '曲线', exact: true }).click();
  assert.equal(await context.page.getByRole('dialog').count(), 0);
  await context.page.getByRole('combobox', { name: '当前关键帧出段缓动', exact: true }).selectOption('bezier');
  const before = await readProject(context); const imageBefore = await preview(context);
  const handle = await context.page.getByRole('slider', { name: '贝塞尔控制点 1', exact: true }).boundingBox();
  const plot = await context.page.locator('.curve-graph.is-editable .curve-plot').boundingBox();
  assert.ok(handle && plot);
  await context.page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await context.page.mouse.down();
  await context.page.mouse.move(plot.x + plot.width * 0.12, plot.y + plot.height * 0.15, { steps: 8 });
  await context.page.mouse.up();
  const after = await readProject(context);
  assert.notDeepEqual(boneTrack(after).keyframes[0].curve, boneTrack(before).keyframes[0].curve);
  assert.ok(!(await preview(context)).equals(imageBefore), 'Dragged easing must affect an actual rendered intermediate pose.');
  assert.equal(await context.page.getByRole('dialog').count(), 0);
  await context.page.getByRole('button', { name: '撤销', exact: true }).click();
  assert.deepEqual(await readProject(context), before);
  await context.page.getByRole('button', { name: '重做', exact: true }).click();
  assert.deepEqual(await readProject(context), after);
}

/** Duration drag previews without writes, retimes every FK track equally, and undoes atomically. */
export async function checkUpgradeDuration(context) {
  await context.page.getByRole('tab', { name: '关键帧', exact: true }).click();
  const before = await readProject(context);
  const bounds = await context.page.getByRole('slider', { name: '动作整体时长', exact: true }).boundingBox();
  assert.ok(bounds);
  await context.page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await context.page.mouse.down();
  await context.page.mouse.move(bounds.x + bounds.width / 2 - 100, bounds.y + bounds.height / 2, { steps: 8 });
  assert.deepEqual(await readProject(context), before, 'Duration preview must leave the canonical document untouched until release.');
  await context.page.mouse.up();
  const after = await readProject(context);
  const ratio = after.animations[0].duration / before.animations[0].duration;
  assert.ok(ratio > 0 && ratio < 1);
  before.animations[0].tracks.forEach((track, index) => track.keyframes.forEach((key, keyIndex) => {
    assert.ok(Math.abs(after.animations[0].tracks[index].keyframes[keyIndex].time - key.time * ratio) < 1e-7);
  }));
  await context.page.getByRole('button', { name: '撤销', exact: true }).click();
  assert.deepEqual(await readProject(context), before);
}

/** Capture and check the actual curve workspace in both themes at the supported small/large sizes. */
export async function captureUpgradeLayouts(options) {
  const { context, artifacts } = options;
  await context.page.getByRole('tab', { name: '曲线', exact: true }).click();
  for (const theme of ['dark', 'light']) {
    const current = await context.page.locator('html').getAttribute('data-theme');
    if (current !== theme) await context.page.getByRole('button', { name: `切换到${theme === 'light' ? '柔和浅色' : '柔和深色'}` }).click();
    for (const [width, height] of [[1600, 1000], [1100, 720]]) {
      await context.application.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), { width, height });
      await context.page.waitForFunction(size => globalThis.innerWidth === size.width && globalThis.innerHeight === size.height, { width, height });
      assert.equal(await context.page.getByRole('dialog').count(), 0);
      const handle = await context.page.getByRole('slider', { name: '贝塞尔控制点 1', exact: true }).boundingBox();
      assert.ok(handle && handle.x >= 0 && handle.y >= 0 && handle.x + handle.width <= width && handle.y + handle.height <= height);
      assert.ok(await context.page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth));
      await captureUpgrade({ context, outputPath: path.join(artifacts, `editor-upgrade-${theme}-${width}x${height}.png`) });
    }
  }
}
