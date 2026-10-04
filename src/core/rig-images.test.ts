import { expect, it } from 'vitest';
import { executeCommand } from './commands';
import { snapshotImageFrames } from './rig-images';
import { snapshotBonePoints } from './bone-joints';
import { makeAttachedProject } from './edit-test-fixtures';
import { makeBranchProject, expectBonePoints } from './rig-test-fixtures';
import { applyHistory, createHistory, redoHistory, undoHistory } from './history';

it('骨身平移两个共享节点，其他骨世界端点不产生层级累计漂移', () => {
  const project = makeBranchProject();
  const before = snapshotBonePoints(project.bones);
  const edited = executeCommand({ project, command: { type: 'bone.edit', boneId: 'root', endpoint: 'body', x: 20, y: 35 } });
  const after = snapshotBonePoints(edited.bones);
  expectBonePoints(after.get('root')!, { head: { x: 20, y: 35 }, tail: { x: 100, y: 35 } });
  expectBonePoints(after.get('tip')!, { head: { x: 100, y: 35 }, tail: before.get('tip')!.tail });
  expectBonePoints(after.get('head')!, { head: { x: 20, y: 35 }, tail: before.get('head')!.tail });
  expectBonePoints(after.get('free')!, before.get('free')!);
});

it('默认保全所有绑定图片世界锚点旋转，保持缩放锚点与层级', () => {
  const project = makeAttachedProject();
  const before = snapshotImageFrames(project);
  const edited = executeCommand({ project, command: { type: 'bone.edit', boneId: 'tip', endpoint: 'head', x: 60, y: 50 } });
  snapshotImageFrames(edited).forEach((frame, index) => {
    expect(frame.x).toBeCloseTo(before[index].x, 7);
    expect(frame.y).toBeCloseTo(before[index].y, 7);
    expect(frame.rotation).toBeCloseTo(before[index].rotation, 7);
  });
  expect(edited.attachments[0]).toMatchObject({ scaleX: 2, scaleY: 3, anchorX: 0.5, anchorY: 0.5, zIndex: 2 });
});

it('关闭图片补偿后保留局部图片参数，世界位置随骨架改变', () => {
  const project = makeAttachedProject();
  const edited = executeCommand({ project, command: { type: 'bone.edit', boneId: 'tip', endpoint: 'head', x: 60, y: 50, keepImages: false } });
  expect(edited.attachments).toEqual(project.attachments);
  expect(snapshotImageFrames(edited)[0]).not.toEqual(snapshotImageFrames(project)[0]);
});

it('拒绝骨长小于一像素和非法坐标，失败不改变输入', () => {
  const project = makeAttachedProject();
  const original = structuredClone(project);
  expect(() => executeCommand({ project, command: { type: 'bone.edit', boneId: 'root', endpoint: 'tail', x: 10, y: 20 } })).toThrow('骨长');
  expect(() => executeCommand({ project, command: { type: 'bone.edit', boneId: 'root', endpoint: 'head', x: Infinity, y: 20 } })).toThrow('命令校验');
  expect(project).toEqual(original);
});

it('骨架编辑包含图片补偿与连接标记的事务可以完整撤销和重做', () => {
  const project = makeAttachedProject();
  const history = applyHistory({ history: createHistory(project), commands: [
    { type: 'bone.edit', boneId: 'tip', endpoint: 'head', x: 70, y: 50 },
  ] });
  const restored = undoHistory(history);
  expect(restored.present).toEqual(project);
  expect(redoHistory(restored).present).toEqual(history.present);
});

it('合法一像素远端骨的浮点误差不会阻断无关骨架编辑', () => {
  for (const rotation of [1, 10, 33, 45, 120]) {
    const project = makeBranchProject();
    project.bones.push({ id: 'small', name: '小骨', parentId: null, x: 1000, y: 1000, rotation, length: 1 });
    const edited = executeCommand({ project, command: { type: 'bone.edit', boneId: 'free', endpoint: 'tail', x: 100, y: 60 } });
    expect(edited.bones.at(-1)!.length).toBeGreaterThanOrEqual(1);
    expectBonePoints(snapshotBonePoints(edited.bones).get('small')!, snapshotBonePoints(project.bones).get('small')!);
  }
});
