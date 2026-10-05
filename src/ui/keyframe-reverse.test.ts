import { expect, it } from 'vitest';
import { reverseKeyframeClipboard } from './keyframe-clipboard';
import type { KeyframeClipboard } from './keyframe-clipboard';
import { sampleEasing } from '@/core/curves';

function copiedKeys(): KeyframeClipboard {
  return { start: 0.25, count: 3, tracks: [{ kind: 'bone', id: 'arm', keys: [
    { time: 0.25, x: 10, y: 20, rotation: 720, interpolation: 'bezier', curve: { x1: 0.2, y1: 0.1, x2: 0.7, y2: 0.9 } },
    { time: 0.75, x: 30, y: 40, rotation: 810, interpolation: 'smooth' },
    { time: 1.25, x: 50, y: 60, rotation: 900, interpolation: 'step' },
  ] }] };
}

it('reverses poses and transfers reflected segment easing to the new left key', () => {
  const source = copiedKeys(); const before = structuredClone(source);
  const reversed = reverseKeyframeClipboard(source); const keys = reversed.tracks[0].keys;
  expect(keys[0]).toMatchObject({ time: 0.25, x: 50, y: 60, rotation: 900, interpolation: 'smooth' });
  expect(keys[1]).toMatchObject({ time: 0.75, x: 30, y: 40, rotation: 810, interpolation: 'bezier' });
  expect(keys[1].curve!.x1).toBeCloseTo(0.3); expect(keys[1].curve!.x2).toBeCloseTo(0.8);
  expect(keys[2]).toMatchObject({ time: 1.25, x: 10, interpolation: 'step-start' });
  expect(source).toEqual(before);
});

it('restores key values and easing samples after two reversals, including terminal metadata', () => {
  const source = copiedKeys(); const restored = reverseKeyframeClipboard(reverseKeyframeClipboard(source));
  source.tracks[0].keys.forEach((key, index) => {
    const result = restored.tracks[0].keys[index];
    expect({ ...result, curve: undefined }).toEqual({ ...key, curve: undefined });
    for (const progress of [0, 0.1, 0.37, 0.7, 1]) {
      expect(sampleEasing({ progress, interpolation: result.interpolation!, curve: result.curve }))
        .toBeCloseTo(sampleEasing({ progress, interpolation: key.interpolation!, curve: key.curve }), 10);
    }
  });
});

it('uses a shared interval to retain FK/IK offsets on multiple tracks', () => {
  const source = copiedKeys(); source.count += 2;
  source.tracks.push({ kind: 'ik', id: 'target', keys: [{ time: 0.5, x: 70, y: 80, interpolation: 'step' }, { time: 1.5, x: 90, y: 100, interpolation: 'linear' }] });
  const reversed = reverseKeyframeClipboard(source);
  expect(reversed.tracks[0].keys.map(key => key.time)).toEqual([0.5, 1, 1.5]);
  expect(reversed.tracks[1].keys).toMatchObject([{ time: 0.25, x: 90, interpolation: 'step-start' }, { time: 1.25, x: 70, interpolation: 'linear' }]);
});
