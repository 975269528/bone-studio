import { expect, it } from 'vitest';
import { executeCommand } from './commands';
import { getBoneConnection } from './bone-connections';
import { snapshotBonePoints } from './bone-joints';
import { makeBranchProject, expectBonePoints } from './rig-test-fixtures';
import { addAnimatedIK } from './edit-test-fixtures';
import { parseProject } from './validation';

it('旧版项目读取不写连接标记，基础头尾连接自动推断', () => {
  const project = makeBranchProject();
  const parsed = parseProject(JSON.parse(JSON.stringify(project)));
  expect(parsed.bones[1].connection).toBeUndefined();
  expect(getBoneConnection(parsed.bones[1], parsed.bones[0])).toBe('tail');
  expect(getBoneConnection({ ...parsed.bones[1], x: 0 }, parsed.bones[0])).toBe('head');
  expect(getBoneConnection(parsed.bones[4], parsed.bones[0])).toBe('none');
});

it('拖动共享肘关节同时改多分支头和父骨尾，其他端点与脱开骨固定', () => {
  const project = makeBranchProject();
  const before = snapshotBonePoints(project.bones);
  const edited = executeCommand({ project, command: { type: 'bone.edit', boneId: 'tip', endpoint: 'head', x: 70, y: 50 } });
  const after = snapshotBonePoints(edited.bones);
  expect(after.get('root')!.tail).toEqual({ x: 70, y: 50 });
  expect(after.get('branch')!.head).toEqual({ x: 70, y: 50 });
  for (const id of ['tip', 'branch']) expectBonePoints(after.get(id)!, { head: { x: 70, y: 50 }, tail: before.get(id)!.tail });
  for (const id of ['head', 'free']) expectBonePoints(after.get(id)!, before.get(id)!);
  expect(edited.animations).toEqual(project.animations);
});

it('根骨头共享分支联动，独立骨尾编辑不带动父骨或同级', () => {
  const project = makeBranchProject();
  const before = snapshotBonePoints(project.bones);
  const edited = executeCommand({ project, command: { type: 'bone.edit', boneId: 'root', endpoint: 'head', x: 30, y: 10 } });
  const after = snapshotBonePoints(edited.bones);
  expectBonePoints(after.get('root')!, { head: { x: 30, y: 10 }, tail: before.get('root')!.tail });
  expectBonePoints(after.get('head')!, { head: { x: 30, y: 10 }, tail: before.get('head')!.tail });
  const tailEdit = executeCommand({ project, command: { type: 'bone.edit', boneId: 'tip', endpoint: 'tail', x: 150, y: 70 } });
  expectBonePoints(snapshotBonePoints(tailEdit.bones).get('root')!, before.get('root')!);
  const freeEdit = executeCommand({ project, command: { type: 'bone.edit', boneId: 'free', endpoint: 'head', x: 80, y: 35 } });
  expectBonePoints(snapshotBonePoints(freeEdit.bones).get('root')!, before.get('root')!);
  expectBonePoints(snapshotBonePoints(freeEdit.bones).get('tip')!, before.get('tip')!);
});

it('IK 肘部基础编辑同步适用 tip 关键帧但保留其他 FK 动画', () => {
  const project = makeBranchProject();
  addAnimatedIK(project);
  project.animations.push({ ...structuredClone(project.animations[0]), id: 'other' });
  const edited = executeCommand({ project, command: { type: 'bone.edit', boneId: 'tip', endpoint: 'head', x: 70, y: 50 } });
  expect(edited.bones[0].length).toBeCloseTo(Math.hypot(60, 30));
  expect(edited.bones[1].length).toBeCloseTo(Math.hypot(80, -30));
  expect(edited.animations[0].tracks[1].keyframes[0]).toEqual({ time: 1, x: edited.bones[0].length, y: 0, rotation: 30 });
  expect(edited.animations[1]).toEqual(project.animations[1]);
  expect(edited.ikConstraints).toEqual(project.ikConstraints);
});
