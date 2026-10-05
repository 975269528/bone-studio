import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Bone as BoneIcon, ChevronRight, Crosshair, Image, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import type { Attachment, Bone, Project } from '@/core/types';
import { startLibraryDrag } from './library-pointer-drag';
import { LIBRARY_SECTIONS, selectionPath } from './library-layout';
import { updateEditor, useEditor } from './store';
import type { Selection } from './store';
import './library-layout.css';

interface TreeContext { project: Project; selection: Selection; collapsed: Set<string>; toggle: (id: string) => void }
const INDENT = 13;

function handleRename(selection: Selection): void {
  updateEditor({ selection });
  requestAnimationFrame(() => { const input = document.querySelector<HTMLInputElement>('.property-content [data-name-field]'); input?.focus(); input?.select(); });
}

function ImageRow(props: { attachment: Attachment; context: TreeContext; depth: number }) {
  const { attachment, context, depth } = props;
  return <button className={`tree-row attachment-row ${context.selection?.id === attachment.id ? 'selected' : ''}`}
    data-library-kind="attachment" data-library-id={attachment.id} onPointerDown={event => startLibraryDrag(event, { kind: 'attachment', id: attachment.id })}
    style={{ paddingLeft: 30 + depth * INDENT }} title={`${attachment.name} · ${attachment.boneId ? '已绑定，拖到另一骨骼可换绑' : '未绑定，拖到骨骼上绑定'}；双击重命名`}
    onDoubleClick={() => handleRename({ kind: 'attachment', id: attachment.id })} onClick={() => updateEditor({ selection: { kind: 'attachment', id: attachment.id } })}>
    <Image size={12} /><span>{attachment.name}</span></button>;
}

function Branch(props: { bone: Bone; context: TreeContext; depth: number }) {
  const { bone, context, depth } = props; const images = context.project.attachments.filter(item => item.boneId === bone.id);
  const children = context.project.bones.filter(item => item.parentId === bone.id);
  const hasChildren = !!(children.length || images.length); const isExpanded = !context.collapsed.has(bone.id);
  return <div><div className={`tree-bone-row ${context.selection?.id === bone.id ? 'selected' : ''}`} data-library-drop={bone.id}
    style={{ paddingLeft: 9 + depth * INDENT }}>
    <button className="tree-toggle" type="button" aria-label={`${isExpanded ? '收起' : '展开'} ${bone.name}`} aria-expanded={isExpanded} disabled={!hasChildren} onClick={() => context.toggle(bone.id)}>
      <ChevronRight size={12} className={isExpanded ? 'expanded' : ''} /></button>
    <button className="tree-row" data-library-kind="bone" data-library-id={bone.id} onPointerDown={event => startLibraryDrag(event, { kind: 'bone', id: bone.id })}
      onClick={() => updateEditor({ selection: { kind: 'bone', id: bone.id } })} onDoubleClick={() => handleRename({ kind: 'bone', id: bone.id })}
      title={`${bone.name} · 拖到骨骼更换父级，拖到根级解除父级；双击重命名`}><BoneIcon size={14} /><span>{bone.name}</span><small>{images.length ? `${images.length} 图` : ''}</small></button>
    </div>{isExpanded && <>{images.map(attachment => <ImageRow key={attachment.id} attachment={attachment} context={context} depth={depth + 1} />)}
      {children.map(child => <Branch key={child.id} bone={child} context={context} depth={depth + 1} />)}</>}</div>;
}

function TreeGroup(props: { id: string; label: string; count: number; context: TreeContext; children: ReactNode; isDropZone?: boolean; rows?: number }) {
  const isExpanded = !props.context.collapsed.has(props.id);
  const rows = props.rows ?? props.count;
  return <section className={`tree-group ${isExpanded ? 'is-expanded' : ''} ${rows === 0 ? 'is-empty' : ''}`} data-library-section={props.id}
    style={{ '--group-rows': rows } as CSSProperties}>
    <button className="tree-subheading" aria-expanded={isExpanded} aria-controls={`library-${props.id}`} data-library-drop={props.isDropZone ? props.id : undefined}
      onClick={() => props.context.toggle(props.id)} title={props.isDropZone ? '将图片拖到这里解除绑定' : undefined}>
      <ChevronRight size={12} className={isExpanded ? 'expanded' : ''} />{props.label}<span>{props.count}</span></button>
    {isExpanded && <div id={`library-${props.id}`} className="tree-group-list" data-library-scroll>{props.children}</div>}
  </section>;
}

