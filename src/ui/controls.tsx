import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { ProjectCommand } from '@/core/types';
import { runCommand, updateEditor } from './store';

export interface FieldProps { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; disabled?: boolean }

/** Numeric property control that commits a valid value when editing finishes. */
export function NumberField(props: FieldProps) {
  return <label className="field"><span>{props.label}</span><input type="number" key={props.value}
    defaultValue={Number(props.value.toFixed(3))} min={props.min} max={props.max} step={props.step ?? 'any'} disabled={props.disabled}
    onFocus={() => updateEditor({ isPlaying: false })}
    onBlur={event => {
      const value = Number(event.target.value);
      if (event.target.value.trim() && event.target.validity.valid && Number.isFinite(value)) { if (value !== Number(props.value.toFixed(3))) props.onChange(value); }
      else event.target.value = String(props.value);
    }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>;
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
  const previous = useRef(document.activeElement);
  const close = useRef(props.onClose); close.current = props.onClose;
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopImmediatePropagation(); close.current(); }
      if (event.key === 'Tab') trapFocus(event, section.current);
    };
    document.addEventListener('keydown', listener);
    if (!section.current?.contains(document.activeElement)) section.current?.querySelector<HTMLElement>('input,select,button')?.focus();
    return () => { document.removeEventListener('keydown', listener); if (previous.current instanceof HTMLElement) previous.current.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section ref={section} className={`modal ${props.wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={props.title}>
      <header><h2>{props.title}</h2><button className="icon-button" aria-label="关闭弹窗" onClick={props.onClose}><X size={18} /></button></header>
      {props.children}
    </section>
  </div>;
}

function trapFocus(event: KeyboardEvent, section: HTMLElement | null): void {
  const elements = Array.from(section?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]') ?? []);
  const first = elements[0]; const last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}

/** Confirm document deletions using the editor's common deletion dialog. */
export function DeleteButton(props: { command: ProjectCommand; label: string; detail?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return <><button className="danger-button" onClick={() => setIsOpen(true)}><Trash2 size={14} />{props.label}</button>
    {isOpen && <Modal title={props.label} onClose={() => setIsOpen(false)}>
      <p className="modal-copy">{props.detail ?? '删除后可以使用撤销恢复。是否继续？'}</p>
      <footer><button onClick={() => setIsOpen(false)}>取消</button><button className="danger-solid" onClick={() => {
        runCommand(props.command); setIsOpen(false);
      }}>确认删除</button></footer>
    </Modal>}
  </>;
}
