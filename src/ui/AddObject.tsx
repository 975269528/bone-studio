import { Modal } from './controls';
import { BoneCreationForm } from './BoneCreationForm';
import { IKCreationForm } from './IKCreationForm';

/** Create a bone with an explicit image binding, or a validated continuous two-bone IK chain. */
export function AddObject(props: { kind: 'bone' | 'ik'; onClose: () => void; onCreated?: () => void }) {
  const handleCreated = () => { props.onCreated?.(); props.onClose(); };
  return <Modal title={props.kind === 'bone' ? '添加骨骼' : '添加两段 IK'} onClose={props.onClose}>
    {props.kind === 'bone' ? <BoneCreationForm onClose={props.onClose} onCreated={handleCreated} /> : <IKCreationForm onClose={props.onClose} onCreated={handleCreated} />}
  </Modal>;
}
