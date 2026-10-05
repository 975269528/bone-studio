import { expect, it } from 'vitest';
import { createDemoProject, executeCommands } from '@/core/api';
import { attachmentWorld } from './attachment-edit';
import { planAttachmentBinding, planBoneCreation } from './binding-plan';
import { applyCommands, getEditorState, replaceProject, undo } from './store';

function expectSameWorld(before: { x: number; y: number; rotation: number }, after: { x: number; y: number; rotation: number }): void {
  expect(after.x).toBeCloseTo(before.x); expect(after.y).toBeCloseTo(before.y);
  expect(Math.cos(after.rotation * Math.PI / 180)).toBeCloseTo(Math.cos(before.rotation * Math.PI / 180));
  expect(Math.sin(after.rotation * Math.PI / 180)).toBeCloseTo(Math.sin(before.rotation * Math.PI / 180));
}

it('creates and binds an existing part in place, then rotates it with its new bone', () => {
  const project = createDemoProject(); const image = project.attachments[0];
  const context = { project, animationId: project.animations[0].id, time: 0.6 };
  const world = attachmentWorld(context, image);
  const commands = planBoneCreation({ context, creation: { id: 'new-bone', name: '新骨', parentId: 'torso',
    bindImage: true, selection: { kind: 'attachment', id: image.id }, attachmentId: 'unused' } });
  const next = executeCommands({ project, commands }); const bound = next.attachments[0];
  expect(next.attachments).toHaveLength(project.attachments.length); expect(bound.boneId).toBe('new-bone');
  expectSameWorld(world, attachmentWorld({ ...context, project: next }, bound));
  expect({ ...bound, boneId: image.boneId, x: image.x, y: image.y, rotation: image.rotation }).toEqual(image);
  const rotated = executeCommands({ project: next, commands: [{ type: 'bone.update', boneId: 'new-bone', changes: { rotation: 30 } }] });
  const delta = 30 - next.bones.find(bone => bone.id === 'new-bone')!.rotation;
  const moved = attachmentWorld({ ...context, project: rotated }, rotated.attachments[0]);
  expectSameWorld({ ...world, rotation: world.rotation + delta }, moved);
});

it('rebinds and unbinds sampled images without a visual jump or appearance changes', () => {
  const project = createDemoProject(); const image = project.attachments.find(item => item.boneId === 'arm-left')!;
  const context = { project, animationId: project.animations[0].id, time: 0.75 };
  const before = attachmentWorld(context, image);
  const rebound = executeCommands({ project, commands: planAttachmentBinding({ context, attachmentId: image.id, boneId: 'head' }) });
  const bound = rebound.attachments.find(item => item.id === image.id)!;
  expectSameWorld(before, attachmentWorld({ ...context, project: rebound }, bound));
  const detached = executeCommands({ project: rebound, commands: planAttachmentBinding({ context: { ...context, project: rebound }, attachmentId: image.id, boneId: null }) });
  expectSameWorld(before, detached.attachments.find(item => item.id === image.id)!);
  expect(bound.scaleX).toBe(image.scaleX); expect(bound.zIndex).toBe(image.zIndex); expect(bound.anchorX).toBe(image.anchorX);
});

it('creates an asset instance and binding together, and one undo restores both', () => {
  const project = createDemoProject(); replaceProject(project); const before = getEditorState();
  const asset = project.assets[0];
  applyCommands(planBoneCreation({ context: before, creation: { id: 'asset-bone', name: '素材骨', parentId: null,
    bindImage: true, selection: { kind: 'asset', id: asset.id }, attachmentId: 'new-part' } }));
  const next = getEditorState(); expect(next.past).toHaveLength(1);
  expect(next.project.attachments.find(item => item.id === 'new-part')?.boneId).toBe('asset-bone');
  undo(); expect(getEditorState().project).toEqual(before.project);
});

it('uses the visible setup pose for auxiliary tools and rejects a deleted selected part', () => {
  const project = createDemoProject(); const image = project.attachments[0];
  const context = { project, animationId: null, time: 0, tool: 'pan' as const };
  const commands = planAttachmentBinding({ context, attachmentId: image.id, boneId: null });
  const setup = { ...context, project: { ...project, ikConstraints: [] } };
  const next = executeCommands({ project, commands });
  expectSameWorld(attachmentWorld(setup, image), next.attachments[0]);
  expect(() => planBoneCreation({ context, creation: { id: 'new', name: '新', parentId: null,
    bindImage: true, selection: { kind: 'attachment', id: 'missing' }, attachmentId: 'unused' } })).toThrow('已不存在');
});
