import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import { placePopup } from './popup-placement';
import type { PopupPlacement } from './popup-placement';

interface PopupOptions {
  isOpen: boolean;
  trigger: RefObject<HTMLButtonElement | null>;
  menu: RefObject<HTMLDivElement | null>;
  onClose: (restoreFocus: boolean) => void;
}

/** Track a body portal against its trigger and dismiss it without leaking Escape to its modal. */
export function usePickerPopup(options: PopupOptions): PopupPlacement | null {
  const [placement, setPlacement] = useState<PopupPlacement | null>(null);
  useLayoutEffect(() => {
    if (!options.isOpen) return;
    const trigger = options.trigger.current;
    if (!trigger) return;
    const update = (event?: Event) => {
      if (event?.target instanceof Node && options.menu.current?.contains(event.target)) return;
      const anchor = trigger.getBoundingClientRect();
      const viewport = { width: document.documentElement.clientWidth || window.innerWidth,
        height: document.documentElement.clientHeight || window.innerHeight };
      if (anchor.bottom < 0 || anchor.top > viewport.height) { options.onClose(false); return; }
      setPlacement(placePopup({ anchor, viewport }));
    };
    const isInside = (target: EventTarget | null) => target instanceof Node
      && (trigger.contains(target) || !!options.menu.current?.contains(target));
    const handleOutside = (event: PointerEvent | FocusEvent) => {
      if (isInside(event.target)) return;
      if (event.type === 'pointerdown' && event.target instanceof HTMLElement && event.target.matches('.modal-backdrop')) {
        event.preventDefault(); event.stopPropagation();
      }
      options.onClose(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return;
      event.preventDefault(); event.stopImmediatePropagation(); options.onClose(true);
    };
    update(); const observer = new ResizeObserver(() => update()); observer.observe(trigger);
    window.addEventListener('resize', update); document.addEventListener('scroll', update, true);
    document.addEventListener('pointerdown', handleOutside, true); document.addEventListener('focusin', handleOutside, true);
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      observer.disconnect(); window.removeEventListener('resize', update); document.removeEventListener('scroll', update, true);
      document.removeEventListener('pointerdown', handleOutside, true); document.removeEventListener('focusin', handleOutside, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [options.isOpen, options.trigger, options.menu, options.onClose]);
  return placement;
}
