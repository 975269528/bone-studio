import { expect, it } from 'vitest';
import { executeCommand, executeCommands } from './commands';
import { addAnimatedIK, makeAttachedProject } from './edit-test-fixtures';
import { applyHistory, createHistory, undoHistory } from './history';
import { samplePose } from './pose';
import { parseProject } from './validation';

it('整体缩放保持动画 IK 连贯且部件只等比缩放一次', () => {
  const project = makeAttachedProject();
  addAnimatedIK(project);
  const before = samplePose({ project, animationId: 'walk', time: 1 });
  const updated = executeCommand({ project, command: { type: 'project.scale', factor: 2, pivotX: 10, pivotY: 20 } });
  const after = samplePose({ project: updated, animationId: 'walk', time: 1 });
  for (const id of ['root', 'tip']) {
    expect(after.bones[id].x).toBeCloseTo(10 + (before.bones[id].x - 10) * 2);
    expect(after.bones[id].y).toBeCloseTo(20 + (before.bones[id].y - 20) * 2);
    expect(after.bones[id].rotation).toBeCloseTo(before.bones[id].rotation);
  }
  expect(updated.bones[1].x).toBe(updated.bones[0].length);
  expect(updated.animations[0].tracks[1].keyframes[0].x).toBe(updated.bones[0].length);
  expect(updated.attachments[0]).toEqual({ ...project.attachments[0], x: 24, y: 10, scaleX: 4, scaleY: 6 });
  expect(updated.attachments[1]).toEqual({ ...project.attachments[1], x: 390, y: 180, scaleX: 2, scaleY: 2 });
  expect(updated.ikConstraints[0].targetKeys[0]).toEqual({ time: 1, x: 210, y: 160 });
  expect(updated.assets).toEqual(project.assets);
  expect([updated.width, updated.height]).toEqual([project.width, project.height]);
});

it('旧版项目无需迁移即可围绕默认画布中心缩放，撤销恢复所有数据', () => {
  const project = parseProject(JSON.parse(JSON.stringify(makeAttachedProject())));
  const history = createHistory(project);
  const changed = applyHistory({ history, commands: [{ type: 'project.scale', factor: 0.5 }] });
  expect(changed.present.version).toBe(1);
  expect(changed.present.bones[0].x).toBe(project.width / 2 + (10 - project.width / 2) * 0.5);
  expect(changed.present.bones[0].y).toBe(project.height / 2 + (20 - project.height / 2) * 0.5);
  expect(changed.present.bones[1].x).toBe(40);
  expect(undoHistory(changed).present).toEqual(project);
});

it('非法缩放系数和轴心被拒绝，后续越界使完整批次原子失败', () => {
  const project = makeAttachedProject();
  const original = structuredClone(project);
  for (const factor of [0, -1, 0.09, 10.01, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => executeCommand({ project, command: { type: 'project.scale', factor } })).toThrow('命令校验');
  }
  expect(() => executeCommand({ project, command: { type: 'project.scale', factor: 2, pivotX: Number.NaN } })).toThrow('命令校验');
  expect(() => executeCommands({ project, commands: [
    { type: 'asset.update', assetId: 'image', changes: { name: '不能留下' } },
    { type: 'project.scale', factor: 10 }, { type: 'project.scale', factor: 10 },
  ] })).toThrow('项目校验');
  expect(project).toEqual(original);
});
