import assert from 'node:assert/strict';

/** Observe real pointer delivery and clipped label geometry without changing renderer state. */
export async function startObservedScrub(context, label, distance) {
  const target = context.page.locator('.inspector .numeric-scrub').filter({ hasText: new RegExp(`^${label}$`) });
  await target.scrollIntoViewIfNeeded();
  const bounds = await target.boundingBox();
  assert.ok(bounds);
  const origin = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await target.evaluate((element, point) => {
    const document = globalThis.document;
    if (globalThis.upgradeScrubListener) document.removeEventListener('pointermove', globalThis.upgradeScrubListener, true);
    const clip = element.closest('.property-content');
    globalThis.upgradeScrub = { bounds: element.getBoundingClientRect().toJSON(), clip: clip.getBoundingClientRect().toJSON(),
      scrollTop: clip.scrollTop, viewport: { width: globalThis.innerWidth, height: globalThis.innerHeight, dpr: globalThis.devicePixelRatio },
      hit: document.elementFromPoint(point.x, point.y)?.outerHTML, events: [] };
    globalThis.upgradeScrubListener = event => {
      globalThis.upgradeScrub.events.push({ x: event.clientX, y: event.clientY, buttons: event.buttons,
        target: event.target.closest('label')?.innerText ?? event.target.className,
        value: element.closest('label').querySelector('input').value });
    };
    document.addEventListener('pointermove', globalThis.upgradeScrubListener, true);
  }, origin);
  assert.ok(await target.evaluate((element, point) => element.contains(globalThis.document.elementFromPoint(point.x, point.y)), origin), `Numeric scrub start must hit the visible ${label} label.`);
  await context.page.mouse.move(origin.x, origin.y);
  await context.page.mouse.down();
  await context.page.mouse.move(origin.x + distance, origin.y, { steps: 8 });
}

/** Read and remove this gesture's passive diagnostics while leaving its pointer pressed for Escape. */
export async function readScrubObservation(context) {
  return context.page.evaluate(() => {
    globalThis.document.removeEventListener('pointermove', globalThis.upgradeScrubListener, true);
    return globalThis.upgradeScrub;
  });
}
