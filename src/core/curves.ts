import type { BezierCurve, Interpolation } from './types';

/** 未显式指定控制点的贝塞尔段使用标准 ease 缓动。 */
export const DEFAULT_BEZIER_CURVE: Readonly<BezierCurve> = Object.freeze({ x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 });
const BEZIER_SEARCH_ITERATIONS = 40;

export interface EasingSettings {
  interpolation: Interpolation;
  curve?: BezierCurve;
}

/** 将出段缓动在时间与变化进度上同时反射，贝塞尔缺省控制点先解析为标准 ease。 */
export function reverseEasing(options: EasingSettings): EasingSettings {
  const interpolation = options.interpolation === 'step' ? 'step-start' : options.interpolation === 'step-start' ? 'step' : options.interpolation;
  const curve = options.curve ?? (interpolation === 'bezier' ? DEFAULT_BEZIER_CURVE : undefined);
  return { interpolation, ...(curve ? { curve: { x1: 1 - curve.x2, y1: 1 - curve.y2, x2: 1 - curve.x1, y2: 1 - curve.y1 } } : {}) };
}

function cubicCoordinate(parameter: number, first: number, second: number): number {
  const remaining = 1 - parameter;
  return 3 * remaining * remaining * parameter * first
    + 3 * remaining * parameter * parameter * second + parameter * parameter * parameter;
}

function bezierProgress(progress: number, curve: BezierCurve): number {
  let minimum = 0;
  let maximum = 1;
  for (let iteration = 0; iteration < BEZIER_SEARCH_ITERATIONS; iteration += 1) {
    const parameter = (minimum + maximum) / 2;
    const position = cubicCoordinate(parameter, curve.x1, curve.x2);
    if (position === progress) return cubicCoordinate(parameter, curve.y1, curve.y2);
    if (position < progress) minimum = parameter;
    else maximum = parameter;
  }
  return cubicCoordinate((minimum + maximum) / 2, curve.y1, curve.y2);
}

/** 将有限时间进度转换为缓动进度；控制点应通过项目校验，区间外钳制到精确端点。 */
export function sampleEasing(options: { progress: number; interpolation: Interpolation; curve?: BezierCurve }): number {
  const { progress, interpolation } = options;
  if (!Number.isFinite(progress)) throw new Error('缓动进度必须是有限数值');
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  if (interpolation === 'step') return 0;
  if (interpolation === 'step-start') return 1;
  if (interpolation === 'smooth') return progress * progress * (3 - 2 * progress);
  if (interpolation === 'bezier') return bezierProgress(progress, options.curve ?? DEFAULT_BEZIER_CURVE);
  return progress;
}
