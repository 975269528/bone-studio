import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { callUpgradeTool } from './editor-upgrade-session.mjs';
import { configureUpgradeDialogs, openUpgradeFixture } from './editor-upgrade-startup.mjs';
import { createAutoKeyProject } from './editor-upgrade-auto-fixture.mjs';
const FK_NAME = '验收骨骼';
const IK_NAME = '⊕ 验收 IK';
const CHECK_TIME = 0.5;

async function readState(context) { return callUpgradeTool(context.client, 'get_project'); }
function fkKeys(project) { return project.animations[0].tracks[0].keyframes; }
function ikKeys(project) { return project.ikConstraints[0].targetKeys; }
async function selectObject(context, name) { await context.page.locator('.track-name').filter({ hasText: new RegExp(`^${name}$`) }).click(); }

async function seekTime(context, time) {
  const ruler = context.page.getByRole('slider', { name: '时间刻度定位', exact: true });
  const bounds = await ruler.boundingBox();
  assert.ok(bounds);
  await context.page.mouse.click(bounds.x + bounds.width * time / 4, bounds.y + bounds.height / 2);
  assert.ok((await context.page.locator('.time-code').innerText()).startsWith(time.toFixed(2)));
}

async function editNumber(context, label, value) {
  const input = context.page.locator('.inspector').getByRole('spinbutton', { name: label, exact: true });
  await input.fill(String(value));
  await input.press('Enter');
  assert.equal(Number(await input.inputValue()), value);
}

async function currentPreview(context) {
  const response = await context.client.callTool({ name: 'render_preview', arguments: {} });
  assert.ok(!response.isError);
  const image = response.content.find(item => item.type === 'image');
  assert.equal(image?.mimeType, 'image/png');
  return Buffer.from(image.data, 'base64');
}

async function undoProject(context, expected) {
  const undo = context.page.getByRole('button', { name: '撤销', exact: true });
  assert.ok(await undo.isEnabled(), 'Canonical history or an unrecorded draft must enable the Undo control.');
  await undo.click();
  assert.deepEqual((await readState(context)).project, expected);
}

async function dragCanvas(context, start, end) {
  const bounds = await context.page.getByLabel('角色动画画布', { exact: true }).boundingBox();
  assert.ok(bounds);
  const point = position => ({ x: bounds.x + bounds.width * position.x / 320, y: bounds.y + bounds.height * position.y / 320 });
  const origin = point(start); const destination = point(end);
  await context.page.mouse.move(origin.x, origin.y);
  await context.page.mouse.down();
  await context.page.mouse.move(destination.x, destination.y, { steps: 8 });
  await context.page.mouse.up();
}

/** A clicked Auto K switch keeps its value through Space repeat/release while playback toggles once. */
async function checkAutoSwitchSpace(context) {
  const toggle = context.page.getByRole('switch', { name: '自动 K 帧', exact: true });
  assert.equal(await toggle.getAttribute('aria-checked'), 'false');
  const before = (await readState(context)).project;
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'true');
  await context.page.keyboard.down('Space');
  await context.page.keyboard.down('Space');
  await context.page.keyboard.down('Space');
  await context.page.keyboard.up('Space');
  await context.page.getByRole('button', { name: '暂停播放', exact: true }).waitFor();
  assert.equal(await toggle.getAttribute('aria-checked'), 'true');
  assert.deepEqual((await readState(context)).project, before);
  await context.page.keyboard.press('Space');
  await context.page.getByRole('button', { name: '播放动作', exact: true }).waitFor();
  assert.equal(await toggle.getAttribute('aria-checked'), 'true');
  await toggle.click();
}

/** Default-off FK edits are visible drafts; manual K commits once and retains existing easing. */
async function checkManualFk(context) {
  const control = context.page.getByRole('switch', { name: '自动 K 帧', exact: true });
  assert.equal(await control.getAttribute('aria-checked'), 'false');
  await selectObject(context, FK_NAME);
  await seekTime(context, CHECK_TIME);
  const before = await readState(context); const imageBefore = await currentPreview(context);
  await editNumber(context, 'X 位置', 150);
  await editNumber(context, '旋转 °', 25);
  const draft = await readState(context);
  assert.deepEqual(draft.project, before.project);
  assert.equal(draft.revision, before.revision);
  assert.equal(draft.dirty, before.dirty);
  assert.ok(!(await currentPreview(context)).equals(imageBefore));
  await context.page.keyboard.press('k');
  const recorded = await readState(context);
  assert.equal(fkKeys(recorded.project).length, fkKeys(before.project).length + 1);
  const key = fkKeys(recorded.project).find(item => item.time === CHECK_TIME);
  assert.equal(key.x, 150); assert.equal(key.rotation, 25);
  await undoProject(context, before.project);
  await seekTime(context, 0);
  await editNumber(context, '旋转 °', -20);
  await context.page.keyboard.press('k');
  const updated = fkKeys((await readState(context)).project)[0];
  assert.equal(updated.rotation, -20);
  assert.equal(updated.interpolation, fkKeys(before.project)[0].interpolation);
  assert.deepEqual(updated.curve, fkKeys(before.project)[0].curve);
  await undoProject(context, before.project);
}

