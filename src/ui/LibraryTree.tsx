import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { Bone as BoneIcon, ChevronRight, Crosshair, Image, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import type { Attachment, Bone, Project } from '@/core/types';
import { dropLibraryItem, isLibraryDrag, startLibraryDrag } from './library-drag';
import { reportError, updateEditor, useEditor } from './store';
import type { Selection } from './store';

interface TreeContext { project: Project; selection: Selection; collapsed: Set<string>; dropTarget: string | null; toggle: (id: string) => void;
  handleOver: (event: DragEvent, id: string) => void; handleDrop: (event: DragEvent, id: string | null) => void }
const ROOT_SECTION = '$root';
const UNBOUND_SECTION = '$unbound';
const IK_SECTION = '$ik';
const INDENT = 13;

function handleRename(selection: Selection): void {
  updateEditor({ selection });
  requestAnimationFrame(() => { const input = document.querySelector<HTMLInputElement>('.property-content [data-name-field]'); input?.focus(); input?.select(); });
}

function ancestors(project: Project, selection: Selection): string[] {
  if (!selection) return [];
  if (selection.kind === 'ik') return [IK_SECTION];
  const attachment = selection.kind === 'attachment' ? project.attachments.find(item => item.id === selection.id) : undefined;
  if (attachment && !attachment.boneId) return [UNBOUND_SECTION];
  let parentId = attachment?.boneId ?? project.bones.find(item => item.id === selection.id)?.parentId;
  const path: string[] = [];
  while (parentId) { path.push(parentId); parentId = project.bones.find(item => item.id === parentId)?.parentId; }
  return path;
}

function ImageRow(props: { attachment: Attachment; context: TreeContext; depth: number }) {
  const { attachment, context, depth } = props;
  return <button className={`tree-row attachment-row ${context.selection?.id === attachment.id ? 'selected' : ''}`}
    data-library-kind="attachment" data-library-id={attachment.id} draggable onDragStart={event => startLibraryDrag(event, { kind: 'attachment', id: attachment.id })}
    style={{ paddingLeft: 30 + depth * INDENT }} title={`${attachment.name} · ${attachment.boneId ? '已绑定，拖到另一骨骼可换绑' : '未绑定，拖到骨骼上绑定'}；双击重命名`}
    onDoubleClick={() => handleRename({ kind: 'attachment', id: attachment.id })} onClick={() => updateEditor({ selection: { kind: 'attachment', id: attachment.id } })}>
    <Image size={12} /><span>{attachment.name}</span></button>;
}

function Branch(props: { bone: Bone; context: TreeContext; depth: number }) {
  const { bone, context, depth } = props; const images = context.project.attachments.filter(item => item.boneId === bone.id);
  const children = context.project.bones.filter(item => item.parentId === bone.id);
  const hasChildren = !!(children.length || images.length); const isExpanded = !context.collapsed.has(bone.id);
  return <div><div className={`tree-bone-row ${context.selection?.id === bone.id ? 'selected' : ''} ${context.dropTarget === bone.id ? 'drop-active' : ''}`}
    style={{ paddingLeft: 9 + depth * INDENT }} onDragOver={event => context.handleOver(event, bone.id)} onDrop={event => context.handleDrop(event, bone.id)}>
    <button className="tree-toggle" type="button" aria-label={`${isExpanded ? '收起' : '展开'} ${bone.name}`} aria-expanded={isExpanded} disabled={!hasChildren} onClick={() => context.toggle(bone.id)}>
      <ChevronRight size={12} className={isExpanded ? 'expanded' : ''} /></button>
    <button className="tree-row" data-library-kind="bone" data-library-id={bone.id} draggable onDragStart={event => startLibraryDrag(event, { kind: 'bone', id: bone.id })}
      onClick={() => updateEditor({ selection: { kind: 'bone', id: bone.id } })} onDoubleClick={() => handleRename({ kind: 'bone', id: bone.id })}
      title={`${bone.name} · 拖到骨骼更换父级，拖到根级解除父级；双击重命名`}><BoneIcon size={14} /><span>{bone.name}</span><small>{images.length ? `${images.length} 图` : ''}</small></button>
    </div>{isExpanded && <>{images.map(attachment => <ImageRow key={attachment.id} attachment={attachment} context={context} depth={depth + 1} />)}
      {children.map(child => <Branch key={child.id} bone={child} context={context} depth={depth + 1} />)}</>}</div>;
}

function Sections(props: { context: TreeContext }) {
  const { context } = props; const { project } = context; const unbound = project.attachments.filter(item => !item.boneId);
  return <><div className={`tree-drop-zone ${context.dropTarget === ROOT_SECTION ? 'drop-active' : ''}`}
    onDragOver={event => context.handleOver(event, ROOT_SECTION)} onDrop={event => context.handleDrop(event, null)}>根级 / 解除父级或图片绑定</div>
    {project.bones.filter(bone => !bone.parentId).map(bone => <Branch key={bone.id} bone={bone} context={context} depth={0} />)}
    {!project.bones.length && <p className="empty-copy">选择图片部件后添加骨骼，可一起绑定。</p>}
    <div className={`tree-section ${context.dropTarget === UNBOUND_SECTION ? 'drop-active' : ''}`} onDragOver={event => context.handleOver(event, UNBOUND_SECTION)} onDrop={event => context.handleDrop(event, null)}>
      <button className="tree-subheading" aria-expanded={!context.collapsed.has(UNBOUND_SECTION)} onClick={() => context.toggle(UNBOUND_SECTION)}>
        <ChevronRight size={11} className={!context.collapsed.has(UNBOUND_SECTION) ? 'expanded' : ''} />未绑定图片 <span>{unbound.length}</span></button>
      {!context.collapsed.has(UNBOUND_SECTION) && unbound.map(attachment => <ImageRow key={attachment.id} attachment={attachment} context={context} depth={0} />)}
    </div><button className="tree-subheading" aria-expanded={!context.collapsed.has(IK_SECTION)} onClick={() => context.toggle(IK_SECTION)}>
      <ChevronRight size={11} className={!context.collapsed.has(IK_SECTION) ? 'expanded' : ''} />IK 约束 <span>{project.ikConstraints.length}</span></button>
    {!context.collapsed.has(IK_SECTION) && project.ikConstraints.map(constraint => <button key={constraint.id} className={`tree-row ${context.selection?.id === constraint.id ? 'selected' : ''}`}
      title={constraint.name} onClick={() => updateEditor({ selection: { kind: 'ik', id: constraint.id } })}><Crosshair size={14} className="orange" /><span>{constraint.name}</span><i className={`status-dot ${constraint.enabled ? 'enabled' : ''}`} /></button>)}</>;
}

/** Browse a collapsible hierarchy with explicit bone, image and root drop targets; selection reveals its ancestors. */
export function LibraryTree() {
  const state = useEditor(); const [collapsed, setCollapsed] = useState(new Set<string>()); const [dropTarget, setDropTarget] = useState<string | null>(null);
  const path = ancestors(state.project, state.selection).join('|'); const selectionKey = `${state.selection?.kind}:${state.selection?.id}`;
  useEffect(() => { setCollapsed(previous => { const next = new Set(previous); path.split('|').forEach(id => next.delete(id)); return next; }); }, [path, selectionKey]);
  const toggle = (id: string) => setCollapsed(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const handleOver = (event: DragEvent, id: string) => { if (isLibraryDrag(event)) { event.preventDefault(); event.stopPropagation(); setDropTarget(id); } };
  const handleDrop = (event: DragEvent, id: string | null) => {
    event.preventDefault(); event.stopPropagation(); setDropTarget(null);
    try { dropLibraryItem(event, id); setCollapsed(previous => { const next = new Set(previous); next.delete(id ?? UNBOUND_SECTION); return next; }); }
    catch (error) { reportError(error); }
  };
  const context = { project: state.project, selection: state.selection, collapsed, dropTarget, toggle, handleOver, handleDrop };
  return <div className="tree-list" onDragEnd={() => setDropTarget(null)} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null); }}>
    <div className="tree-controls"><span>拖图片到骨骼绑定</span><button aria-label="全部展开" title="全部展开" onClick={() => setCollapsed(new Set())}><ChevronsUpDown size={12} /></button>
      <button aria-label="全部收起" title="全部收起" onClick={() => setCollapsed(new Set([...state.project.bones.map(bone => bone.id), UNBOUND_SECTION, IK_SECTION]))}><ChevronsDownUp size={12} /></button></div>
    <Sections context={context} />
  </div>;
}
