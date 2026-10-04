import { useId, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { Bone, Project } from '@/core/types';

interface PickerProps {
  project: Project;
  label: string;
  value: string | null;
  excludeBranchId?: string;
  requiredParentId?: string;
  onChange: (id: string | null) => void;
}
interface BoneOption { bone: Bone; path: string }

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
  const options = boneOptions(props.project, props.excludeBranchId);
  const current = options.find(option => option.bone.id === props.value);
  const close = () => { setIsOpen(false); setQuery(''); };
  const handleChoose = (id: string | null) => { props.onChange(id); close(); };
  return <div className="field full bone-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <span id={`${listId}-label`}>{props.label}</span>
    <button type="button" role="combobox" aria-labelledby={`${listId}-label`} aria-expanded={isOpen} aria-controls={listId}
      className="bone-picker-trigger" onClick={() => { setIsOpen(!isOpen); setQuery(''); }} title={current?.path}>
      <span>{current?.path ?? (props.value ? '骨骼不可用' : '无 · 保持独立')}</span><ChevronDown size={13} /></button>
    {isOpen && <div className="bone-picker-menu" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <label className="bone-picker-search"><Search size={13} /><input autoFocus aria-label={`搜索${props.label}`} placeholder="搜索名称或层级…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div id={listId} role="listbox" aria-label={`${props.label}候选列表`}>
        {!query && <button type="button" role="option" aria-selected={!props.value} disabled={!!props.requiredParentId} onClick={() => handleChoose(null)}>无 · 根骨骼 / 画布坐标</button>}
        {options.filter(option => option.path.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(option =>
          <button type="button" key={option.bone.id} role="option" aria-selected={props.value === option.bone.id}
            disabled={!!props.requiredParentId && option.bone.id !== props.requiredParentId} title={option.path}
            onClick={() => handleChoose(option.bone.id)}><strong>{option.bone.name}</strong><small>{option.path}</small></button>)}
        {!options.some(option => option.path.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && <p>没有匹配的骨骼</p>}
      </div></div>}
  </div>;
}
