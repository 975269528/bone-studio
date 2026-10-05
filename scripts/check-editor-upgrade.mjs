import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { launchUpgradeSession, closeUpgradeSession, removeUpgradeDirectory, callUpgradeTool } from './editor-upgrade-session.mjs';
import { createUpgradeProject, configureUpgradeDialogs, openUpgradeFixture, checkFreshUpgrade, checkRestoredUpgrade, prepareUnavailableUpgrade, checkUnavailableUpgrade } from './editor-upgrade-startup.mjs';
import { checkUpgradePlayback } from './editor-upgrade-playback.mjs';
import { checkUpgradeKeyframes, checkUpgradeCurve, checkUpgradeDuration, captureUpgradeLayouts } from './editor-upgrade-timeline.mjs';
import { checkUpgradeAutoKey } from './editor-upgrade-auto-key.mjs';
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bone-studio-editor-upgrade-'));
const profile = path.join(directory, 'profile');
const artifacts = path.resolve('output/playwright');
const fixturePath = path.join(directory, 'fixture.json');
const savedPath = path.join(directory, 'saved.json');
let context;
let failure;

/** Exercise live keyboard and timeline interactions only through the isolated packaged UI. */
async function checkEditing() {
  await checkFreshUpgrade(context);
  await checkUpgradePlayback(context);
  await configureUpgradeDialogs({ context, fixturePath, savedPath });
  await openUpgradeFixture(context);
  await checkUpgradeKeyframes(context);
  await checkUpgradeCurve(context);
  await checkUpgradeDuration(context);
  await captureUpgradeLayouts({ context, artifacts });
  await context.page.getByRole('button', { name: '另存为', exact: true }).click();
  await context.page.getByText('项目已保存', { exact: true }).waitFor();
  assert.equal(await context.application.evaluate(() => globalThis.upgradeDialogs.saveCalls), 1);
  assert.deepEqual(context.errors, []);
  return (await callUpgradeTool(context.client, 'get_project')).project;
}

/** Restart isolated sessions with good and unavailable paths, proving clear fallback and no data writes. */
async function checkRestarts(expected) {
  await closeUpgradeSession(context); context = null;
  context = await launchUpgradeSession({ directory, profile });
  await checkRestoredUpgrade({ context, savedPath, expected });
  assert.deepEqual(context.errors, []);
  await closeUpgradeSession(context); context = null;
  const savedText = await fs.readFile(savedPath, 'utf8');
  for (const kind of ['missing', 'project', 'metadata']) {
    await prepareUnavailableUpgrade({ profile, directory, kind });
    context = await launchUpgradeSession({ directory, profile });
    await checkUnavailableUpgrade({ context, savedPath, expected: savedText });
    assert.deepEqual(context.errors, []);
    await closeUpgradeSession(context); context = null;
  }
}

try {
  if (process.platform !== 'win32') throw new Error('Packaged editor upgrade verification requires Windows.');
  await fs.mkdir(artifacts, { recursive: true });
  await fs.writeFile(fixturePath, JSON.stringify(createUpgradeProject()));
  context = await launchUpgradeSession({ directory, profile });
  if (process.argv.includes('--layouts-only')) {
    await configureUpgradeDialogs({ context, fixturePath, savedPath });
    await openUpgradeFixture(context);
    await checkUpgradeCurve(context);
    await captureUpgradeLayouts({ context, artifacts });
    console.log('Hidden packaged upgrade UI: inline curve and stable light/dark 1100/1600 layout capture passed.');
  } else if (process.argv.includes('--auto-only')) {
    await checkUpgradeAutoKey({ context, directory });
    console.log('Hidden packaged Auto K UI: off drafts/current PNG/manual K/metadata/undo; automatic FK move/rotation and IK pointer recording; literal input K; skeleton mode passed.');
  } else {
    await checkRestarts(await checkEditing());
    context = await launchUpgradeSession({ directory, profile });
    await checkUpgradeAutoKey({ context, directory });
    console.log('Hidden packaged upgrade UI: fresh skeleton/New label; Space repeat/release and editable guards; atomic multi-key normal/reverse paste/Delete/undo; inline curve pointer and sampled PNG; duration preview/retiming/undo; light/dark 1100/1600 layouts; restart/path/default/fallback passed.');
    console.log('Hidden packaged Auto K UI: off drafts/current PNG/manual K/metadata/undo; automatic FK move/rotation and IK pointer recording; literal input K; skeleton mode passed.');
  }
} catch (error) { failure = error; }
try { await closeUpgradeSession(context); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Upgrade verification and session cleanup failed.') : error; }
try { await removeUpgradeDirectory(directory); }
catch (error) { failure = failure ? new AggregateError([failure, error], 'Upgrade verification and temporary cleanup failed.') : error; }
if (failure) throw failure;
