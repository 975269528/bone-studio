import type { Asset, Project } from '../core/types';

const IMAGE_TIMEOUT_MS = 15_000;
const MAX_CACHE_ENTRIES = 64;
const cache = new Map<string, Promise<HTMLImageElement>>();
const projectCache = new WeakMap<Project, Promise<Map<string, HTMLImageElement>>>();

function loadImage(asset: Asset): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => finish(new Error(`素材加载超时：${asset.name}`)), IMAGE_TIMEOUT_MS);
    function finish(error?: Error): void {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error); else resolve(image);
    }
    image.onload = () => finish();
    image.onerror = () => finish(new Error(`素材无法解码：${asset.name}`));
    image.src = asset.dataUrl;
  });
}

function cachedImage(asset: Asset): Promise<HTMLImageElement> {
  const existing = cache.get(asset.dataUrl);
  if (existing) return existing;
  if (cache.size >= MAX_CACHE_ENTRIES) return loadImage(asset);
  const promise = loadImage(asset).catch((error: unknown) => { cache.delete(asset.dataUrl); throw error; });
  cache.set(asset.dataUrl, promise);
  return promise;
}

/** 解码项目已使用的图片；缓存有界且失败可重试，不加载未绑定素材。 */
export async function loadProjectImages(project: Project): Promise<Map<string, HTMLImageElement>> {
  const cached = projectCache.get(project);
  if (cached) return cached;
  const ids = new Set(project.attachments.map((attachment) => attachment.assetId));
  const promise = Promise.all([...ids].map(async (id): Promise<[string, HTMLImageElement]> => {
    const asset = project.assets.find((item) => item.id === id);
    if (!asset) throw new Error(`素材不存在：${id}`);
    return [id, await cachedImage(asset)];
  })).then((pairs) => new Map(pairs)).catch((error: unknown) => { projectCache.delete(project); throw error; });
  projectCache.set(project, promise);
  return promise;
}
