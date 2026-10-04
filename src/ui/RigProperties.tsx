import { getBoneConnection, samplePose } from '@/core/api';
import type { Bone, Project } from '@/core/types';
import { BonePicker } from './BonePicker';
import { NumberField } from './controls';
import { rigContext } from './rig-edit';
import { runCommand, updateEditor, useEditor } from './store';
import type { CommitOptions } from './store';

/** Edit both setup endpoints in world coordinates using the same shared-joint transaction as canvas drags. */
export function RigCoordinates(props: { bone: Bone }) {
  const state = useEditor(); const world = samplePose(rigContext(state)).bones[props.bone.id];
  const handleEndpoint = (endpoint: 'head' | 'tail', changes: { x?: number; y?: number }, options?: CommitOptions) =>
    runCommand({ type: 'bone.edit', boneId: props.bone.id, endpoint, keepImages: state.keepImages,
      x: changes.x ?? (endpoint === 'head' ? world.x : world.endX), y: changes.y ?? (endpoint === 'head' ? world.y : world.endY) }, options);
  return <><div className="property-grid">
    <NumberField label="起点 X" value={world.x} onChange={(x, options) => handleEndpoint('head', { x }, options)} />
    <NumberField label="起点 Y" value={world.y} onChange={(y, options) => handleEndpoint('head', { y }, options)} />
    <NumberField label="终点 X" value={world.endX} onChange={(x, options) => handleEndpoint('tail', { x }, options)} />
    <NumberField label="终点 Y" value={world.endY} onChange={(y, options) => handleEndpoint('tail', { y }, options)} />
  </div><p className="field-help">世界坐标 · 连接在同一关节的骨骼一起调整。长度 {world.length.toFixed(1)} px · 角度 {world.rotation.toFixed(1)}°</p></>;
}

/** Choose a legal bone parent and an explicit shared joint; reparenting without a connection preserves setup placement. */
export function BoneParent(props: { bone: Bone; project: Project }) {
  const state = useEditor(); const { bone, project } = props;
  const parent = project.bones.find(item => item.id === bone.parentId);
  const constraint = project.ikConstraints.find(item => item.tipBoneId === bone.id);
  const connection = getBoneConnection(bone, parent);
  const handleParent = (parentId: string | null) => runCommand({ type: 'bone.reparent', boneId: bone.id, parentId,
    connection: constraint ? 'tail' : 'none', keepImages: state.keepImages });
  return <><BonePicker project={project} label="父骨骼" value={bone.parentId} excludeBranchId={bone.id}
    requiredParentId={constraint?.rootBoneId} onChange={handleParent} />
    {parent && <button className="full-button" onClick={() => updateEditor({ selection: { kind: 'bone', id: parent.id } })}>查看父骨骼：{parent.name}</button>}
    <label className="field full connection-field"><span>连接关节</span><select aria-label="连接关节" value={connection} disabled={!parent}
      onChange={event => runCommand({ type: 'bone.reparent', boneId: bone.id, parentId: bone.parentId,
        connection: event.target.value as 'head' | 'tail' | 'none', keepImages: state.keepImages })}>
      <option value="none" disabled={!!constraint}>保持独立 · 仅继承父变换</option>
      <option value="head" disabled={!!constraint}>连接到父起点</option><option value="tail">连接到父终点</option>
    </select></label><p className="field-help">{constraint ? 'IK 第二段需连接第一段终点；先移除 IK 才能更换父级。' : '更换父级保持基础位置。选择连接关节会吸附到父端点；此后共同调整。'}</p></>;
}
