import { expect, it } from 'vitest';
import { executeCommand } from './commands';
import { snapshotBonePoints } from './bone-joints';
import { applyHistory, createHistory, redoHistory, undoHistory } from './history';
import { makeBranchProject, expectBonePoints, expectRigPoints } from './rig-test-fixtures';
import { makeAttachedProject, addAnimatedIK } from './edit-test-fixtures';
import { parseProject } from './validation';
import { snapshotImageFrames } from './rig-images';

it('保姿态换父与解绑保全全部基础世界端点和图片', () => {
  const project = makeAttachedProject();
  const before = snapshotBonePoints(project.bones);
  const edited = executeCommand({ project, command: { type: 'bone.reparent', boneId: 'tip', parentId: null } });
  expectRigPoints(edited, before);
  expect(edited.bones[1]).toMatchObject({ parentId: null, connection: 'none' });
  expect(snapshotImageFrames(edited)).toEqual(snapshotImageFrames(project));
  const reparented = executeCommand({ project: edited, command: { type: 'bone.reparent', boneId: 'tip', parentId: 'root' } });
  expectRigPoints(reparented, before);
  expect(reparented.bones[1].connection).toBe('none');
});

it('连接父头或父尾吸附并保持被换父骨长方向，原父共享点不被拖动', () => {
  const project = makeBranchProject();
  const before = snapshotBonePoints(project.bones);
  const edited = executeCommand({ project, command: { type: 'bone.reparent', boneId: 'tip', parentId: 'head', connection: 'tail' } });
  const after = snapshotBonePoints(edited.bones);
  expectBonePoints(after.get('tip')!, { head: { x: 10, y: -10 }, tail: { x: 70, y: -10 } });
  expect(edited.bones[1]).toMatchObject({ parentId: 'head', connection: 'tail', x: 30, y: 0, length: 60 });
  for (const id of ['root', 'head', 'branch', 'free']) expectBonePoints(after.get(id)!, before.get(id)!);
  const atHead = executeCommand({ project, command: { type: 'bone.reparent', boneId: 'tip', parentId: 'head', connection: 'head' } });
  expectBonePoints(snapshotBonePoints(atHead.bones).get('tip')!, { head: { x: 10, y: 20 }, tail: { x: 70, y: 20 } });
});

it('换父连接移动其共享子关节但固定子骨远端，事务可撤销重做和 JSON 保存', () => {
  const project = makeBranchProject();
  project.bones.push({ id: 'child', name: '子骨', parentId: 'tip', connection: 'tail', x: 60, y: 0, rotation: 0, length: 20 });
  const before = snapshotBonePoints(project.bones);
  const changed = applyHistory({ history: createHistory(project), commands: [
    { type: 'bone.reparent', boneId: 'tip', parentId: 'head', connection: 'tail' },
  ] });
  expectBonePoints(snapshotBonePoints(changed.present.bones).get('child')!, {
    head: { x: 70, y: -10 }, tail: before.get('child')!.tail,
  });
  expect(parseProject(JSON.parse(JSON.stringify(changed.present)))).toEqual(changed.present);
  expect(undoHistory(changed).present).toEqual(project);
  expect(redoHistory(undoHistory(changed)).present).toEqual(changed.present);
});

it('禁止自身、后代、悬空父和断开 IK tip，失败保全项目', () => {
  const project = makeAttachedProject();
  addAnimatedIK(project);
  const original = structuredClone(project);
  for (const parentId of ['root', 'tip', 'missing']) {
    expect(() => executeCommand({ project, command: { type: 'bone.reparent', boneId: 'root', parentId } })).toThrow();
  }
  expect(() => executeCommand({ project, command: { type: 'bone.reparent', boneId: 'tip', parentId: 'root', connection: 'none' } })).toThrow('相接');
  expect(() => executeCommand({ project, command: { type: 'bone.reparent', boneId: 'root', parentId: null, connection: 'tail' } })).toThrow('根骨骼');
  expect(project).toEqual(original);
});
