import type { ProjectCommand } from '@/core/types';
import type { Selection } from './store';

let interactionTarget: Element | null = null;
const activePointers = new Set<number>();
let isNativeDragging = false;

/** Explicit button event for immediate Del deletion using the button's current command. */
export const DELETE_SHORTCUT_EVENT = 'bone-studio:delete-shortcut';

/** Track pointer gestures and the latest focus context; return a listener cleanup function. */
export function installDeletionGuards(): () => void {
  const handlePointerDown = (event: PointerEvent) => {
    activePointers.add(event.pointerId);
    interactionTarget = event.target instanceof Element ? event.target : null;
  };
  const handlePointerEnd = (event: PointerEvent) => { activePointers.delete(event.pointerId); };
  const handleFocus = (event: FocusEvent) => { interactionTarget = event.target instanceof Element ? event.target : null; };
  const handleDragStart = () => { isNativeDragging = true; };
  const handleReset = () => { activePointers.clear(); isNativeDragging = false; };
  document.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('pointerup', handlePointerEnd, true);
  document.addEventListener('pointercancel', handlePointerEnd, true);
  document.addEventListener('focusin', handleFocus, true);
  document.addEventListener('dragstart', handleDragStart, true);
  document.addEventListener('dragend', handleReset, true);
  window.addEventListener('blur', handleReset);
  return () => {
    document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    document.removeEventListener('pointerup', handlePointerEnd, { capture: true });
    document.removeEventListener('pointercancel', handlePointerEnd, { capture: true });
    document.removeEventListener('focusin', handleFocus, { capture: true });
    document.removeEventListener('dragstart', handleDragStart, { capture: true });
    document.removeEventListener('dragend', handleReset, { capture: true });
    window.removeEventListener('blur', handleReset);
    handleReset(); interactionTarget = null;
  };
}

/** Report active pointer or native drag gestures that must not be interrupted by deletion. */
export function hasDeletionGesture(): boolean { return activePointers.size > 0 || isNativeDragging; }

/** Identify one existing keyframe deletion without duplicating its command execution. */
export function keyframeDeletionKey(command: ProjectCommand): string | undefined {
  if (command.type === 'keyframe.remove') return JSON.stringify([command.type, command.animationId, command.boneId, command.time]);
  if (command.type === 'ik.keyframe.remove') return JSON.stringify([command.type, command.constraintId, command.time]);
  return undefined;
}

/** Resolve safe deletion scopes: an explicit keyframe/button, or the selected inspector object. */
export function deletionScope(context: { explicitKind?: string; isTimeline: boolean; selection: Selection }): string | undefined {
  if (context.explicitKind) return context.explicitKind;
  if (context.isTimeline || !context.selection || context.selection.kind === 'asset') return undefined;
  return `${context.selection.kind}.remove`;
}

/** Execute the existing delete button for the current explicit keyboard/pointer context. */
export function requestShortcutDeletion(selection: Selection): boolean {
  // Removed keys/buttons retain their scope until a real focus or pointer interaction selects another target.
  if (interactionTarget && !interactionTarget.isConnected) return false;
  const target = interactionTarget ?? document.activeElement;
  const explicit = target?.closest<HTMLButtonElement>('button[data-delete-kind]');
  if (explicit && !explicit.disabled) { explicit.dispatchEvent(new Event(DELETE_SHORTCUT_EVENT)); return true; }
  const key = target?.closest<HTMLElement>('[data-keyframe-delete]')?.dataset.keyframeDelete;
  if (key) {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-delete-key]'))
      .find(item => item.dataset.deleteKey === key);
    if (!button) return false;
    button.dispatchEvent(new Event(DELETE_SHORTCUT_EVENT)); return true;
  }
  const scope = deletionScope({ isTimeline: !!target?.closest('.timeline'), selection });
  if (!scope) return false;
  const button = document.querySelector<HTMLButtonElement>(`.inspector button[data-delete-kind="${scope}"]`);
  if (!button) return false;
  button.dispatchEvent(new Event(DELETE_SHORTCUT_EVENT)); return true;
}
