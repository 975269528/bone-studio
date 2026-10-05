import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'vite';
const require = createRequire(import.meta.url);
const children = [];
let stopping = false;

/** Spawn hidden child processes and keep their output attached to this terminal. */
function launch(command, args, env = process.env) {
  const child = spawn(command, args, { stdio: 'inherit', windowsHide: true, env });
  children.push(child);
  child.on('error', (error) => { console.error(error.message); shutdown(1); });
  child.on('exit', (code) => { if (!stopping) shutdown(code ?? 1); });
  return child;
}

/** Terminate both the desktop and dev server when either exits. */
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}

/** Wait for Vite readiness with a bounded deadline. */
async function waitForVite() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && !stopping) {
    try {
      const response = await fetch('http://127.0.0.1:5173', { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* A refused connection is expected until Vite binds its port. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Vite 未能在 30 秒内启动。');
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
try {
  await build({ configFile: 'vite.mcp.config.ts' });
  await build({ configFile: 'vite.mcp-adapter.config.ts' });
  const viteExecutable = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
  launch(process.execPath, [viteExecutable]);
  await waitForVite();
  if (!stopping) launch(require('electron'), ['.'], { ...process.env, BONE_STUDIO_DEV_URL: 'http://127.0.0.1:5173' });
} catch (error) {
  console.error(error.message);
  shutdown(1);
}
