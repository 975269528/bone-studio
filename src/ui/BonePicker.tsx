import { useCallback, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import type { Bone, Project } from '@/core/types';
import { usePickerPopup } from './use-picker-popup';
import './popup-layout.css';

interface PickerProps {
  project: Project;
  label: string;
  value: string | null;
  excludeBranchId?: string;
  requiredParentId?: string;
  onChange: (id: string | null) => void;
}
interface BoneOption { bone: Bone; path: string }
interface MenuProps { picker: PickerProps; options: BoneOption[]; listId: string; query: string; onQuery: (query: string) => void; onChoose: (id: string | null) => void }

/** Return readable hierarchy paths, excluding the selected bone and all descendants from parent choices. */
export function boneOptions(project: Project, excludeBranchId?: string): BoneOption[] {
  const paths = new Map<string, string>();
  const pathFor = (bone: Bone): string => {
    const cached = paths.get(bone.id); if (cached) return cached;
    const parent = project.bones.find(item => item.id === bone.parentId);
    const path = parent ? `${pathFor(parent)} / ${bone.name}` : bone.name;
    paths.set(bone.id, path); return path;
  };
  const isExcluded = (bone: Bone): boolean => bone.id === excludeBranchId
    || (!!bone.parentId && isExcluded(project.bones.find(item => item.id === bone.parentId)!));
  return project.bones.filter(bone => !isExcluded(bone)).map(bone => ({ bone, path: pathFor(bone) }));
}

/** Search named bones by their full hierarchy path; display names never expose raw association IDs. */
export function BonePicker(props: PickerProps) {
  const [isOpen, setIsOpen] = useState(false); const [query, setQuery] = useState(''); const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null); const menu = useRef<HTMLDivElement>(null);
  const options = boneOptions(props.project, props.excludeBranchId);
  const current = options.find(option => option.bone.id === props.value);
  const handleClose = useCallback((restoreFocus: boolean) => {
    setIsOpen(false); setQuery(''); if (restoreFocus) trigger.current?.focus();
  }, []);
  const handleMenuMount = useCallback((node: HTMLDivElement | null) => {
    menu.current = node; node?.querySelector<HTMLInputElement>('input')?.focus();
  }, []);
  const placement = usePickerPopup({ isOpen, trigger, menu, onClose: handleClose });
  const handleChoose = (id: string | null) => { props.onChange(id); handleClose(true); };
  return <div className="field full bone-picker">
    <span id={`${listId}-label`}>{props.label}</span>
    <button ref={trigger} type="button" role="combobox" aria-haspopup="listbox" aria-labelledby={`${listId}-label`} aria-expanded={isOpen} aria-controls={listId}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setIsOpen(true); } }}
      className="bone-picker-trigger" onClick={() => { setIsOpen(!isOpen); setQuery(''); }} title={current?.path}>
      <span>{current?.path ?? (props.value ? '骨骼不可用' : '无 · 保持独立')}</span><ChevronDown size={13} /></button>
    {isOpen && placement && createPortal(<div ref={handleMenuMount} className="bone-picker-menu bone-picker-portal" style={placement}
      data-modal-owner={trigger.current?.closest<HTMLElement>('[role="dialog"]')?.dataset.modalOwner} onKeyDown={handlePickerNavigation}>
      <PickerMenu picker={props} options={options} listId={listId} query={query} onQuery={setQuery} onChoose={handleChoose} />
    </div>, document.body)}
  </div>;
}

function PickerMenu(props: MenuProps) {
  const { picker, query } = props;
  const filtered = props.options.filter(option => option.path.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <><label className="bone-picker-search"><Search size={13} /><input aria-label={`搜索${picker.label}`} placeholder="搜索名称或层级…"
    value={query} onChange={event => props.onQuery(event.target.value)} /></label>
    <div id={props.listId} role="listbox" aria-label={`${picker.label}候选列表`}>
      {!query && <button type="button" role="option" aria-selected={!picker.value} disabled={!!picker.requiredParentId}
        onClick={() => props.onChoose(null)}>无 · 根骨骼 / 画布坐标</button>}
      {filtered.map(option => <button type="button" key={option.bone.id} role="option" aria-selected={picker.value === option.bone.id}
        disabled={!!picker.requiredParentId && option.bone.id !== picker.requiredParentId} title={option.path}
        onClick={() => props.onChoose(option.bone.id)}><strong>{option.bone.name}</strong><small>{option.path}</small></button>)}
      {!filtered.length && <p>没有匹配的骨骼</p>}
    </div></>;
}

function handlePickerNavigation(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
  const isInput = event.target instanceof HTMLInputElement;
  if (isInput && event.key === 'Enter') { event.preventDefault(); return; }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || (isInput && ['Home', 'End'].includes(event.key))) return;
  const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)'));
  if (!options.length) return;
  event.preventDefault();
  const index = options.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
    : event.key === 'ArrowDown' ? (index + 1) % options.length : (index <= 0 ? options.length : index) - 1;
  options[next]?.focus();
}
