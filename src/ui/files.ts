import type { Asset } from '@/core/types';

/** Download a locally generated artifact without sending its contents to a server. */
export function downloadFile(options: { data: BlobPart; name: string; type: string }): void {
  const url = URL.createObjectURL(new Blob([options.data], { type: options.type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = options.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Decode a base64 export into a binary file and trigger its download. */
export function downloadBase64(options: { base64: string; fileName: string; mimeType: string }): void {
  const bytes = Uint8Array.from(atob(options.base64), character => character.charCodeAt(0));
  downloadFile({ data: bytes, name: options.fileName, type: options.mimeType });
}

/** Load an image file as a self-contained asset with its natural dimensions. */
export async function readImage(file: File): Promise<Asset> {
  if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) throw new Error('请选择 PNG、WebP 或 JPEG 图片。');
  const MAX_IMAGE_BYTES = 18_000_000;
  const MAX_IMAGE_SIDE = 8192;
  if (file.size > MAX_IMAGE_BYTES) throw new Error('单张图片不能超过 18 MB。');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`));
    reader.readAsDataURL(file);
  });
  const image = await loadImage(dataUrl);
  if (image.width > MAX_IMAGE_SIDE || image.height > MAX_IMAGE_SIDE) throw new Error('图片边长不能超过 8192 像素。');
  return { id: crypto.randomUUID(), name: file.name, dataUrl, width: image.width, height: image.height };
}

/** Decode image data for import, crop and preview operations. */
export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片数据无法解码。'));
    image.src = source;
  });
}
