import { useRef, useState } from 'react';
import { Bone, Image, Plus, ChevronRight, Crosshair, Layers, Crop, Upload, Pencil } from 'lucide-react';
import type { Asset, Bone as BoneModel, Project } from '@/core/types';
import { AddObject } from './AddObject';
import { AssetCrop } from './AssetCrop';
import { readImage } from './files';
import { applyCommands, getEditorState, reportError, updateEditor, useEditor } from './store';
import type { Selection } from './store';

function handleRename(selection: Selection): void {
  updateEditor({ selection });
  requestAnimationFrame(() => { const input = document.querySelector<HTMLInputElement>('.property-content [data-name-field]'); input?.focus(); input?.select(); });
}

function boneDepth(project: Project, id: string): number {
  const bone = project.bones.find(item => item.id === id); if (!bone?.parentId) return 0;
  return 1 + boneDepth(project, bone.parentId);
}

function orderedBones(project: Project): BoneModel[] {
  const children = new Map<string | null, BoneModel[]>();
  project.bones.forEach(bone => children.set(bone.parentId, [...(children.get(bone.parentId) ?? []), bone]));
  const visit = (parentId: string | null): BoneModel[] => (children.get(parentId) ?? []).flatMap(bone => [bone, ...visit(bone.id)]);
  return visit(null);
}

function addAttachment(asset: Asset) {
  const state = getEditorState(); const boneId = state.selection?.kind === 'bone' ? state.selection.id : null;
  const id = crypto.randomUUID();
  try { applyCommands([{ type: 'attachment.add', attachment: { id, name: asset.name, assetId: asset.id, boneId,
    x: boneId ? 0 : state.project.width / 2, y: boneId ? 0 : state.project.height / 2,
    rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1, zIndex: state.project.attachments.length } }]);
    updateEditor({ selection: { kind: 'attachment', id } });
  } catch (error) { reportError(error); }
}

function BoneTree() {
  const state = useEditor();
  return <div className="tree-list">{orderedBones(state.project).map(bone => <div key={bone.id}>
    <button className={`tree-row ${state.selection?.id === bone.id ? 'selected' : ''}`} style={{ paddingLeft: 12 + boneDepth(state.project, bone.id) * 13 }}
      title="双击重命名" onDoubleClick={() => handleRename({ kind: 'bone', id: bone.id })} onClick={() => updateEditor({ selection: { kind: 'bone', id: bone.id } })}><ChevronRight size={11} className="muted" /><Bone size={14} /><span>{bone.name}</span></button>
    {state.project.attachments.filter(attachment => attachment.boneId === bone.id).map(attachment => <button key={attachment.id} className={`tree-row attachment-row ${state.selection?.id === attachment.id ? 'selected' : ''}`}
      style={{ paddingLeft: 37 + boneDepth(state.project, bone.id) * 13 }} onClick={() => updateEditor({ selection: { kind: 'attachment', id: attachment.id } })}><Image size={12} /><span>{attachment.name}</span></button>)}
  </div>)}{state.project.attachments.filter(attachment => !attachment.boneId).map(attachment => <button key={attachment.id} className={`tree-row ${state.selection?.id === attachment.id ? 'selected' : ''}`} onClick={() => updateEditor({ selection: { kind: 'attachment', id: attachment.id } })}><Image size={14} /><span>{attachment.name}</span></button>)}
    {!state.project.bones.length && <p className="empty-copy">添加根骨骼，建立角色的第一段骨架。</p>}
    <div className="tree-subheading">IK 约束 <span>{state.project.ikConstraints.length}</span></div>{state.project.ikConstraints.map(constraint => <button key={constraint.id} className={`tree-row ${state.selection?.id === constraint.id ? 'selected' : ''}`} onClick={() => updateEditor({ selection: { kind: 'ik', id: constraint.id } })}><Crosshair size={14} className="orange" /><span>{constraint.name}</span><i className={`status-dot ${constraint.enabled ? 'enabled' : ''}`} /></button>)}</div>;
}

function AssetGrid(props: { onCrop: (asset: Asset) => void }) {
  const state = useEditor();
  return <div className="asset-grid">{state.project.assets.map(asset => <article className={`asset-card ${state.selection?.id === asset.id ? 'selected' : ''}`} key={asset.id}>
    <button className="asset-thumb checker" onClick={() => updateEditor({ selection: { kind: 'asset', id: asset.id } })}><img src={asset.dataUrl} alt={asset.name} loading="lazy" /></button>
    <div className="asset-card-caption"><span title={asset.name}>{asset.name}</span><small>{asset.width} × {asset.height}</small></div>
    <div className="asset-actions"><button aria-label={`拆分 ${asset.name}`} onClick={() => props.onCrop(asset)}><Crop size={12} />拆分</button><button aria-label={`重命名素材 ${asset.name}`} title="重命名素材" onClick={() => handleRename({ kind: 'asset', id: asset.id })}><Pencil size={12} /></button><button aria-label={`添加 ${asset.name} 到画布`} onClick={() => addAttachment(asset)}><Plus size={13} /></button></div>
  </article>)}{!state.project.assets.length && <p className="empty-copy">导入 PNG、WebP 或 JPEG 图片，可裁切拆分成独立部件。</p>}</div>;
}

/** Browse editable bones, image slots, IK chains and reusable PNG image assets. */
export function Library() {
  const state = useEditor(); const [tab, setTab] = useState<'bones' | 'assets'>('bones');
  const [dialog, setDialog] = useState<'bone' | 'ik' | null>(null); const [crop, setCrop] = useState<Asset | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const handleImport = async (files?: FileList | null) => {
    try { const assets = files ? await Promise.all(Array.from(files).map(readImage)) : await window.boneStudio?.importImages();
      if (assets?.length) { applyCommands(assets.map(asset => ({ type: 'asset.add', asset }))); setTab('assets'); updateEditor({ message: `已导入 ${assets.length} 张图片` }); }
    } catch (error) { reportError(error); }
    if (input.current) input.current.value = '';
  };
  return <aside className="library panel"><div className="panel-title"><Layers size={15} /><span>资源</span><span className="tiny-label">EXPLORER</span></div>
    <div className="library-tabs"><button className={tab === 'bones' ? 'active' : ''} onClick={() => setTab('bones')}><Bone size={14} />骨骼树 <small>{state.project.bones.length}</small></button><button className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}><Image size={14} />素材 <small>{state.project.assets.length}</small></button></div>
    <div className="library-actions">{tab === 'bones' ? <><button onClick={() => setDialog('bone')}><Plus size={13} />添加骨骼</button><button onClick={() => setDialog('ik')}><Crosshair size={13} />IK</button></> : <button className="import-button" onClick={() => { if (window.boneStudio) void handleImport(); else input.current?.click(); }}><Upload size={13} />导入图片</button>}</div>
    <div className="library-scroll">{tab === 'bones' ? <BoneTree /> : <AssetGrid onCrop={setCrop} />}</div>
    <div className="library-bottom"><span className="status-dot enabled" />{state.project.attachments.length} 个图片部件<span className="muted">无网格骨骼绑定</span></div>
    <input ref={input} type="file" accept="image/png,image/webp,image/jpeg" multiple hidden onChange={event => { void handleImport(event.target.files); }} />
    {dialog && <AddObject kind={dialog} onClose={() => setDialog(null)} />}{crop && <AssetCrop asset={crop} onClose={() => setCrop(null)} />}
  </aside>;
}
