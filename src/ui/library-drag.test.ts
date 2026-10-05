import { describe, expect, it } from 'vitest';
import { createDemoProject, executeCommands, samplePose } from '@/core/api';
import { planLibraryDrop } from './library-drag';

describe('library tree drops', () => {
  it('changes a bone parent in place and explicitly detaches the shared connection', () => {
    const project = createDemoProject(); const context = { project, animationId: null, time: 0 };
    const before = samplePose({ ...context, project: { ...project, ikConstraints: [] } }).bones['arm-left'];
    const commands = planLibraryDrop({ context, item: { kind: 'bone', id: 'arm-left' }, boneId: 'head' });
    const next = executeCommands({ project, commands });
    const after = samplePose({ ...context, project: { ...next, ikConstraints: [] } }).bones['arm-left'];
    expect(after.x).toBeCloseTo(before.x); expect(after.y).toBeCloseTo(before.y); expect(after.rotation).toBeCloseTo(before.rotation);
    expect(next.bones.find(bone => bone.id === 'arm-left')?.connection).toBe('none');
  });

  it('rejects self, descendant and IK lower-bone parent changes without modifying the document', () => {
    const project = createDemoProject(); const context = { project, animationId: null, time: 0 }; const original = structuredClone(project);
    for (const boneId of ['root', 'head']) expect(() => planLibraryDrop({ context, item: { kind: 'bone', id: 'root' }, boneId })).toThrow('自身');
    expect(() => planLibraryDrop({ context, item: { kind: 'bone', id: project.ikConstraints[0].tipBoneId }, boneId: null })).toThrow('IK 第二段');
    expect(project).toEqual(original);
  });

  it('adds a reusable asset instance at the target bone and handles root-level image unbinding', () => {
    const project = createDemoProject(); const context = { project, animationId: null, time: 0 };
    const next = executeCommands({ project, commands: planLibraryDrop({ context, item: { kind: 'asset', id: project.assets[0].id }, boneId: 'head' }) });
    const added = next.attachments.at(-1)!; expect(added).toMatchObject({ boneId: 'head', x: 0, y: 0 });
    const detached = executeCommands({ project: next, commands: planLibraryDrop({ context: { ...context, project: next }, item: { kind: 'attachment', id: added.id }, boneId: null }) });
    expect(detached.attachments.at(-1)?.boneId).toBeNull();
  });
});
