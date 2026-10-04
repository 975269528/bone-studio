interface ScrubOptions {
  raw: number;
  deltaX: number;
  step?: number;
  isFine: boolean;
  isInteger?: boolean;
  min?: number;
  max?: number;
}

/** Compute a bounded horizontal numeric adjustment, preserving fractional accumulation for integer fields. */
export function scrubNumber(options: ScrubOptions): { raw: number; value: number } {
  const increment = (options.step ?? 1) * (options.isFine ? 0.1 : 1);
  const raw = Math.max(options.min ?? -Infinity, Math.min(options.max ?? Infinity, options.raw + options.deltaX * increment));
  return { raw, value: options.isInteger ? Math.round(raw) : Number(raw.toFixed(8)) };
}

/** Coalesce only consecutive writes from the current gesture, never an interleaved document edit. */
export function canCoalesceScrub(lastRevision: number | null, currentRevision: number): boolean {
  return lastRevision !== null && lastRevision === currentRevision;
}

/** Stop a gesture when the document changes outside its own last successful write. */
export function isScrubInterrupted(expectedRevision: number, currentRevision: number): boolean {
  return expectedRevision !== currentRevision;
}
