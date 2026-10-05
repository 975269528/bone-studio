import { useEffect, useRef, useState } from 'react';
import { Bone, Image, Plus, Crosshair, Layers, Crop, Upload, Pencil } from 'lucide-react';
import type { Asset } from '@/core/types';
import { AddObject } from './AddObject';
import { AssetCrop } from './AssetCrop';
import { readImage } from './files';
import { applyCommands, getEditorState, reportError, updateEditor, useEditor } from './store';
import type { Selection } from './store';
import { LibraryTree } from './LibraryTree';
import { LIBRARY_DRAG_HOVER, startLibraryDrag } from './library-pointer-drag';
import './library-layout.css';

function handleRename(selection: Selection): void {
  updateEditor({ selection });
  requestAnimationFrame(() => { const input = document.querySelector<HTMLInputElement>('.property-content [data-name-field]'); input?.focus(); input?.select(); });
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

function AssetGrid(props: { onCrop: (asset: Asset) => void }) {
  const state = useEditor();
  return <div className="asset-grid">{state.project.assets.map(asset => <article className={`asset-card ${state.selection?.id === asset.id ? 'selected' : ''}`} key={asset.id}>
    <button className="asset-thumb checker" aria-label={`拖动素材 ${asset.name}`} data-library-kind="asset" data-library-id={asset.id} onPointerDown={event => startLibraryDrag(event, { kind: 'asset', id: asset.id })} onClick={() => updateEditor({ selection: { kind: 'asset', id: asset.id } })}><img src={asset.dataUrl} alt={asset.name} loading="lazy" draggable={false} /></button>
    <div className="asset-card-caption"><span title={asset.name}>{asset.name}</span><small>{asset.width} × {asset.height}</small></div>
    <div className="asset-actions"><button aria-label={`拆分 ${asset.name}`} onClick={() => props.onCrop(asset)}><Crop size={12} />拆分</button><button aria-label={`重命名素材 ${asset.name}`} title="重命名素材" onClick={() => handleRename({ kind: 'asset', id: asset.id })}><Pencil size={12} /></button><button aria-label={`添加 ${asset.name} 到画布`} onClick={() => addAttachment(asset)}><Plus size={13} /></button></div>
  </article>)}{!state.project.assets.length && <p className="empty-copy">导入 PNG、WebP 或 JPEG 图片，可裁切拆分成独立部件。</p>}</div>;
}

/** Browse editable bones, image slots, IK chains and reusable PNG image assets. */
export function Library() {
  const state = useEditor(); const [tab, setTab] = useState<'bones' | 'assets'>('bones');
  const [dialog, setDialog] = useState<'bone' | 'ik' | null>(null); const [crop, setCrop] = useState<Asset | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { const handleDragHover = () => setTab('bones'); document.addEventListener(LIBRARY_DRAG_HOVER, handleDragHover);
    return () => document.removeEventListener(LIBRARY_DRAG_HOVER, handleDragHover); }, []);
  const handleImport = async (files?: FileList | null) => {
    try { const assets = files ? await Promise.all(Array.from(files).map(readImage)) : await window.boneStudio?.importImages();
      if (assets?.length) { applyCommands(assets.map(asset => ({ type: 'asset.add', asset }))); setTab('assets'); updateEditor({ message: `已导入 ${assets.length} 张图片` }); }
    } catch (error) { reportError(error); }
    if (input.current) input.current.value = '';
  };
  return <aside className="library panel"><div className="panel-title"><Layers size={15} /><span>资源</span><span className="tiny-label">EXPLORER</span></div>
    <div className="library-tabs"><button className={tab === 'bones' ? 'active' : ''} data-library-tab="bones" onClick={() => setTab('bones')}><Bone size={14} />骨骼树 <small>{state.project.bones.length}</small></button><button className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}><Image size={14} />素材 <small>{state.project.assets.length}</small></button></div>
    <div className="library-actions">{tab === 'bones' ? <><button onClick={() => setDialog('bone')}><Plus size={13} />添加骨骼</button><button onClick={() => setDialog('ik')}><Crosshair size={13} />IK</button></> : <button className="import-button" onClick={() => { if (window.boneStudio) void handleImport(); else input.current?.click(); }}><Upload size={13} />导入图片</button>}<button className="asset-bone-create" hidden={tab !== 'assets'} onClick={() => setDialog('bone')}><Bone size={13} />添加骨骼</button></div>
    <div className={`library-scroll ${tab === 'bones' ? 'is-tree' : ''}`} data-library-scroll={tab === 'assets' ? '' : undefined}>{tab === 'bones' ? <LibraryTree /> : <AssetGrid onCrop={setCrop} />}</div>
    <div className="library-bottom"><span className="status-dot enabled" />{state.project.attachments.length} 个图片部件<span className="muted">拖拽建立绑定</span></div>
    <input ref={input} type="file" accept="image/png,image/webp,image/jpeg" multiple hidden onChange={event => { void handleImport(event.target.files); }} />
    {dialog && <AddObject kind={dialog} onClose={() => setDialog(null)} onCreated={() => setTab('bones')} />}{crop && <AssetCrop asset={crop} onClose={() => setCrop(null)} />}
  </aside>;
}
