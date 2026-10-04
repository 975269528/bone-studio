import JSZip from 'jszip';
import { renderProject } from './canvas';
import { createExportPlan, SHEET_PADDING } from './export-plan';
import type { ExportPlan } from './export-plan';
import type { ExportOptions, ExportResult } from './types';

const EXPORT_YIELD_INTERVAL = 8;

interface FrameInfo {
  index: number;
  time: number;
  file?: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
}

function safeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').split('').map((character) => character.charCodeAt(0) < 32 ? '_' : character)
    .join('').replace(/[. ]+$/, '').slice(0, 100) || 'animation';
}

function pngBase64(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL('image/png');
  if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('PNG 编码失败，输出画布可能过大');
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

function addManifest(options: { zip: JSZip; plan: ExportPlan; frames: FrameInfo[] }): void {
  options.zip.file('animation.json', JSON.stringify({ version: 1, animation: options.plan.animation.name,
    fps: options.plan.fps, duration: options.plan.animation.duration, loop: options.plan.animation.loop,
    frameWidth: options.plan.width, frameHeight: options.plan.height,
    frameCount: options.plan.frameCount, padding: SHEET_PADDING,
    pivot: { x: 0, y: 0 }, frames: options.frames }, null, 2));
}

async function renderFrame(options: { canvas: HTMLCanvasElement; plan: ExportPlan; index: number }): Promise<void> {
  await renderProject({ canvas: options.canvas, project: options.plan.project,
    animationId: options.plan.animation.id, time: options.index / options.plan.fps,
    width: options.plan.width, height: options.plan.height });
  if (options.index % EXPORT_YIELD_INTERVAL === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

async function createSequence(plan: ExportPlan): Promise<JSZip> {
  const zip = new JSZip();
  const canvas = document.createElement('canvas');
  const frames: FrameInfo[] = [];
  for (let index = 0; index < plan.frameCount; index += 1) {
    await renderFrame({ canvas, plan, index });
    const file = `frames/frame_${String(index).padStart(5, '0')}.png`;
    zip.file(file, pngBase64(canvas), { base64: true });
    frames.push({ index, time: index / plan.fps, file, width: plan.width, height: plan.height });
  }
  addManifest({ zip, plan, frames });
  return zip;
}

async function createSheet(plan: ExportPlan): Promise<JSZip> {
  const zip = new JSZip();
  const canvas = document.createElement('canvas');
  const sheet = document.createElement('canvas');
  sheet.width = plan.sheetWidth;
  sheet.height = plan.sheetHeight;
  const context = sheet.getContext('2d');
  if (!context) throw new Error('无法创建精灵图渲染上下文');
  const frames: FrameInfo[] = [];
  for (let index = 0; index < plan.frameCount; index += 1) {
    await renderFrame({ canvas, plan, index });
    const x = (index % plan.columns) * (plan.width + SHEET_PADDING);
    const y = Math.floor(index / plan.columns) * (plan.height + SHEET_PADDING);
    context.drawImage(canvas, x, y);
    frames.push({ index, time: index / plan.fps, x, y, width: plan.width, height: plan.height });
  }
  zip.file('spritesheet.png', pngBase64(sheet), { base64: true });
  addManifest({ zip, plan, frames });
  return zip;
}

/** 透明导出隔离项目快照；PNG 序列或精灵图均返回含帧信息的 ZIP base64。 */
export async function exportAnimation(options: ExportOptions): Promise<ExportResult> {
  const plan = createExportPlan(options);
  const zip = options.format === 'sequence' ? await createSequence(plan) : await createSheet(plan);
  const base64 = await zip.generateAsync({ type: 'base64', compression: 'STORE' });
  return { base64, fileName: `${safeName(plan.animation.name)}_${options.format}.zip`,
    mimeType: 'application/zip', frameCount: plan.frameCount,
    width: options.format === 'sheet' ? plan.sheetWidth : plan.width,
    height: options.format === 'sheet' ? plan.sheetHeight : plan.height };
}
