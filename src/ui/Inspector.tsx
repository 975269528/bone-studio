import { useState } from 'react';
import { SlidersHorizontal, Link2, Crosshair, Bone as BoneIcon, Image, Pencil } from 'lucide-react';
import type { Attachment, Bone, IKConstraint, Project } from '@/core/types';
import { DeleteButton, NumberField, TextField } from './controls';
import { runCommand, useEditor } from './store';
import { displayedBone, displayedTarget, updateBone, updateIK } from './pose-edit';
import { getIKChains } from './ik-chains';
import { getBoneEditRules } from './bone-edit';

function Section(props: { title: string }) { return <h3 className="property-heading">{props.title}</h3>; }

function BoneProperties(props: { bone: Bone; project: Project }) {
  const { project } = props; const bone = displayedBone(props.bone);
  const state = useEditor();
  const rules = getBoneEditRules(state, bone.id);
  const update = (changes: Partial<Omit<Bone, 'id'>>) => updateBone(props.bone, changes);
  return <><div className="object-kind"><BoneIcon size={16} />骨骼 / BONE</div>
    <TextField label="名称" value={bone.name} onChange={name => update({ name })} />
    <Section title="层级关系" /><label className="field full"><span>父骨骼</span><select value={bone.parentId ?? ''} onChange={event => update({ parentId: event.target.value || null })}>
      <option value="">无 · 根骨骼</option>{project.bones.filter(item => item.id !== bone.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label><Section title="局部变换" /><div className="property-grid">
      <NumberField label="X 位置" disabled={!!rules.positionConstraint} value={bone.x} onChange={x => update({ x })} /><NumberField label="Y 位置" disabled={!!rules.positionConstraint} value={bone.y} onChange={y => update({ y })} />
      <NumberField label="旋转 °" disabled={!!rules.rotationConstraint} value={bone.rotation} onChange={rotation => update({ rotation })} /><NumberField label="长度 px" min={1} value={bone.length} onChange={length => update({ length })} />
    </div><p className="field-help">{rules.help}</p>
    <DeleteButton label="删除骨骼" detail="删除此骨骼及其子骨骼、关联 IK 和骨骼动画轨道。图片部件会保留，并按当前画面位置解除绑定；删除可以撤销。" command={{ type: 'bone.remove', boneId: bone.id, animationId: state.animationId, time: state.time }} /></>;
}

function AttachmentProperties(props: { attachment: Attachment; project: Project }) {
  const { attachment, project } = props;
  const update = (changes: Partial<Omit<Attachment, 'id'>>) => runCommand({ type: 'attachment.update', attachmentId: attachment.id, changes });
  const fields = [{ key: 'x', label: 'X 偏移' }, { key: 'y', label: 'Y 偏移' }, { key: 'rotation', label: '旋转 °' },
    { key: 'zIndex', label: '图层顺序' }, { key: 'scaleX', label: 'X 缩放' }, { key: 'scaleY', label: 'Y 缩放' },
    { key: 'anchorX', label: 'X 锚点', min: 0, max: 1 }, { key: 'anchorY', label: 'Y 锚点', min: 0, max: 1 },
    { key: 'opacity', label: '不透明度', min: 0, max: 1 }] as const;
  return <><div className="object-kind"><Image size={16} />图片部件 / SLOT</div><TextField label="名称" value={attachment.name} onChange={name => update({ name })} />
    <Section title="绑定" /><label className="field full"><span><Link2 size={12} />骨骼</span><select value={attachment.boneId ?? ''} onChange={event => update({ boneId: event.target.value || null })}>
      <option value="">无 · 画布坐标</option>{project.bones.map(bone => <option key={bone.id} value={bone.id}>{bone.name}</option>)}</select></label>
    <label className="field full"><span>图片素材</span><select value={attachment.assetId} onChange={event => update({ assetId: event.target.value })}>
      {project.assets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
    <Section title="变换与外观" /><div className="property-grid">{fields.map(field => <NumberField key={field.key} label={field.label} value={attachment[field.key]}
      min={'min' in field ? field.min : undefined} max={'max' in field ? field.max : undefined} step={field.key.includes('cale') || field.key.includes('nchor') || field.key === 'opacity' ? 0.05 : 1}
      onChange={value => update({ [field.key]: value })} />)}</div>
    <DeleteButton label="删除图片部件" command={{ type: 'attachment.remove', attachmentId: attachment.id }} /></>;
}

function IKProperties(props: { constraint: IKConstraint; project: Project }) {
  const { project } = props; const constraint = { ...props.constraint, ...displayedTarget(props.constraint) };
  const chains = getIKChains({ project, constraint: props.constraint });
  const roots = [...new Map(chains.map(chain => [chain.root.id, chain.root])).values()];
  const update = (changes: Partial<Omit<IKConstraint, 'id'>>) => updateIK(props.constraint, changes);
  return <><div className="object-kind"><Crosshair size={16} />两段 IK / CONSTRAINT</div><TextField label="名称" value={constraint.name} onChange={name => update({ name })} />
    <Section title="骨骼链" /><label className="field full"><span>第一段骨骼</span><select value={constraint.rootBoneId} onChange={event => {
      const rootBoneId = event.target.value; const tip = chains.find(chain => chain.root.id === rootBoneId)?.tip;
      if (tip) update({ rootBoneId, tipBoneId: tip.id });
    }}>{roots.map(bone => <option key={bone.id} value={bone.id}>{bone.name}</option>)}</select></label>
    <label className="field full"><span>第二段骨骼</span><select value={constraint.tipBoneId} onChange={event => update({ tipBoneId: event.target.value })}>
      {chains.filter(chain => chain.root.id === constraint.rootBoneId).map(chain => <option key={chain.tip.id} value={chain.tip.id}>{chain.tip.name}</option>)}</select></label>
    <Section title="目标坐标" /><div className="property-grid"><NumberField label="目标 X" value={constraint.targetX} onChange={targetX => update({ targetX })} />
      <NumberField label="目标 Y" value={constraint.targetY} onChange={targetY => update({ targetY })} /></div>
    <label className="field full"><span>适用动作</span><select value={constraint.animationId ?? ''} onChange={event => update({ animationId: event.target.value || undefined })}>
      <option value="">所有动作与基础姿态</option>{project.animations.map(animation => <option key={animation.id} value={animation.id}>{animation.name}</option>)}</select></label>
    <label className="field full"><span>弯曲方向</span><select value={constraint.bendDirection} onChange={event => update({ bendDirection: Number(event.target.value) as 1 | -1 })}><option value={1}>顺时针</option><option value={-1}>逆时针</option></select></label>
    <label className="toggle"><input type="checkbox" checked={constraint.enabled} onChange={event => update({ enabled: event.target.checked })} />启用约束</label>
    <p className="field-help">拖动画布上的十字目标，两个骨骼会实时跟随。可以记录目标关键帧。</p>
    <DeleteButton label="删除 IK 约束" command={{ type: 'ik.remove', constraintId: constraint.id }} /></>;
}

function ProjectProperties(props: { project: Project }) {
  const { project } = props;
  return <><div className="object-kind"><SlidersHorizontal size={16} />项目 / DOCUMENT</div><TextField label="项目名称" value={project.name} onChange={name => runCommand({ type: 'project.update', changes: { name } })} />
    <Section title="输出画布" /><div className="property-grid"><NumberField label="宽度 px" value={project.width} min={16} max={4096} onChange={width => runCommand({ type: 'project.update', changes: { width } })} />
      <NumberField label="高度 px" value={project.height} min={16} max={4096} onChange={height => runCommand({ type: 'project.update', changes: { height } })} /></div>
    <ProjectScale /><div className="info-card"><strong>让静态角色动起来</strong><p>① 导入已拆分图片部件<br />② 绘制骨骼，绑定部件<br />③ 设置 IK 或记录关键帧<br />④ 预览并导出动作</p></div>
    <Section title="文档统计" /><dl className="document-stats"><dt>图片素材</dt><dd>{project.assets.length}</dd><dt>骨骼</dt><dd>{project.bones.length}</dd><dt>动作</dt><dd>{project.animations.length}</dd><dt>IK 约束</dt><dd>{project.ikConstraints.length}</dd></dl></>;
}

function ProjectScale() {
  const [factor, setFactor] = useState('1');
  const value = Number(factor); const isValid = Number.isFinite(value) && value >= 0.1 && value <= 10;
  return <><Section title="整体角色缩放" /><label className="field full"><span>缩放倍率（1 为原尺寸）</span>
    <input aria-label="整体角色缩放倍率" type="number" min="0.1" max="10" step="0.1" value={factor} onChange={event => setFactor(event.target.value)} /></label>
    <button className="full-button" disabled={!isValid || value === 1} onClick={() => { runCommand({ type: 'project.scale', factor: value }); setFactor('1'); }}>应用整体缩放</button>
    <p className="field-help">以画布中心等比缩放所有骨骼、图片和动画轨迹。画布尺寸不变，可撤销。</p></>;
}

/** Display editable properties for the selected document object. */
export function Inspector() {
  const { project, selection } = useEditor();
  const bone = selection?.kind === 'bone' ? project.bones.find(item => item.id === selection.id) : undefined;
  const attachment = selection?.kind === 'attachment' ? project.attachments.find(item => item.id === selection.id) : undefined;
  const constraint = selection?.kind === 'ik' ? project.ikConstraints.find(item => item.id === selection.id) : undefined;
  const asset = selection?.kind === 'asset' ? project.assets.find(item => item.id === selection.id) : undefined;
  return <aside className="inspector panel"><div className="panel-title"><SlidersHorizontal size={15} /><span>属性</span><button className="icon-button rename-button" aria-label="重命名所选对象" title="重命名所选对象" onClick={() => { const input = document.querySelector<HTMLInputElement>('.property-content [data-name-field]'); input?.focus(); input?.select(); }}><Pencil size={13} /></button><span className="tiny-label">INSPECTOR</span></div><div className="property-content" key={selection ? `${selection.kind}:${selection.id}` : 'project'}>
    {bone ? <BoneProperties bone={bone} project={project} /> : attachment ? <AttachmentProperties attachment={attachment} project={project} /> : constraint ? <IKProperties constraint={constraint} project={project} /> :
      asset ? <><div className="object-kind"><Image size={16} />素材 / ASSET</div><TextField label="素材名称" value={asset.name} onChange={name => runCommand({ type: 'asset.update', assetId: asset.id, changes: { name } })} /><img className="asset-preview checker" src={asset.dataUrl} alt={asset.name} /><p className="muted">{asset.width} × {asset.height} px</p><p className="field-help">在素材卡片上点击 +，添加到画布并绑定当前选中的骨骼。</p></> : <ProjectProperties project={project} />}
  </div></aside>;
}
