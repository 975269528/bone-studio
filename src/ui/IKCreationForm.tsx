import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { applyCommands, getEditorState, updateEditor } from './store';
import { getIKChains } from './ik-chains';

/** Choose a validated IK chain and create it atomically; failures keep the form and its values open. */
export function IKCreationForm(props: { onClose: () => void; onCreated: () => void }) {
  const state = useRef(getEditorState()).current; const { project } = state;
  const chains = getIKChains({ project, animationId: state.animationId });
  const initial = chains.find(chain => chain.root.id === state.selection?.id || chain.tip.id === state.selection?.id) ?? chains[0];
  const roots = [...new Map(chains.map(chain => [chain.root.id, chain.root])).values()];
  const [name, setName] = useState(`IK ${project.ikConstraints.length + 1}`);
  const [rootId, setRootId] = useState(initial?.root.id ?? ''); const [tipId, setTipId] = useState(initial?.tip.id ?? '');
  const [isSaving, setIsSaving] = useState(false); const [error, setError] = useState('');
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (isSaving || !event.currentTarget.reportValidity() || !name.trim()) return;
    setIsSaving(true); setError('');
    try {
      const id = crypto.randomUUID();
      applyCommands([{ type: 'ik.add', constraint: { id, name: name.trim(), rootBoneId: rootId, tipBoneId: tipId,
        targetX: project.width / 2 + 120, targetY: project.height / 2 - 100, bendDirection: 1, enabled: true,
        targetKeys: [], ...(state.animationId ? { animationId: state.animationId } : {}) } }], { expectedRevision: state.revision });
      updateEditor({ selection: { kind: 'ik', id } }); props.onCreated();
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setIsSaving(false); }
  };
  return <form onSubmit={handleSubmit}>
    <label className="field full"><span>名称 <b>*</b></span><input autoFocus required value={name} onChange={event => setName(event.target.value)} /></label>
    <label className="field full"><span>第一段骨骼 <b>*</b></span><select required value={rootId} onChange={event => { setRootId(event.target.value); setTipId(chains.find(chain => chain.root.id === event.target.value)?.tip.id ?? ''); }}>
      {!roots.length && <option value="">无可用连续骨链</option>}{roots.map(bone => <option key={bone.id} value={bone.id}>{bone.name}</option>)}</select></label>
    <label className="field full"><span>第二段骨骼 <b>*</b></span><select required value={tipId} onChange={event => setTipId(event.target.value)}>
      {!tipId && <option value="">无可用子骨骼</option>}{chains.filter(chain => chain.root.id === rootId).map(chain => <option key={chain.tip.id} value={chain.tip.id}>{chain.tip.name}</option>)}</select></label>
    <p className="field-help">{chains.length ? '仅显示首尾连接、动画位置一致且未被其他适用 IK 占用的骨骼链。目标可在画布上拖动。' : '没有可用的两段连续骨链。请先让子骨骼 X 等于父骨骼长度、Y 为 0，并避免与已有 IK 约束共用骨骼。'}</p>
    {error && <p className="error-copy" role="alert">{error}</p>}
    <footer><button type="button" onClick={props.onClose}>取消</button><button type="submit" className="primary" disabled={isSaving || !name.trim() || !tipId}>{isSaving ? '创建中…' : '创建约束'}</button></footer>
  </form>;
}
