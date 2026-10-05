const FOCUSABLE_SELECTOR = 'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]';

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(element => element.getClientRects().length > 0 && !element.closest('[inert],[hidden]'));
}

/** Include only the current dialog's owned portals, immediately after their trigger in focus order. */
export function modalFocusElements(section: HTMLElement): HTMLElement[] {
  const portals = Array.from(document.querySelectorAll<HTMLElement>('.bone-picker-portal'))
    .filter(portal => portal.dataset.modalOwner === section.dataset.modalOwner);
  return focusableElements(section).flatMap(element => {
    const controls = element.getAttribute('aria-controls');
    const portal = controls ? portals.find(item => item.querySelector(`[id="${controls}"]`)) : undefined;
    return portal ? [element, ...focusableElements(portal)] : [element];
  });
}

/** Cycle Tab across the dialog and its owned popup, preventing focus from reaching the editor behind it. */
export function trapModalFocus(event: KeyboardEvent, section: HTMLElement | null): void {
  if (!section) return;
  const elements = modalFocusElements(section);
  if (!elements.length) { event.preventDefault(); section.focus(); return; }
  const index = elements.indexOf(document.activeElement as HTMLElement);
  const next = event.shiftKey ? (index <= 0 ? elements.length : index) - 1 : (index + 1) % elements.length;
  event.preventDefault(); elements[next]?.focus();
}
