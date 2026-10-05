import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'electron', 'assets');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

/** Encode PNG-backed Windows icons at every declared size, including the 256px sentinel. */
function encodeIcon(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = header[entry];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(image => image.png)]);
}

async function renderIcon(options) {
  const { page, source, size } = options;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${source}`);
  const png = await page.locator('svg').screenshot({ omitBackground: true });
  assert.equal(png.readUInt32BE(16), size);
  assert.equal(png.readUInt32BE(20), size);
  return { size, png };
}

async function renderProof({ page, images }) {
  const tiles = images.map(({ size, png }) => `<div><img width="${size}" height="${size}" src="data:image/png;base64,${png.toString('base64')}"><span>${size}px</span></div>`).join('');
  const enlarged = images.slice(0, 3).map(({ size, png }) => `<div><img class="enlarged" width="${size * 8}" height="${size * 8}" src="data:image/png;base64,${png.toString('base64')}"><span>${size}px · 8×</span></div>`).join('');
  await page.setViewportSize({ width: 1024, height: 760 });
  await page.setContent(`<style>body{margin:0;padding:40px;background:#e6e8ec;color:#202430;font:14px Arial}section{display:flex;gap:32px;align-items:center;margin:24px 0 48px}div{display:flex;flex-direction:column;align-items:center;gap:16px}img{display:block}img.enlarged{image-rendering:pixelated}</style><h2>BoneStudio · icon size proof</h2><section>${tiles}</section><section>${enlarged}</section>`);
  const proof = path.join(root, 'output', 'icon-check');
  await fs.mkdir(proof, { recursive: true });
  await page.screenshot({ path: path.join(proof, 'sizes.png') });
}

/** Rebuild desktop PNG/ICO and a visual proof from the sole editable SVG source. */
async function buildIcon() {
  const source = await fs.readFile(path.join(root, 'public', 'icon.svg'), 'utf8');
  const channel = process.platform === 'win32' ? 'msedge' : undefined;
  const browser = await chromium.launch({ headless: true, channel });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const images = [];
    for (const size of SIZES) images.push(await renderIcon({ page, source, size }));
    const large = await renderIcon({ page, source, size: 512 });
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'icon.png'), large.png);
    await fs.writeFile(path.join(output, 'icon.ico'), encodeIcon(images));
    await renderProof({ page, images });
    console.log(`Icon built from public/icon.svg: 512px PNG; ${SIZES.join('/')}px ICO.`);
  } finally { await browser.close(); }
}

await buildIcon();
