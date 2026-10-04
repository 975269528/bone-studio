const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { nativeImage } = require('electron');
const MAX_IMAGE_BYTES = 18_000_000;
const MAX_IMPORT_BYTES = 36_000_000;
const MAX_PROJECT_BYTES = 64 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
const MIME_TYPES = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

/** Read explicitly supplied image files, validate decoding, and embed their pixels. */
async function importAssets(paths) {
  const assets = [];
  let totalBytes = 0;
  for (const input of paths) {
    const filePath = path.resolve(input);
    const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()];
    if (!mimeType) throw new Error('仅支持 PNG、WebP、JPEG 图片。');
    const info = await fs.stat(filePath);
    if (!info.isFile() || info.size > MAX_IMAGE_BYTES) throw new Error('图片必须是小于 18 MB 的普通文件。');
    const buffer = await fs.readFile(filePath);
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error('图片超过 18 MB 限制。');
    totalBytes += buffer.length;
    if (totalBytes > MAX_IMPORT_BYTES) throw new Error('单次导入图片总大小超过 36 MB 限制。');
    const image = nativeImage.createFromBuffer(buffer);
    const { width, height } = image.getSize();
    if (image.isEmpty() || width > 8192 || height > 8192) throw new Error('图片无法解码或边长超过 8192 像素。');
    assets.push({ id: randomUUID(), name: path.basename(filePath), dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`, width, height });
  }
  return assets;
}

/** Read a size-bounded project selected by the user. Renderer performs domain validation. */
async function readProject(filePath) {
  const info = await fs.stat(filePath);
  if (!info.isFile() || info.size > MAX_PROJECT_BYTES) throw new Error('项目必须是小于 64 MiB 的普通文件。');
  const text = await fs.readFile(filePath, 'utf8');
  if (Buffer.byteLength(text) > MAX_PROJECT_BYTES) throw new Error('项目超过 64 MiB 限制。');
  return { name: path.basename(filePath), text };
}

/** Atomically publish output; existing files require explicit replacement authorization. */
async function writeOutput(options) {
  const filePath = path.resolve(options.outputPath);
  const buffer = Buffer.isBuffer(options.data) ? options.data : Buffer.from(options.data, options.encoding ?? 'utf8');
  if (buffer.length > MAX_OUTPUT_BYTES) throw new Error('导出文件超过 256 MiB 限制。');
  if (path.extname(filePath).toLowerCase() === '.json' && buffer.length > MAX_PROJECT_BYTES) throw new Error('项目超过 64 MiB 限制，无法保存。');
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temporary, buffer, { flag: 'wx', mode: 0o600 });
    if (options.replace) await fs.rename(temporary, filePath);
    else await fs.link(temporary, filePath);
    return filePath;
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('输出文件已存在；只有 replace: true 才允许覆盖。', { cause: error });
    throw error;
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

module.exports = { importAssets, readProject, writeOutput };
