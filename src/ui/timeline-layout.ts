/** Layout limits retain a useful canvas and enough height for timeline controls. */
export const TIMELINE_LAYOUT = { minimum: 230, initial: 285, workspaceMinimum: 300, resizeStep: 20 } as const;

/** Clamp a resized timeline against the current shell's remaining workspace height. */
export function timelineHeight(options: { requested: number; shell: number; chrome: number }): number {
  const maximum = Math.max(TIMELINE_LAYOUT.minimum, options.shell - options.chrome - TIMELINE_LAYOUT.workspaceMinimum);
  return Math.max(TIMELINE_LAYOUT.minimum, Math.min(maximum, options.requested));
}

/** Seek to the nearest frame while keeping both duration endpoints reachable. */
export function seekTimeline(options: { ratio: number; duration: number; fps: number }): number {
  if (options.ratio <= 0) return 0;
  if (options.ratio >= 1) return options.duration;
  return Math.max(0, Math.min(options.duration, Math.round(options.ratio * options.duration * options.fps) / options.fps));
}