function Sections(props: { context: TreeContext }) {
  const { context } = props; const { project } = context; const unbound = project.attachments.filter(item => !item.boneId);
  return <div className="tree-groups"><TreeGroup id={LIBRARY_SECTIONS.bones} label="骨骼" count={project.bones.length} rows={project.bones.length + project.attachments.length - unbound.length} context={context}>
    {project.bones.filter(bone => !bone.parentId).map(bone => <Branch key={bone.id} bone={bone} context={context} depth={0} />)}
    {!project.bones.length && <p className="empty-copy">选择图片部件后添加骨骼，可一起绑定。</p>}
  </TreeGroup><TreeGroup id={LIBRARY_SECTIONS.unbound} label="未绑定图片" count={unbound.length} context={context} isDropZone>
    {unbound.map(attachment => <ImageRow key={attachment.id} attachment={attachment} context={context} depth={0} />)}
    {!unbound.length && <p className="empty-copy">暂无未绑定图片</p>}
  </TreeGroup><TreeGroup id={LIBRARY_SECTIONS.ik} label="IK 约束" count={project.ikConstraints.length} context={context}>
    {project.ikConstraints.map(constraint => <button key={constraint.id} className={`tree-row ${context.selection?.id === constraint.id ? 'selected' : ''}`}
      title={constraint.name} onClick={() => updateEditor({ selection: { kind: 'ik', id: constraint.id } })}><Crosshair size={14} className="orange" /><span>{constraint.name}</span><i className={`status-dot ${constraint.enabled ? 'enabled' : ''}`} /></button>)}
    {!project.ikConstraints.length && <p className="empty-copy">暂无 IK 约束</p>}
  </TreeGroup></div>;
}

function revealSelected(container: HTMLElement | null): void {
  const selected = container?.querySelector<HTMLElement>('.tree-row.selected, .tree-bone-row.selected');
  const list = selected?.closest<HTMLElement>('[data-library-scroll]'); if (!selected || !list) return;
  const rowBounds = selected.getBoundingClientRect(); const listBounds = list.getBoundingClientRect();
  if (rowBounds.top < listBounds.top) list.scrollTop -= listBounds.top - rowBounds.top;
  else if (rowBounds.bottom > listBounds.bottom) list.scrollTop += rowBounds.bottom - listBounds.bottom;
}

/** Browse three independently scrolling groups; selecting a hidden item reveals its section and ancestors. */
export function LibraryTree() {
  const state = useEditor(); const [collapsed, setCollapsed] = useState(new Set<string>()); const container = useRef<HTMLDivElement>(null);
  const path = JSON.stringify(selectionPath(state.project, state.selection)); const selectionKey = JSON.stringify(state.selection);
  useEffect(() => {
    setCollapsed(previous => { const next = new Set(previous); (JSON.parse(path) as string[]).forEach(id => next.delete(id)); return next; });
    const frame = requestAnimationFrame(() => revealSelected(container.current)); return () => cancelAnimationFrame(frame);
  }, [path, selectionKey]);
  const toggle = (id: string) => setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const context = { project: state.project, selection: state.selection, collapsed, toggle };
  return <div className="tree-list" ref={container}>
    <div className="tree-controls"><span>按住拖动时可滚轮查找目标</span><button aria-label="全部展开" title="全部展开" onClick={() => setCollapsed(new Set())}><ChevronsUpDown size={12} /></button>
      <button aria-label="全部收起" title="全部收起" onClick={() => setCollapsed(new Set([...state.project.bones.map(bone => bone.id), ...Object.values(LIBRARY_SECTIONS)]))}><ChevronsDownUp size={12} /></button></div>
    <div className="tree-drop-zone" data-library-drop={LIBRARY_SECTIONS.root}>根级 / 解除父级或图片绑定</div>
    <Sections context={context} />
  </div>;
}
