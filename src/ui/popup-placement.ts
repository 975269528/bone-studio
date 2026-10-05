interface PopupAnchor { left: number; top: number; bottom: number; width: number }
interface PopupViewport { width: number; height: number }
export interface PopupPlacement { left: number; width: number; maxHeight: number; top?: number; bottom?: number }

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 4;
const MINIMUM_WIDTH = 220;
const PREFERRED_HEIGHT = 320;

/** Fit a popup to its viewport, opening above when that side offers more usable room. */
export function placePopup(options: { anchor: PopupAnchor; viewport: PopupViewport }): PopupPlacement {
  const { anchor, viewport } = options;
  const availableWidth = Math.max(0, viewport.width - VIEWPORT_MARGIN * 2);
  const width = Math.min(Math.max(anchor.width, MINIMUM_WIDTH), availableWidth);
  const left = Math.max(VIEWPORT_MARGIN, Math.min(anchor.left, viewport.width - VIEWPORT_MARGIN - width));
  const below = Math.max(0, viewport.height - VIEWPORT_MARGIN - anchor.bottom - ANCHOR_GAP);
  const above = Math.max(0, anchor.top - VIEWPORT_MARGIN - ANCHOR_GAP);
  const isAbove = below < PREFERRED_HEIGHT && above > below;
  const maxHeight = Math.min(PREFERRED_HEIGHT, isAbove ? above : below);
  return isAbove
    ? { left, width, maxHeight, bottom: viewport.height - anchor.top + ANCHOR_GAP }
    : { left, width, maxHeight, top: anchor.bottom + ANCHOR_GAP };
}
