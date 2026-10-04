import { expect, it } from 'vitest';
import { executeCommand, executeCommands } from './commands';
import { applyHistory, createHistory, redoHistory, undoHistory } from './history';
import { makeTestProject } from './test-fixtures';

it('拒绝未知字段、非有限数值与不支持的动作', () => {
  const project = makeTestProject();
  expect(() => executeCommand({ project, command: { type: 'bone.update', boneId: 'root', changes: { x: Number.NaN } } })).toThrow('命令校验');
  expect(() => executeCommand({ project, command: { type: 'bone.update', boneId: 'root', changes: { surprise: true } } })).toThrow('命令校验');
  expect(() => executeCommand({ project, command: { type: 'script.run', script: 'alert(1)' } })).toThrow('命令校验');
});

it('非法批次即使已有合法编辑，也不会污染输入项目', () => {
  const project = makeTestProject();
  const original = JSON.stringify(project);
  expect(() => executeCommands({ project, commands: [
    { type: 'bone.update', boneId: 'root', changes: { name: '已改变' } },
    { type: 'bone.update', boneId: 'root', changes: { parentId: 'tip' } },
  ] })).toThrow('循环');
  expect(JSON.stringify(project)).toBe(original);
  expect(() => executeCommand({ project, command: { type: 'bone.update', boneId: 'root', changes: { parentId: 'missing' } } })).toThrow('不存在');
});

it('同批修改 IK 骨长和下骨连接点，仅校验最终状态', () => {
  const project = makeTestProject();
  project.ikConstraints = [{ id: 'ik', name: 'IK', rootBoneId: 'root', tipBoneId: 'tip',
    targetX: 100, targetY: 80, bendDirection: 1, enabled: true, targetKeys: [] }];
  expect(() => executeCommand({ project, command: { type: 'bone.update', boneId: 'root', changes: { length: 100 } } })).toThrow('相接');
  const updated = executeCommands({ project, commands: [
    { type: 'bone.update', boneId: 'root', changes: { length: 100 } },
    { type: 'bone.update', boneId: 'tip', changes: { x: 100 } },
  ] });
  expect(updated.bones[0].length).toBe(100);
  expect(updated.bones[1].x).toBe(100);
  expect(project.bones[0].length).toBe(80);
});

it('删除骨骼级联清理子骨、部件、关键帧和 IK', () => {
  const project = makeTestProject();
  project.assets = [{ id: 'image', name: '图', width: 1, height: 1, dataUrl: 'data:image/png;base64,AA==' }];
  project.attachments = [{ id: 'part', name: '手', assetId: 'image', boneId: 'tip', x: 0, y: 0,
    rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0, anchorY: 0, opacity: 1, zIndex: 0 }];
  project.animations[0].tracks = [{ boneId: 'tip', interpolation: 'linear', keyframes: [{ time: 0, x: 80, y: 0, rotation: 0 }] }];
  project.ikConstraints = [{ id: 'ik', name: '手', rootBoneId: 'root', tipBoneId: 'tip', targetX: 100,
    targetY: 20, bendDirection: 1, enabled: true, targetKeys: [] }];
  const updated = executeCommand({ project, command: { type: 'bone.remove', boneId: 'root' } });
  expect(updated.bones).toEqual([]);
  expect(updated.attachments).toEqual([]);
  expect(updated.animations[0].tracks).toEqual([]);
  expect(updated.ikConstraints).toEqual([]);
  expect(updated.assets).toHaveLength(1);
});

it('一个事务一次撤销，重做恢复，新增编辑清空重做', () => {
  const history = createHistory(makeTestProject());
  const changed = applyHistory({ history, commands: [
    { type: 'bone.update', boneId: 'root', changes: { x: 30 } },
    { type: 'bone.update', boneId: 'tip', changes: { rotation: 45 } },
  ] });
  const undone = undoHistory(changed);
  expect(undone.present).toEqual(history.present);
  expect(redoHistory(undone).present).toEqual(changed.present);
  const branch = applyHistory({ history: undone, commands: [{ type: 'project.update', changes: { name: '新分支' } }] });
  expect(branch.future).toEqual([]);
});
