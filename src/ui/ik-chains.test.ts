import { describe, expect, it } from 'vitest';
import { createDemoProject, executeCommand } from '@/core/api';
import { getIKChains } from './ik-chains';

describe('IK chain selectors', () => {
  it('excludes a parent-child pair whose joints are disconnected', () => {
    const project = createDemoProject();
    const chains = getIKChains({ project, animationId: project.animations[0].id });
    expect(chains.some(chain => chain.root.id === 'root' && chain.tip.id === 'torso')).toBe(false);
  });

  it('excludes chains overlapping an existing constraint in the same animation', () => {
    const project = createDemoProject();
    const chains = getIKChains({ project, animationId: project.animations[0].id });
    expect(chains.some(chain => [chain.root.id, chain.tip.id].includes('arm-right'))).toBe(false);
    expect(chains.some(chain => chain.root.id === 'arm-left')).toBe(true);
  });

  it('makes the first offered chain immediately creatable', () => {
    const project = createDemoProject();
    const chain = getIKChains({ project, animationId: project.animations[0].id })[0];
    const command = { type: 'ik.add', constraint: { id: 'new-ik', name: '新约束', rootBoneId: chain.root.id,
      tipBoneId: chain.tip.id, targetX: 376, targetY: 156, bendDirection: 1, enabled: true,
      targetKeys: [], animationId: project.animations[0].id } };
    const result = executeCommand({ project, command });
    expect(result.ikConstraints).toHaveLength(project.ikConstraints.length + 1);
  });

  it('keeps an existing constraint’s own chain available when editing it', () => {
    const project = createDemoProject(); const constraint = project.ikConstraints[0];
    const chains = getIKChains({ project, constraint });
    expect(chains.some(chain => chain.root.id === constraint.rootBoneId && chain.tip.id === constraint.tipBoneId)).toBe(true);
  });
});
