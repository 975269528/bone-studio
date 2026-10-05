import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { BonePicker } from './BonePicker';
import { planBoneCreation } from './binding-plan';
import { applyCommands, getEditorState, updateEditor } from './store';

/** Create and bind in one undo step, preserving the selected part's displayed pose and appearance. */
export function BoneCreationForm(props: { onClose: () => void; onCreated: () => void }) {
  const initial = useRef(getEditorState()).current; const { project, selection } = initial;
  const attachment = selection?.kind === 'attachment' ? project.attachments.find(item => item.id === selection.id) : undefined;
  const asset = selection?.kind === 'asset' ? project.assets.find(item => item.id === selection.id) : undefined;
  const [name, setName] = useState(attachment || asset ? `${(attachment ?? asset)?.name} 骨骼` : `骨骼 ${project.bones.length + 1}`);
  const [parentId, setParentId] = useState<string | null>(attachment?.boneId ?? (selection?.kind === 'bone' ? selection.id : null));
  const [isBinding, setIsBinding] = useState(!!(attachment || asset));
  const [isSaving, setIsSaving] = useState(false); const [error, setError] = useState('');
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (isSaving || !event.currentTarget.reportValidity() || !name.trim()) return;
    setIsSaving(true); setError('');
    try {
      const state = getEditorState(); const id = crypto.randomUUID();
      const commands = planBoneCreation({ context: state, creation: { id, name: name.trim(), parentId,
        bindImage: isBinding, selection, attachmentId: crypto.randomUUID() } });
      applyCommands(commands, { expectedRevision: initial.revision });
      updateEditor({ selection: { kind: 'bone', id }, isPlaying: false,
        message: isBinding ? '已创建骨骼并绑定图片，保持当前图片姿态。切到动画模式旋转骨骼，图片会跟随。' : '已创建骨骼；可将图片部件拖到此骨骼上绑定。' });
      props.onCreated();
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setIsSaving(false); }
  };
  return <form onSubmit={handleSubmit}>
    <label className="field full"><span>名称 <b>*</b></span><input autoFocus required value={name} onChange={event => setName(event.target.value)} /></label>
    <BonePicker project={project} label="父骨骼" value={parentId} onChange={setParentId} />
    {(attachment || asset) && <label className="toggle"><input type="checkbox" checked={isBinding} onChange={event => setIsBinding(event.target.checked)} />
      {attachment ? `绑定图片部件「${attachment.name}」到新骨骼` : `从素材「${asset?.name}」创建图片部件并绑定`}</label>}
    <p className="field-help">{isBinding ? '新骨骼起点放在图片锚点，创建与绑定一起撤销。已有部件不会复制；素材会新建一个画布部件。'
      : '只创建骨骼。先选中左侧图片部件，再添加骨骼，可同时完成绑定。'} 骨架模式默认保持图片原位；切到动画模式旋转骨骼，图片会跟随。</p>
    {error && <p className="error-copy" role="alert">{error}</p>}
    <footer><button type="button" onClick={props.onClose}>取消</button><button type="submit" className="primary" disabled={isSaving || !name.trim()}>
      {isSaving ? '创建中…' : isBinding ? '创建并绑定' : '创建骨骼'}</button></footer>
  </form>;
}
