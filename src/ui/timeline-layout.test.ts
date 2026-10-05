import { describe, expect, it } from 'vitest';
import { seekTimeline, timelineHeight } from './timeline-layout';

describe('timeline navigation and panel sizing', () => {
  it('keeps both endpoints reachable for durations that do not fall on a frame', () => {
    expect(seekTimeline({ ratio: -0.2, duration: 2.025, fps: 24 })).toBe(0);
    expect(seekTimeline({ ratio: 1, duration: 2.025, fps: 24 })).toBe(2.025);
    expect(seekTimeline({ ratio: 1.2, duration: 2.025, fps: 24 })).toBe(2.025);
  });

  it('snaps interior seeks to frames and clamps rounding near the last frame', () => {
    expect(seekTimeline({ ratio: 0.26, duration: 2, fps: 24 })).toBeCloseTo(0.5);
    expect(seekTimeline({ ratio: 0.999, duration: 2.03, fps: 24 })).toBe(2.03);
  });

  it('limits dragging without squeezing away the workspace or timeline controls', () => {
    expect(timelineHeight({ requested: 900, shell: 800, chrome: 98 })).toBe(402);
    expect(timelineHeight({ requested: 50, shell: 800, chrome: 98 })).toBe(230);
    expect(timelineHeight({ requested: 285, shell: 640, chrome: 98 })).toBe(242);
  });
});
