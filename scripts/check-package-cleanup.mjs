import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const PROCESS_CLOSE_TIMEOUT_MS = 30000;
const REMOVE_ATTEMPTS = 6;
const REMOVE_RETRY_DELAY_MS = 250;
const RETRYABLE_REMOVE_ERRORS = new Set(['EBUSY', 'EPERM', 'ENOTEMPTY']);
const TEST_DIRECTORY_PREFIX = 'bone-studio-package-test-';

/** Stop only the spawned portable PID tree and await its already-observed close event. */
export async function stopPortableProcess(options) {
  const { child, closed, executeFile } = options;
  if (!child.pid) return;
  if (!Number.isInteger(child.pid) || child.pid <= 0) throw new Error('Invalid portable test PID; refusing to terminate it.');
  let timer;
  const deadline = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Portable test process did not close within 30 seconds.')), PROCESS_CLOSE_TIMEOUT_MS);
  });
  try {
    const terminate = child.exitCode === null && child.signalCode === null
      ? executeFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 15000 })
      : Promise.resolve();
    const results = await Promise.allSettled([terminate, Promise.race([closed, deadline])]);
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  } finally { clearTimeout(timer); }
}

/** Remove only this run's absolute temporary root, retrying short Windows file locks finitely. */
export async function removePackageTestDirectory(options) {
  const { directory, remove = fs.rm, wait = delay } = options;
  const target = path.resolve(directory);
  const name = path.basename(target);
  if (!path.isAbsolute(directory) || path.dirname(target) !== path.resolve(os.tmpdir())
    || !name.startsWith(TEST_DIRECTORY_PREFIX) || name.length === TEST_DIRECTORY_PREFIX.length) {
    throw new Error('Refusing to remove a directory outside the unique package-test temporary root.');
  }
  for (let attempt = 1; attempt <= REMOVE_ATTEMPTS; attempt += 1) {
    try { await remove(target, { recursive: true, force: true }); return; }
    catch (error) {
      if (!RETRYABLE_REMOVE_ERRORS.has(error.code)) throw error;
      if (attempt === REMOVE_ATTEMPTS) {
        throw new Error(`Package-test temporary directory cleanup failed after ${REMOVE_ATTEMPTS} attempts (${error.code}).`, { cause: error });
      }
      await wait(REMOVE_RETRY_DELAY_MS * attempt);
    }
  }
}

/** Wait asynchronously between file-lock retries without blocking process events. */
function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
