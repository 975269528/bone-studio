import assert from 'node:assert/strict';
import { callUpgradeTool } from './editor-upgrade-session.mjs';

/** Space down/repeats/up toggles playback once and never synthesizes a focused button click. */
export async function checkUpgradePlayback(context) {
  const button = context.page.getByRole('button', { name: '切换循环播放', exact: true });
  await button.evaluate(element => {
    element.dataset.upgradeClicks = '0';
    element.addEventListener('click', () => { element.dataset.upgradeClicks = String(Number(element.dataset.upgradeClicks) + 1); });
  });
  await button.click();
  const before = await callUpgradeTool(context.client, 'get_project');
  await context.page.keyboard.down('Space');
  await context.page.keyboard.down('Space');
  await context.page.keyboard.down('Space');
  await context.page.keyboard.up('Space');
  await context.page.getByRole('button', { name: '暂停播放', exact: true }).waitFor();
  assert.equal(await button.getAttribute('data-upgrade-clicks'), '1');
  const after = await callUpgradeTool(context.client, 'get_project');
  assert.equal(after.revision, before.revision);
  assert.equal(after.project.animations[0].loop, before.project.animations[0].loop);
  await context.page.keyboard.press('Space');
  await context.page.getByRole('button', { name: '播放动作', exact: true }).waitFor();
  await checkEditableSpace(context.page);
}

async function checkEditableSpace(page) {
  const name = page.getByRole('textbox', { name: /动作名称/ });
  await name.fill('输入');
  await page.keyboard.press('Space');
  assert.equal(await name.inputValue(), '输入 ');
  assert.equal(await page.getByRole('button', { name: '暂停播放', exact: true }).count(), 0);
  const selector = page.getByRole('combobox', { name: '当前动作', exact: true });
  await selector.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: '暂停播放', exact: true }).count(), 0);
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await page.getByRole('dialog', { name: '新建项目', exact: true }).waitFor();
  await page.getByRole('button', { name: '取消', exact: true }).focus();
  await page.keyboard.press('Space');
  assert.equal(await page.getByRole('button', { name: '暂停播放', exact: true }).count(), 0);
  assert.equal(await page.getByRole('dialog').count(), 0);
}
