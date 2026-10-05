import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { listPackage, extractFile } = require('@electron/asar');

/** Check the packaged allowlist and reject development tools or user workspace files. */
export async function checkPackageContent(executablePath) {
  const archive = path.resolve('release/win-unpacked/resources/app.asar');
  const entries = listPackage(archive).map(entry => entry.replaceAll('\\', '/'));
  const allowlist = /^\/(?:dist|dist-mcp|electron|node_modules)(?:\/|$)|^\/package\.json$/;
  const developmentTools = /^\/node_modules\/(?:electron|electron-builder|playwright|playwright-core|vite|vitest|typescript)(?:\/|$)/;
  assert.ok(entries.length > 0, 'Packaged ASAR is empty');
  for (const entry of entries) {
    assert.ok(allowlist.test(entry), `Unexpected packaged path: ${entry}`);
    assert.ok(!developmentTools.test(entry), `Development dependency packaged: ${entry}`);
  }
  for (const required of ['/dist/index.html', '/dist-mcp/commands.cjs', '/dist-mcp/mcp-adapter.cjs', '/electron/main.cjs', '/electron/preload.cjs', '/electron/mcp-configuration.cjs']) {
    assert.ok(entries.includes(required), `Missing runtime file: ${required}`);
  }
  const metadata = JSON.parse(extractFile(archive, 'package.json').toString());
  assert.equal(metadata.main, 'electron/main.cjs');
  assert.equal(metadata.devDependencies, undefined);
  const mainSource = extractFile(archive, 'electron/main.cjs').toString();
  assert.ok(mainSource.includes("!app.isPackaged && process.env.BONE_STUDIO_DEV_URL === 'http://127.0.0.1:5173'"), 'Packaged editor must ignore development URL overrides');
  await checkGuiExecutable(executablePath);
  await checkGuiExecutable(path.resolve('release/win-unpacked/BoneStudio.exe'));
  return { archive, entries: entries.length };
}

/** A Windows GUI PE executable does not require a persistent console window. */
async function checkGuiExecutable(executablePath) {
  const data = await fs.readFile(executablePath);
  assert.equal(data.toString('ascii', 0, 2), 'MZ');
  const header = data.readUInt32LE(0x3c);
  assert.equal(data.toString('ascii', header, header + 2), 'PE');
  const optionalHeader = header + 24;
  const WINDOWS_GUI_SUBSYSTEM = 2;
  assert.equal(data.readUInt16LE(optionalHeader + 68), WINDOWS_GUI_SUBSYSTEM, 'Executable requires a console');
}
