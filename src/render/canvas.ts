import { samplePose } from '../core/pose';
import { parseProject } from '../core/validation';
import { drawProject } from './draw';
import { loadProjectImages } from './images';
import { validateDimensions } from './limits';
import type { PreviewOptions, RenderOptions } from './types';

const renderVersions = new WeakMap<HTMLCanvasElement, number>();

/** 绘制指定动画时刻；同一 Canvas 上只呈现最近一次请求，避免异步加载倒序。 */
export async function renderProject(options: RenderOptions): Promise<void> {
  const width = options.width ?? options.project.width;
  const height = options.height ?? options.project.height;
  validateDimensions(width, height);
  const pose = samplePose(options);
  const version = (renderVersions.get(options.canvas) ?? 0) + 1;
  renderVersions.set(options.canvas, version);
  const images = await loadProjectImages(options.project);
  if (renderVersions.get(options.canvas) !== version) return;
  const canvas = options.canvas;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建 Canvas 2D 渲染上下文');
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.save();
  try {
    context.scale(width / options.project.width, height / options.project.height);
    drawProject({ context, project: options.project, pose, images, overlays: options.overlays });
  } finally { context.restore(); }
}

/** 生成不含网格、骨骼和选框的透明 PNG dataURL；读取隔离的项目快照。 */
export async function capturePreview(options: PreviewOptions): Promise<string> {
  const project = parseProject(options.project);
  const canvas = document.createElement('canvas');
  await renderProject({ ...options, project, canvas });
  return canvas.toDataURL('image/png');
}
