import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from './controls';
import { applyCommands, getEditorState, reportError, updateEditor } from './store';
import { getIKChains } from './ik-chains';

/** Create a bone or a validated two-bone IK chain from explicit relationship selectors. */
export function AddObject(props: { kind: 'bone' | 'ik'; onClose: () => void }) {
  const state = getEditorState(); const project = state.project;
  const [name, setName] = useState(props.kind === 'bone' ? `骨骼 ${project.bones.length + 1}` : `IK ${project.ikConstraints.length + 1}`);
  const [parentId, setParentId] = useState(state.selection?.kind === 'bone' ? state.selection.id : '');
  const chains = getIKChains({ project, animationId: state.animationId });
  const initialChain = chains.find(chain => chain.root.id === state.selection?.id || chain.tip.id === state.selection?.id) ?? chains[0];
  const roots = [...new Map(chains.map(chain => [chain.root.id, chain.root])).values()];
  const [rootId, setRootId] = useState(initialChain?.root.id ?? '');
  const children = chains.filter(chain => chain.root.id === rootId).map(chain => chain.tip);
  const [tipId, setTipId] = useState(initialChain?.tip.id ?? '');
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!event.currentTarget.reportValidity()) return;
    try {
      const id = crypto.randomUUID();
      if (props.kind === 'bone') {
        const parent = project.bones.find(bone => bone.id === parentId);
        applyCommands([{ type: 'bone.add', bone: { id, name: name.trim(), parentId: parent?.id ?? null,
          x: parent?.length ?? project.width / 2, y: parent ? 0 : project.height / 2, rotation: 0, length: 80 } }]);
      } else applyCommands([{ type: 'ik.add', constraint: { id, name: name.trim(), rootBoneId: rootId, tipBoneId: tipId,
        targetX: project.width / 2 + 120, targetY: project.height / 2 - 100, bendDirection: 1, enabled: true,
        targetKeys: [], ...(state.animationId ? { animationId: state.animationId } : {}) } }]);
      updateEditor({ selection: { kind: props.kind, id } }); props.onClose();
    } catch (error) { reportError(error); }
  };
  return <Modal title={props.kind === 'bone' ? '添加骨骼' : '添加两段 IK'} onClose={props.onClose}><form onSubmit={handleSubmit}>
    <label className="field full"><span>名称 <b>*</b></span><input autoFocus required value={name} onChange={event => setName(event.target.value)} /></label>
    {props.kind === 'bone' ? <label className="field full"><span>父骨骼</span><select value={parentId} onChange={event => setParentId(event.target.value)}><option value="">无 · 新建根骨骼</option>{project.bones.map(bone => <option key={bone.id} value={bone.id}>{bone.name}</option>)}</select></label> : <>
      <label className="field full"><span>第一段骨骼 <b>*</b></span><select required value={rootId} onChange={event => { setRootId(event.target.value); setTipId(chains.find(chain => chain.root.id === event.target.value)?.tip.id ?? ''); }}>
        {!roots.length && <option value="">无可用连续骨链</option>}{roots.map(bone => <option key={bone.id} value={bone.id}>{bone.name}</option>)}</select></label>
      <label className="field full"><span>第二段骨骼 <b>*</b></span><select required value={tipId} onChange={event => setTipId(event.target.value)}>{!children.length && <option value="">无可用子骨骼</option>}{children.map(bone => <option key={bone.id} value={bone.id}>{bone.name}</option>)}</select></label><p className="field-help">{chains.length ? '仅显示首尾连接、动画位置一致且未被其他适用 IK 占用的骨骼链。目标可在画布上拖动。' : '没有可用的两段连续骨链。请先让子骨骼 X 等于父骨骼长度、Y 为 0，并避免与已有 IK 约束共用骨骼。'}</p></>}
    <footer><button type="button" onClick={props.onClose}>取消</button><button type="submit" className="primary" disabled={!name.trim() || (props.kind === 'ik' && !tipId)}>创建{props.kind === 'bone' ? '骨骼' : '约束'}</button></footer>
  </form></Modal>;
}
