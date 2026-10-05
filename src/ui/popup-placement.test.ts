import { expect, it } from 'vitest';
import { placePopup } from './popup-placement';

it('opens below a high trigger with a readable capped list height', () => {
  const placement = placePopup({ anchor: { left: 40, top: 80, bottom: 112, width: 400 }, viewport: { width: 1100, height: 720 } });
  expect(placement).toEqual({ left: 40, top: 116, width: 400, maxHeight: 320 });
});

it('opens above a low trigger so the bottom options stay inside the viewport', () => {
  const placement = placePopup({ anchor: { left: 40, top: 610, bottom: 642, width: 400 }, viewport: { width: 1100, height: 720 } });
  expect(placement).toEqual({ left: 40, bottom: 114, width: 400, maxHeight: 320 });
});

it('shrinks to the larger available side in a short viewport', () => {
  const placement = placePopup({ anchor: { left: 100, top: 190, bottom: 224, width: 380 }, viewport: { width: 900, height: 360 } });
  expect(placement).toEqual({ left: 100, bottom: 174, width: 380, maxHeight: 178 });
  expect(placement.bottom! + placement.maxHeight).toBeLessThanOrEqual(360 - 8);
});

it('keeps an oversized trigger and long paths within a narrow viewport', () => {
  const placement = placePopup({ anchor: { left: 230, top: 40, bottom: 72, width: 600 }, viewport: { width: 320, height: 500 } });
  expect(placement).toMatchObject({ left: 8, width: 304, top: 76 });
  expect(placement.left + placement.width).toBe(320 - 8);
});

it('keeps a small trigger menu readable while clamping its right edge', () => {
  const placement = placePopup({ anchor: { left: 960, top: 160, bottom: 194, width: 90 }, viewport: { width: 1100, height: 720 } });
  expect(placement).toMatchObject({ left: 872, width: 220, top: 198 });
});
