import type { Animation, Project } from '../core/types';
import { parseProject } from '../core/validation';
import { MAX_SHEET_EDGE, MAX_SHEET_PIXELS, validateExportBudget } from './limits';
import type { ExportOptions } from './types';

export const SHEET_PADDING = 2;

export interface ExportPlan {
  project: Project;
  animation: Animation;
  fps: number;
  width: number;
  height: number;
  frameCount: number;
  columns: number;
  rows: number;
  sheetWidth: number;
  sheetHeight: number;
}

function sheetLayout(options: { frameCount: number; width: number; height: number }) {
  const maxColumns = Math.floor((MAX_SHEET_EDGE + SHEET_PADDING) / (options.width + SHEET_PADDING));
  const maxRows = Math.floor((MAX_SHEET_EDGE + SHEET_PADDING) / (options.height + SHEET_PADDING));
  const minColumns = Math.ceil(options.frameCount / maxRows);
  if (minColumns > maxColumns) throw new Error('精灵图无法容纳所有帧，请降低帧率、缩小尺寸或导出 PNG 序列');
  const columns = Math.max(minColumns, Math.min(maxColumns, Math.ceil(Math.sqrt(options.frameCount))));
  const rows = Math.ceil(options.frameCount / columns);
  const sheetWidth = columns * options.width + (columns - 1) * SHEET_PADDING;
  const sheetHeight = rows * options.height + (rows - 1) * SHEET_PADDING;
  if (sheetWidth * sheetHeight > MAX_SHEET_PIXELS) throw new Error('精灵图像素超过 3355 万，请缩小输出尺寸或导出 PNG 序列');
  return { columns, rows, sheetWidth, sheetHeight };
}

/** 创建并校验隔离的导出计划；采样 [0,duration)，不重复循环末尾帧。 */
export function createExportPlan(options: ExportOptions): ExportPlan {
  const project = parseProject(options.project);
  if (options.format !== 'sequence' && options.format !== 'sheet') throw new Error('导出格式必须为 sequence 或 sheet');
  if (!options.animationId) throw new Error('请选择要导出的动画');
  const animation = project.animations.find((item) => item.id === options.animationId);
  if (!animation) throw new Error(`动画不存在：${options.animationId}`);
  const fps = options.fps ?? animation.fps;
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new Error('导出帧率必须是 1–120 的整数');
  const width = options.width ?? project.width;
  const height = options.height ?? project.height;
  const frameCount = Math.ceil(animation.duration * fps - 1e-9);
  validateExportBudget({ frameCount, width, height });
  const layout = options.format === 'sheet' ? sheetLayout({ frameCount, width, height })
    : { columns: 1, rows: frameCount, sheetWidth: width, sheetHeight: height };
  return { project, animation, fps, width, height, frameCount, ...layout };
}