/** Default-off IK draft Undo leaves document history intact; manual K records only the selected target. */
async function checkManualIk(context) {
  await seekTime(context, CHECK_TIME);
  await selectObject(context, IK_NAME);
  const before = await readState(context); const imageBefore = await currentPreview(context);
  await editNumber(context, '目标 X', 105);
  await editNumber(context, '目标 Y', 110);
  assert.deepEqual((await readState(context)).project, before.project);
  assert.ok(!(await currentPreview(context)).equals(imageBefore));
  await undoProject(context, before.project);
  assert.ok((await currentPreview(context)).equals(imageBefore));
  assert.equal((await readState(context)).revision, before.revision);
  await editNumber(context, '目标 X', 105);
  await context.page.keyboard.press('k');
  const after = (await readState(context)).project;
  assert.equal(ikKeys(after).length, ikKeys(before.project).length + 1);
  assert.equal(ikKeys(after).find(item => item.time === CHECK_TIME).x, 105);
  assert.deepEqual(after.animations, before.project.animations);
  await undoProject(context, before.project);
}

async function startNumericScrub(context, label, distance) {
  const bounds = await context.page.locator('.inspector .numeric-scrub').filter({ hasText: new RegExp(`^${label}$`) }).boundingBox();
  assert.ok(bounds);
  await context.page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await context.page.mouse.down();
  await context.page.mouse.move(bounds.x + bounds.width / 2 + distance, bounds.y + bounds.height / 2, { steps: 8 });
}

/** Multi-step scrubs keep progressing; Escape restores their snapshot, retaining earlier unrecorded poses. */
async function checkNumericDraftEscape(context) {
  await selectObject(context, FK_NAME);
  await editNumber(context, 'X 位置', 150);
  const before = (await readState(context)).project; const preview = await currentPreview(context);
  const rotationInput = context.page.locator('.inspector').getByRole('spinbutton', { name: '旋转 °', exact: true });
  const rotation = Number(await rotationInput.inputValue());
  await startNumericScrub(context, '旋转 °', 30);
  assert.ok(Number(await rotationInput.inputValue()) > rotation + 15, 'Every scrub pointer step must continue despite the first draft notice.');
  assert.deepEqual((await readState(context)).project, before);
  await context.page.keyboard.press('Escape'); await context.page.mouse.up();
  assert.equal(Number(await rotationInput.inputValue()), rotation);
  assert.equal(Number(await context.page.locator('.inspector').getByRole('spinbutton', { name: 'X 位置', exact: true }).inputValue()), 150);
  assert.ok((await currentPreview(context)).equals(preview));
  await startNumericScrub(context, '长度 px', 25);
  assert.notDeepEqual((await readState(context)).project.bones, before.bones);
  await context.page.keyboard.press('Escape'); await context.page.mouse.up();
  assert.deepEqual((await readState(context)).project, before);
  assert.equal(Number(await context.page.locator('.inspector').getByRole('spinbutton', { name: 'X 位置', exact: true }).inputValue()), 150);
  assert.ok((await currentPreview(context)).equals(preview));
  await context.page.getByRole('button', { name: '验收部件', exact: true }).click();
  await startNumericScrub(context, 'X 偏移', 25);
  assert.notDeepEqual((await readState(context)).project.attachments, before.attachments);
  await context.page.keyboard.press('Escape'); await context.page.mouse.up();
  assert.deepEqual((await readState(context)).project, before);
  await selectObject(context, FK_NAME);
  assert.equal(Number(await context.page.locator('.inspector').getByRole('spinbutton', { name: 'X 位置', exact: true }).inputValue()), 150);
  assert.ok((await currentPreview(context)).equals(preview));
  await undoProject(context, before);
}

