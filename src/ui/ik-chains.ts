import { validateProject } from '@/core/api';
import type { Bone, IKConstraint, Project } from '@/core/types';

interface IKChain { root: Bone; tip: Bone }
interface ChainOptions { project: Project; animationId?: string | null; constraint?: IKConstraint }
const CONNECTION_TOLERANCE = 0.0001;

/** Return connected IK chains that satisfy the document's overlap and animation rules. */
export function getIKChains(options: ChainOptions): IKChain[] {
  const { project } = options;
  const candidate = options.constraint ?? { id: `candidate-${crypto.randomUUID()}`, name: '候选骨链',
    rootBoneId: '', tipBoneId: '', targetX: 0, targetY: 0, bendDirection: 1 as const,
    enabled: true, targetKeys: [], ...(options.animationId ? { animationId: options.animationId } : {}) };
  const constraints = project.ikConstraints.filter(constraint => constraint.id !== candidate.id);
  return project.bones.flatMap(root => project.bones.filter(tip => tip.parentId === root.id
    && Math.abs(tip.x - root.length) <= CONNECTION_TOLERANCE && Math.abs(tip.y) <= CONNECTION_TOLERANCE)
    .map(tip => ({ root, tip }))).filter(chain => validateProject({ ...project,
      ikConstraints: [...constraints, { ...candidate, rootBoneId: chain.root.id, tipBoneId: chain.tip.id }] }).valid);
}
