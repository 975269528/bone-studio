import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NtExecutable, NtExecutableResource } from 'pe-library';
import { Resource } from 'resedit';
const root = fileURLToPath(new URL('../', import.meta.url));
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const PNG_SIGNATURE = '89504e470d0a1a0a';

/** Validate the complete ICO directory and each embedded PNG's actual dimensions. */
function readIcon(data) {
  assert.equal(data.readUInt16LE(0), 0);
  assert.equal(data.readUInt16LE(2), 1);
  assert.equal(data.readUInt16LE(4), SIZES.length);
  return SIZES.map((size, index) => {
    const entry = 6 + index * 16;
    assert.equal(data[entry] || 256, size);
    assert.equal(data[entry + 1] || 256, size);
    assert.equal(data.readUInt16LE(entry + 4), 1);
    assert.equal(data.readUInt16LE(entry + 6), 32);
    const length = data.readUInt32LE(entry + 8);
    const offset = data.readUInt32LE(entry + 12);
    assert.ok(offset >= 6 + SIZES.length * 16 && offset + length <= data.length);
    const png = data.subarray(offset, offset + length);
    assert.equal(png.subarray(0, 8).toString('hex'), PNG_SIGNATURE);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    return { size, png };
  });
}

/** Read PE icon resources and prove the executable contains this application's exact artwork. */
async function checkExecutable({ executablePath, icons }) {
  const binary = await fs.readFile(executablePath);
  const executable = NtExecutable.from(binary, { ignoreCert: true });
  const { entries } = NtExecutableResource.from(executable);
  const groups = Resource.IconGroupEntry.fromEntries(entries);
  const match = groups.some(group => icons.every(({ size, png }) => {
    const icon = group.icons.find(item => (item.width || 256) === size && (item.height || 256) === size);
    const resource = icon && entries.find(item => item.type === 3 && item.id === icon.iconID && item.lang === group.lang);
    return resource && Buffer.from(resource.bin).equals(png);
  }));
  assert.ok(match, `Executable is missing the BoneStudio icon sizes: ${executablePath}`);
  console.log(`EXE icon verified by exact resource bytes: ${executablePath}`);
}

const icons = readIcon(await fs.readFile(path.join(root, 'electron', 'assets', 'icon.ico')));
const png = await fs.readFile(path.join(root, 'electron', 'assets', 'icon.png'));
assert.equal(png.subarray(0, 8).toString('hex'), PNG_SIGNATURE);
assert.equal(png.readUInt32BE(16), 512);
assert.equal(png.readUInt32BE(20), 512);
console.log(`App icon validated: 512px PNG and ${SIZES.join('/')}px PNG-backed ICO.`);
for (const executablePath of process.argv.slice(2)) await checkExecutable({ executablePath: path.resolve(executablePath), icons });
