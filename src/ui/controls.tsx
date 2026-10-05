import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { ProjectCommand } from '@/core/types';
import { getEditorState, runCommand, updateEditor } from './store';
import { DELETE_SHORTCUT_EVENT, keyframeDeletionKey } from './delete-shortcut';
import type { CommitOptions } from './store';
import { useNumberScrub } from './use-number-scrub';
import { modalFocusElements, trapModalFocus } from './modal-focus';
import './popup-layout.css';

export interface FieldProps { label: string; value: number; onChange: (value: number, options?: CommitOptions) => void; min?: number; max?: number; step?: number; disabled?: boolean; isInteger?: boolean }

/** Numeric control with horizontal label scrubbing and validated keyboard input on blur. */
export function NumberField(props: FieldProps) {
  const scrub = useNumberScrub(props); const isComposing = useRef(false);
  return <label className="field"><span className={props.disabled ? '' : 'numeric-scrub'} title="左右拖动调整，Shift 微调；数值仍可输入"
    onPointerDown={scrub.handleStart} onPointerMove={scrub.handleMove} onPointerUp={scrub.handleEnd} onPointerCancel={scrub.handleCancel}>{props.label}</span><input type="number" key={props.value}
    defaultValue={Number(props.value.toFixed(3))} min={props.min} max={props.max} step={props.isInteger ? props.step ?? 1 : 'any'} disabled={props.disabled}
    onFocus={() => updateEditor({ isPlaying: false })}
    onBlur={event => {
      const value = Number(event.target.value);
      if (event.target.value.trim() && event.target.validity.valid && Number.isFinite(value)) { if (value !== Number(props.value.toFixed(3))) props.onChange(value); }
      else event.target.value = String(props.value);
    }} onCompositionStart={() => { isComposing.current = true; }} onCompositionEnd={() => { isComposing.current = false; }}
    onKeyDown={event => { if (event.key === 'Enter' && !isComposing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) event.currentTarget.blur(); }} /></label>;
}

/** Named text property control that commits only nonempty values. */
export function TextField(props: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(props.value);
  const isComposing = useRef(false);
  useEffect(() => { setDraft(props.value); }, [props.value]);
  const handleCommit = () => {
    const name = draft.trim();
    if (name && name !== props.value) props.onChange(name);
    setDraft(name || props.value);
  };
  return <label className="field full"><span>{props.label}<small>回车或离开输入框保存</small></span><input value={draft}
    data-name-field onFocus={() => updateEditor({ isPlaying: false })} onChange={event => setDraft(event.target.value)}
    onCompositionStart={() => { isComposing.current = true; }} onCompositionEnd={() => { isComposing.current = false; }}
    onBlur={handleCommit} onKeyDown={event => {
      if (event.key === 'Enter' && !isComposing.current && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) event.currentTarget.blur();
      if (event.key === 'Escape') { setDraft(props.value); event.stopPropagation(); }
    }} /></label>;
}

/** Accessible modal with Escape dismissal and focus restored to its trigger. */
export function Modal(props: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const section = useRef<HTMLElement>(null);
  const modalId = useId();
  const previous = useRef(document.activeElement);
  const close = useRef(props.onClose); close.current = props.onClose;
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape') { event.stopImmediatePropagation(); close.current(); }
      if (event.key === 'Tab') trapModalFocus(event, section.current);
    };
    const handleFocus = () => {
      if (section.current && !modalFocusElements(section.current).includes(document.activeElement as HTMLElement)) {
        section.current.querySelector<HTMLElement>('input,select,button')?.focus();
      }
    };
    document.addEventListener('keydown', listener);
    document.addEventListener('focusin', handleFocus);
    if (!section.current?.contains(document.activeElement)) section.current?.querySelector<HTMLElement>('input,select,button')?.focus();
    return () => {
      document.removeEventListener('keydown', listener); document.removeEventListener('focusin', handleFocus);
      if (previous.current instanceof HTMLElement) previous.current.focus();
    };
  }, []);
  return <div className="modal-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section ref={section} className={`modal modal--bounded ${props.wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={props.title}
      data-modal-owner={modalId} tabIndex={-1}>
      <header><h2>{props.title}</h2><button className="icon-button" aria-label="关闭弹窗" onClick={props.onClose}><X size={18} /></button></header>
      <div className="modal-body">{props.children}</div>
    </section>
  </div>;
}

function useImmediateDeletion(command: ProjectCommand) {
  const button = useRef<HTMLButtonElement>(null); const currentCommand = useRef(command); currentCommand.current = command;
  useEffect(() => {
    const element = button.current;
    const handleDeletion = () => { updateEditor({ isPlaying: false }); runCommand(currentCommand.current); };
    element?.addEventListener(DELETE_SHORTCUT_EVENT, handleDeletion);
    return () => element?.removeEventListener(DELETE_SHORTCUT_EVENT, handleDeletion);
  }, []);
  return button;
}

/** Delete immediately via Del, or confirm mouse clicks using the common deletion dialog. */
export function DeleteButton(props: { command: ProjectCommand; label: string; detail?: string }) {
  const button = useImmediateDeletion(props.command);
  const [pending, setPending] = useState<(typeof props & { documentId: string; revision: number }) | null>(null);
  const handleOpen = () => {
    const { documentId, revision } = getEditorState();
    if (!document.querySelector('[role="dialog"],dialog[open]')) {
      updateEditor({ isPlaying: false }); setPending({ ...props, documentId, revision });
    }
  };
  const handleConfirm = () => {
    if (!pending) return;
    const state = getEditorState();
    if (state.documentId !== pending.documentId || state.revision !== pending.revision) {
      updateEditor({ message: '文档已有其他改动，请重新选择对象并确认删除。' });
    } else runCommand(pending.command);
    setPending(null);
  };
  return <><button ref={button} className="danger-button" data-delete-kind={props.command.type} data-delete-key={keyframeDeletionKey(props.command)}
    aria-keyshortcuts="Delete" title={`${props.label} · Del`} onClick={handleOpen}><Trash2 size={14} />{props.label}</button>
    {pending && <Modal title={pending.label} onClose={() => setPending(null)}>
      <p className="modal-copy">{pending.detail ?? '删除后可以使用撤销恢复。是否继续？'}</p>
      <footer><button onClick={() => setPending(null)}>取消</button><button className="danger-solid" onClick={handleConfirm}>确认删除</button></footer>
    </Modal>}
  </>;
}
