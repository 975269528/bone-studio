export const MAX_FRAME_PIXELS = 16_777_216;
export const MAX_EXPORT_FRAMES = 2400;
export const MAX_EXPORT_PIXELS = 268_435_456;
export const MAX_SHEET_EDGE = 8192;
export const MAX_SHEET_PIXELS = 33_554_432;

/** 在分配 Canvas 前校验帧尺寸，限制单帧 RGBA 内存。 */
export function validateDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > MAX_SHEET_EDGE || height > MAX_SHEET_EDGE) throw new Error('输出宽高必须是 1–8192 的整数');
  if (width * height > MAX_FRAME_PIXELS) throw new Error('单帧像素超过 1677 万，请缩小画布或输出尺寸');
}

/** 在开始导出前校验帧数与总像素，避免超大任务耗尽内存。 */
export function validateExportBudget(options: { frameCount: number; width: number; height: number }): void {
  validateDimensions(options.width, options.height);
  if (options.frameCount < 1 || options.frameCount > MAX_EXPORT_FRAMES) throw new Error('导出帧数必须为 1–2400，请降低帧率或缩短动画');
  if (options.frameCount * options.width * options.height > MAX_EXPORT_PIXELS) throw new Error('导出总像素超过 2.68 亿，请降低帧率或输出尺寸');
}
