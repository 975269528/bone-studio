import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createDemoProject } from '@/core/api';
import { getEditorState, replaceProject } from './store';
import { startLibraryDrag } from './library-pointer-drag';

function fixture() {
  const ghost = { className: '', textContent: '', setAttribute: vi.fn(), style: { transform: '' }, remove: vi.fn() };
  const target = { dataset: { libraryDrop: 'head' }, classList: { add: vi.fn(), remove: vi.fn() } };
  const list = { scrollTop: 0, clientHeight: 120 };
  const hovered = { closest: (selector: string) => selector === '[data-library-drop]' ? target : selector === '[data-library-scroll]' ? list : null };
  const document = Object.assign(new EventTarget(), { createElement: () => ghost, elementFromPoint: () => hovered,
    body: { append: vi.fn(), classList: { add: vi.fn(), remove: vi.fn() } } });
  const window = Object.assign(new EventTarget(), { setTimeout });
  const source = { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn(),
    querySelector: () => ({ textContent: 'test image' }), getAttribute: () => null };
  return { document, window, source, target, list, ghost };
}

function pointer(options: { type: string; x?: number; y?: number }): Event {
  return Object.assign(new Event(options.type, { cancelable: true }), { pointerId: 1, clientX: options.x ?? 20, clientY: options.y ?? 20 });
}

let environment: ReturnType<typeof fixture>;
function begin(): void {
  const event = { button: 0, pointerId: 1, clientX: 10, clientY: 10, currentTarget: environment.source };
  startLibraryDrag(event as unknown as ReactPointerEvent<HTMLElement>, { kind: 'attachment', id: getEditorState().project.attachments[0].id });
}

beforeEach(() => { vi.useFakeTimers(); environment = fixture(); vi.stubGlobal('document', environment.document); vi.stubGlobal('window', environment.window); replaceProject(createDemoProject()); });
afterEach(() => { environment.window.dispatchEvent(new Event('blur')); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('pointer library drag lifecycle', () => {
  it('retains ordinary clicks below the drag threshold and removes the capture key listener', () => {
    const remove = vi.spyOn(environment.document, 'removeEventListener'); begin();
    environment.document.dispatchEvent(pointer({ type: 'pointermove', x: 12, y: 12 }));
    environment.document.dispatchEvent(pointer({ type: 'pointerup', x: 12, y: 12 }));
    expect(environment.document.body.append).not.toHaveBeenCalled();
    expect(remove.mock.calls.some(call => call[0] === 'keydown' && call[2] === true)).toBe(true);
    const escape = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' });
    environment.document.dispatchEvent(escape); expect(escape.defaultPrevented).toBe(false);
    expect(getEditorState().past).toHaveLength(0);
  });

  it('scrolls the hovered list during a live drag and cancels without a transaction on Escape', () => {
    begin(); environment.document.dispatchEvent(pointer({ type: 'pointermove' }));
    const wheel = Object.assign(new Event('wheel', { cancelable: true }), { deltaY: 3, deltaMode: 1 });
    environment.document.dispatchEvent(wheel); expect(environment.list.scrollTop).toBe(84); expect(wheel.defaultPrevented).toBe(true);
    environment.document.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
    expect(environment.ghost.remove).toHaveBeenCalled(); expect(environment.source.releasePointerCapture).toHaveBeenCalled();
    environment.document.dispatchEvent(pointer({ type: 'pointerup' })); expect(getEditorState().past).toHaveLength(0);
  });

  it('commits one undo step on drop and suppresses the release click', () => {
    begin(); environment.document.dispatchEvent(pointer({ type: 'pointermove' })); environment.document.dispatchEvent(pointer({ type: 'pointerup' }));
    expect(getEditorState().project.attachments[0].boneId).toBe('head'); expect(getEditorState().past).toHaveLength(1);
    const click = new Event('click', { cancelable: true }); environment.document.dispatchEvent(click); expect(click.defaultPrevented).toBe(true);
  });

  it('discards a drag after switching documents even when object identifiers are reused', () => {
    begin(); environment.document.dispatchEvent(pointer({ type: 'pointermove' })); replaceProject(createDemoProject());
    const project = getEditorState().project; environment.document.dispatchEvent(pointer({ type: 'pointerup' }));
    expect(getEditorState().project).toBe(project); expect(getEditorState().past).toHaveLength(0);
    expect(environment.ghost.remove).toHaveBeenCalled();
  });
});
