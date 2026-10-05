import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { removePackageTestDirectory, stopPortableProcess } from './check-package-cleanup.mjs';

const DIRECTORY = path.join(os.tmpdir(), 'bone-studio-package-test-cleanup-fixture');

test('Transient Windows file locks are retried before successful removal', async () => {
  const delays = [];
  let attempts = 0;
  await removePackageTestDirectory({ directory: DIRECTORY, wait: async delay => { delays.push(delay); }, remove: async (target, options) => {
    assert.equal(target, path.resolve(DIRECTORY));
    assert.deepEqual(options, { recursive: true, force: true });
    attempts += 1;
    if (attempts <= 2) throw Object.assign(new Error('Temporary lock'), { code: 'EBUSY' });
  } });
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [250, 500]);
});

test('Persistent locks report the original cause after bounded retries; unrelated errors are immediate', async () => {
  for (const code of ['EBUSY', 'EIO']) {
    let attempts = 0;
    const cause = Object.assign(new Error('Removal failed'), { code });
    await assert.rejects(removePackageTestDirectory({ directory: DIRECTORY, wait: async () => {}, remove: async () => {
      attempts += 1;
      throw cause;
    } }), error => code === 'EBUSY' ? error.cause === cause && /after 6 attempts/.test(error.message) : error === cause);
    assert.equal(attempts, code === 'EBUSY' ? 6 : 1);
  }
});

test('Unsafe roots and paths are rejected before any recursive removal', async () => {
  for (const directory of [os.tmpdir(), 'relative-profile', path.join(os.tmpdir(), 'user-profile'), path.join(DIRECTORY, '..', 'other-profile')]) {
    let attempts = 0;
    await assert.rejects(removePackageTestDirectory({ directory, remove: async () => { attempts += 1; } }), /Refusing to remove/);
    assert.equal(attempts, 0);
  }
});

test('Portable shutdown kills only the known PID tree and waits for its close event', async () => {
  let resolveClose;
  const closed = new Promise(resolve => { resolveClose = resolve; });
  let finished = false;
  const child = { pid: 4321, exitCode: null, signalCode: null };
  const stopping = stopPortableProcess({ child, closed, executeFile: async (command, args, options) => {
    assert.equal(command, 'taskkill.exe');
    assert.deepEqual(args, ['/PID', '4321', '/T', '/F']);
    assert.equal(options.windowsHide, true);
  } }).then(() => { finished = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false);
  resolveClose();
  await stopping;
  assert.equal(finished, true);
});

test('Signal exits avoid a second kill; termination failures and close timeouts stay visible', async context => {
  await stopPortableProcess({ child: { pid: 4321, exitCode: null, signalCode: 'SIGTERM' }, closed: Promise.resolve(), executeFile: async () => {
    assert.fail('An exited child must not be killed again.');
  } });
  const cause = new Error('Termination failed');
  await assert.rejects(stopPortableProcess({ child: { pid: 4321, exitCode: null, signalCode: null }, closed: Promise.resolve(), executeFile: async () => { throw cause; } }), error => error === cause);
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const stopping = stopPortableProcess({ child: { pid: 4321, exitCode: null, signalCode: null }, closed: new Promise(() => {}), executeFile: async () => {} });
  const rejected = assert.rejects(stopping, /did not close within 30 seconds/);
  context.mock.timers.tick(30000);
  await rejected;
});
