import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDemoProject } from '@/core/api';
import { readImages } from './files';
import { applyCommands, getEditorState, replaceProject, undo } from './store';

const readCalls = vi.fn();

/** Create browser file metadata without allocating large test buffers. */
function imageFile(options: { name?: string; type?: string; size?: number }): File {
  const file = new File(['pixels'], options.name ?? 'part.png', { type: options.type ?? 'image/png' });
  if (options.size !== undefined) Object.defineProperty(file, 'size', { value: options.size });
  return file;
}

class MockFileReader {
  result = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(file: File): void {
    readCalls(file);
    this.result = `data:${file.type};base64,${Buffer.from(file.name).toString('base64')}`;
    queueMicrotask(() => file.name === 'unreadable.png' ? this.onerror?.() : this.onload?.());
  }
}

class MockImage {
  width = 16;
  height = 16;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(source: string) {
    const name = Buffer.from(source.split(',')[1], 'base64').toString();
    if (name === 'wide.png') this.width = 8193;
    queueMicrotask(() => name === 'broken.png' ? this.onerror?.() : this.onload?.());
  }
}

beforeEach(() => {
  readCalls.mockClear();
  vi.stubGlobal('FileReader', MockFileReader);
  vi.stubGlobal('Image', MockImage);
  replaceProject(createDemoProject());
});
afterEach(() => { vi.unstubAllGlobals(); });

it('rejects an oversized batch before reading or decoding any image', async () => {
  const files = Array.from({ length: 3 }, () => imageFile({ size: 12_000_001 }));
  await expect(readImages(files)).rejects.toThrow('总大小超过 36 MB');
  expect(readCalls).not.toHaveBeenCalled();
});

it('accepts the exact batch and per-image limits and supported formats', async () => {
  const files = [imageFile({ size: 18_000_000 }), imageFile({ name: 'part.webp', type: 'image/webp', size: 18_000_000 })];
  const assets = await readImages(files);
  expect(assets.map(asset => [asset.name, asset.width, asset.height])).toEqual([['part.png', 16, 16], ['part.webp', 16, 16]]);
  expect((await readImages([imageFile({ name: 'part.jpg', type: 'image/jpeg' })]))[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/);
});

it('retains single-image size, format and dimension validation', async () => {
  await expect(readImages([imageFile({ size: 18_000_001 })])).rejects.toThrow('单张图片不能超过 18 MB');
  await expect(readImages([imageFile({ type: 'image/gif' })])).rejects.toThrow('请选择 PNG、WebP 或 JPEG');
  await expect(readImages([imageFile({ name: 'wide.png' })])).rejects.toThrow('图片边长不能超过 8192');
});

it('rejects the whole batch on read or decode failure without committing valid siblings', async () => {
  const before = getEditorState();
  for (const name of ['unreadable.png', 'broken.png']) {
    const importing = readImages([imageFile({}), imageFile({ name })]).then(assets => {
      applyCommands(assets.map(asset => ({ type: 'asset.add', asset })));
    });
    await expect(importing).rejects.toThrow(name === 'unreadable.png' ? '无法读取' : '无法解码');
    expect(getEditorState()).toBe(before);
  }
});

it('commits a successful batch as reusable assets with one undo entry', async () => {
  const before = getEditorState().project;
  const assets = await readImages([imageFile({ name: 'head.png' }), imageFile({ name: 'body.png' })]);
  applyCommands(assets.map(asset => ({ type: 'asset.add', asset })));
  expect(getEditorState().project.assets).toHaveLength(before.assets.length + 2);
  expect(getEditorState().project.attachments).toEqual(before.attachments);
  expect(getEditorState().past).toHaveLength(1);
  undo();
  expect(getEditorState().project).toEqual(before);
});
