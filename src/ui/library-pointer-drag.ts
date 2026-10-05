import type { PointerEvent as ReactPointerEvent } from 'react';
import { dropLibraryItem } from './library-drag';
import type { LibraryItem } from './library-drag';
import { dragWheelPixels, LIBRARY_SECTIONS } from './library-layout';
import { getEditorState, reportError, updateEditor } from './store';

/** Dispatched when a dragged asset crosses the bones tab, even with pointer capture. */
export const LIBRARY_DRAG_HOVER = 'bonestudio-library-drag-hover';
const DRAG_THRESHOLD = 5;
interface Position { x: number; y: number }
interface DragSession {
  item: LibraryItem; source: HTMLElement; pointerId: number; start: Position; position: Position;
  documentId: string; ghost: HTMLElement | null; target: HTMLElement | null;
}
let session: DragSession | null = null;

function targetAt(position: Position): HTMLElement | null {
  return document.elementFromPoint(position.x, position.y)?.closest<HTMLElement>('[data-library-drop]') ?? null;
}

function updateTarget(current: DragSession): void {
  const target = targetAt(current.position);
  if (current.target !== target) { current.target?.classList.remove('drop-active'); target?.classList.add('drop-active'); current.target = target; }
  const tab = document.elementFromPoint(current.position.x, current.position.y)?.closest<HTMLElement>('[data-library-tab]');
  if (tab?.dataset.libraryTab === 'bones') document.dispatchEvent(new Event(LIBRARY_DRAG_HOVER));
}

function makeGhost(current: DragSession): HTMLElement {
  const ghost = document.createElement('div'); ghost.className = 'library-drag-ghost';
  ghost.textContent = current.source.querySelector('span')?.textContent ?? current.source.getAttribute('aria-label') ?? '拖动对象';
  ghost.setAttribute('aria-hidden', 'true'); document.body.append(ghost);
  document.body.classList.add('is-library-dragging'); updateEditor({ isPlaying: false });
  return ghost;
}

function handleMove(event: PointerEvent): void {
  const current = session; if (!current || event.pointerId !== current.pointerId) return;
  current.position = { x: event.clientX, y: event.clientY };
  if (!current.ghost && Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) < DRAG_THRESHOLD) return;
  current.ghost ??= makeGhost(current); event.preventDefault();
  current.ghost.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 14}px)`; updateTarget(current);
}

function handleWheel(event: WheelEvent): void {
  const current = session; if (!current?.ghost) return;
  const hovered = document.elementFromPoint(current.position.x, current.position.y);
  const list = hovered?.closest<HTMLElement>('[data-library-scroll]')
    ?? hovered?.closest('[data-library-section]')?.querySelector<HTMLElement>('[data-library-scroll]');
  if (!list) return;
  event.preventDefault();
  list.scrollTop += dragWheelPixels({ delta: event.deltaY, mode: event.deltaMode, pageHeight: list.clientHeight });
  updateTarget(current);
}

function suppressClick(event: MouseEvent): void { event.preventDefault(); event.stopImmediatePropagation(); }

function clearSession(): DragSession | null {
  const current = session; session = null; current?.target?.classList.remove('drop-active'); current?.ghost?.remove();
  document.body.classList.remove('is-library-dragging');
  if (current?.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId);
  document.removeEventListener('pointermove', handleMove); document.removeEventListener('pointerup', handleEnd);
  document.removeEventListener('pointercancel', handleCancel); document.removeEventListener('wheel', handleWheel);
  document.removeEventListener('keydown', handleKey, true); window.removeEventListener('blur', handleCancel);
  return current;
}

function handleEnd(event: PointerEvent): void {
  if (!session || event.pointerId !== session.pointerId) return;
  session.position = { x: event.clientX, y: event.clientY }; const target = targetAt(session.position);
  const current = clearSession(); if (!current?.ghost) return;
  document.addEventListener('click', suppressClick, { capture: true, once: true });
  document.addEventListener('dblclick', suppressClick, { capture: true, once: true });
  window.setTimeout(() => { document.removeEventListener('click', suppressClick, true); document.removeEventListener('dblclick', suppressClick, true); }, 0);
  if (!target || getEditorState().documentId !== current.documentId) return;
  const id = target.dataset.libraryDrop;
  try { dropLibraryItem(current.item, id === LIBRARY_SECTIONS.root || id === LIBRARY_SECTIONS.unbound ? null : id ?? null); }
  catch (error) { reportError(error); }
}

function handleCancel(): void { clearSession(); }
function handleKey(event: KeyboardEvent): void { if (session && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); handleCancel(); } }

/** Begin a thresholded pointer drag; wheel scrolling and tab changes remain active until drop or Escape. */
export function startLibraryDrag(event: ReactPointerEvent<HTMLElement>, item: LibraryItem): void {
  if (event.button !== 0 || session) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  session = { item, source: event.currentTarget, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY },
    position: { x: event.clientX, y: event.clientY }, documentId: getEditorState().documentId, ghost: null, target: null };
  document.addEventListener('pointermove', handleMove, { passive: false }); document.addEventListener('pointerup', handleEnd);
  document.addEventListener('pointercancel', handleCancel); document.addEventListener('wheel', handleWheel, { passive: false });
  document.addEventListener('keydown', handleKey, true); window.addEventListener('blur', handleCancel);
}