/** Auto K records real canvas FK movement/rotation and IK target drags, with one Undo per gesture. */
async function checkAutomaticGestures(context) {
  await context.page.getByRole('switch', { name: '自动 K 帧', exact: true }).click();
  assert.equal(await context.page.getByRole('switch', { name: '自动 K 帧', exact: true }).getAttribute('aria-checked'), 'true');
  await selectObject(context, FK_NAME);
  const before = (await readState(context)).project;
  await dragCanvas(context, { x: 130, y: 180 }, { x: 150, y: 190 });
  const moved = fkKeys((await readState(context)).project).find(key => key.time === CHECK_TIME);
  assert.ok(moved && Math.abs(moved.x - 150) < 1.5 && Math.abs(moved.y - 190) < 1.5);
  await undoProject(context, before);
  const input = context.page.locator('.inspector').getByRole('spinbutton', { name: '旋转 °', exact: true });
  const rotation = Number(await input.inputValue());
  const angle = rotation * Math.PI / 180;
  await dragCanvas(context, { x: 130 + 110 * Math.cos(angle), y: 180 + 110 * Math.sin(angle) }, { x: 200, y: 240 });
  const rotated = fkKeys((await readState(context)).project).find(key => key.time === CHECK_TIME);
  assert.ok(rotated && Math.abs(rotated.rotation - rotation) > 10);
  await undoProject(context, before);
  await selectObject(context, IK_NAME);
  const targetX = Number(await context.page.locator('.inspector').getByRole('spinbutton', { name: '目标 X', exact: true }).inputValue());
  const targetY = Number(await context.page.locator('.inspector').getByRole('spinbutton', { name: '目标 Y', exact: true }).inputValue());
  await dragCanvas(context, { x: targetX, y: targetY }, { x: 110, y: 110 });
  const target = ikKeys((await readState(context)).project).find(key => key.time === CHECK_TIME);
  assert.ok(target && Math.abs(target.x - 110) < 1.5 && Math.abs(target.y - 110) < 1.5);
  await undoProject(context, before);
}

/** Manual K retains other objects' drafts; seek and Auto K toggle discard drafts without recording. */
async function checkDraftLifecycle(context) {
  const toggle = context.page.getByRole('switch', { name: '自动 K 帧', exact: true });
  await toggle.click();
  const before = (await readState(context)).project;
  await selectObject(context, FK_NAME);
  await editNumber(context, 'X 位置', 150);
  await selectObject(context, IK_NAME);
  await editNumber(context, '目标 X', 105);
  await selectObject(context, FK_NAME);
  await context.page.keyboard.press('k');
  const recorded = (await readState(context)).project;
  assert.equal(fkKeys(recorded).find(key => key.time === CHECK_TIME).x, 150);
  assert.deepEqual(ikKeys(recorded), ikKeys(before));
  await selectObject(context, IK_NAME);
  assert.equal(Number(await context.page.locator('.inspector').getByRole('spinbutton', { name: '目标 X', exact: true }).inputValue()), 105);
  await undoProject(context, recorded);
  await undoProject(context, before);
  await selectObject(context, FK_NAME);
  await editNumber(context, 'X 位置', 150);
  await seekTime(context, 1);
  await seekTime(context, CHECK_TIME);
  assert.equal(Number(await context.page.locator('.inspector').getByRole('spinbutton', { name: 'X 位置', exact: true }).inputValue()), 130);
  assert.deepEqual((await readState(context)).project, before);
  await editNumber(context, 'X 位置', 150);
  await toggle.click();
  assert.deepEqual((await readState(context)).project, before);
  assert.equal(Number(await context.page.locator('.inspector').getByRole('spinbutton', { name: 'X 位置', exact: true }).inputValue()), 130);
}

/** Inputs retain literal K; skeleton transforms and skeleton K never write animation keys. */
async function checkInputAndRig(context) {
  await selectObject(context, FK_NAME);
  const before = (await readState(context)).project;
  const name = context.page.locator('.inspector input[data-name-field]');
  await name.focus(); await name.press('End'); await name.press('k');
  assert.equal(await name.inputValue(), `${FK_NAME}k`);
  assert.deepEqual((await readState(context)).project, before);
  await name.press('Escape');
  await context.page.locator('.edit-modes').getByRole('button', { name: /^骨架/ }).click();
  await editNumber(context, '起点 X', 140);
  const rig = (await readState(context)).project;
  assert.notDeepEqual(rig.bones, before.bones);
  assert.deepEqual(rig.animations, before.animations);
  assert.deepEqual(rig.ikConstraints, before.ikConstraints);
  await context.page.keyboard.press('k');
  assert.deepEqual((await readState(context)).project, rig);
  await undoProject(context, before);
}

/** Verify the Auto K policy exclusively through hidden packaged controls and current-session MCP reads. */
export async function checkUpgradeAutoKey(options) {
  const { context, directory } = options;
  const fixturePath = path.join(directory, 'auto-key-fixture.json');
  await fs.writeFile(fixturePath, JSON.stringify(createAutoKeyProject()));
  await configureUpgradeDialogs({ context, fixturePath, savedPath: path.join(directory, 'auto-key-save.json') });
  await openUpgradeFixture(context);
  await context.page.getByRole('tab', { name: '关键帧', exact: true }).click();
  await checkAutoSwitchSpace(context);
  await checkManualFk(context);
  await checkManualIk(context);
  await checkNumericDraftEscape(context);
  await checkAutomaticGestures(context);
  await checkDraftLifecycle(context);
  await checkInputAndRig(context);
  assert.deepEqual(context.errors, []);
}
