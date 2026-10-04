import { expect, it } from 'vitest';
import { executeCommand } from './commands';
import { addAnimatedIK, makeAttachedProject } from './edit-test-fixtures';
import { applyHistory, createHistory, redoHistory, undoHistory } from './history';
import { samplePose } from './pose';

it('删除子骨保留图片的基础姿态、缩放、锚点和显示属性', () => {
  const project = makeAttachedProject();
  project.animations[0].tracks = [{ boneId: 'root', interpolation: 'linear',
    keyframes: [{ time: 0, x: 500, y: 500, rotation: 90 }] }];
  const updated = executeCommand({ project, command: { type: 'bone.remove', boneId: 'tip' } });
  expect(updated.bones.map((bone) => bone.id)).toEqual(['root']);
  expect(updated.attachments[0]).toEqual({ ...project.attachments[0], boneId: null, x: 102, y: 25 });
  expect(updated.attachments[1]).toEqual(project.attachments[1]);
  expect(updated.assets).toEqual(project.assets);
  expect(project.attachments[0].boneId).toBe('tip');
});

it('删除骨骼以当前动画和 IK 姿态烘焙图片，撤销恢复全部绑定和轨道', () => {
  const project = makeAttachedProject();
  addAnimatedIK(project);
  const pose = samplePose({ project, animationId: 'walk', time: 1 });
  const bone = pose.bones.tip;
  const angle = bone.rotation * Math.PI / 180;
  const history = createHistory(project);
  const changed = applyHistory({ history, commands: [{ type: 'bone.remove', boneId: 'root', animationId: 'walk', time: 1 }] });
  const detached = changed.present.attachments[0];
  expect(detached.x).toBeCloseTo(bone.x + 12 * Math.cos(angle) - 5 * Math.sin(angle));
  expect(detached.y).toBeCloseTo(bone.y + 12 * Math.sin(angle) + 5 * Math.cos(angle));
  expect(detached.rotation).toBeCloseTo(bone.rotation + 15);
  expect(detached.scaleX).toBe(2);
  expect(detached.scaleY).toBe(3);
  expect(changed.present.bones).toEqual([]);
  expect(changed.present.animations[0].tracks).toEqual([]);
  expect(changed.present.ikConstraints).toEqual([]);
  expect(undoHistory(changed).present).toEqual(project);
  expect(redoHistory(undoHistory(changed)).present).toEqual(changed.present);
});

it('删除时拒绝不存在的动画和非法时间，保留原始项目', () => {
  const project = makeAttachedProject();
  const original = structuredClone(project);
  expect(() => executeCommand({ project, command: { type: 'bone.remove', boneId: 'root', animationId: 'missing' } })).toThrow('动画不存在');
  expect(() => executeCommand({ project, command: { type: 'bone.remove', boneId: 'root', time: -1 } })).toThrow('命令校验');
  expect(project).toEqual(original);
});

it('素材可以独立命名且共享严格名称校验，图片内容和实例名称保留', () => {
  const project = makeAttachedProject();
  const updated = executeCommand({ project, command: { type: 'asset.update', assetId: 'image', changes: { name: '新的素材名称' } } });
  expect(updated.assets[0]).toEqual({ ...project.assets[0], name: '新的素材名称' });
  expect(updated.attachments).toEqual(project.attachments);
  expect(() => executeCommand({ project, command: { type: 'asset.update', assetId: 'image', changes: { name: '' } } })).toThrow('命令校验');
  expect(() => executeCommand({ project, command: { type: 'asset.update', assetId: 'image', changes: { dataUrl: 'invalid' } } })).toThrow('命令校验');
  expect(() => executeCommand({ project, command: { type: 'asset.update', assetId: 'missing', changes: { name: '名称' } } })).toThrow('操作对象不存在');
});

it('只删除 IK 下骨也保全存活根骨图片的当前姿态，仅烘焙当前动作', () => {
  const project = makeAttachedProject();
  addAnimatedIK(project);
  project.attachments[0].boneId = 'root';
  project.animations.push({ ...project.animations[0], id: 'other', name: '其他动作', tracks: [{
    boneId: 'root', interpolation: 'linear', keyframes: [{ time: 1, x: 50, y: 60, rotation: 120 }],
  }] });
  const before = samplePose({ project, animationId: 'walk', time: 1 });
  const updated = executeCommand({ project, command: { type: 'bone.remove', boneId: 'tip', animationId: 'walk', time: 1 } });
  const after = samplePose({ project: updated, animationId: 'walk', time: 1 });
  expect(after.bones.root.x).toBeCloseTo(before.bones.root.x);
  expect(after.bones.root.y).toBeCloseTo(before.bones.root.y);
  expect(after.bones.root.rotation).toBeCloseTo(before.bones.root.rotation);
  expect(updated.attachments[0]).toEqual(project.attachments[0]);
  expect(updated.animations[1]).toEqual(project.animations[1]);
  expect(updated.bones[0]).toEqual(project.bones[0]);
  delete project.ikConstraints[0].animationId;
  const baseBefore = samplePose({ project, time: 0 });
  const baseUpdated = executeCommand({ project, command: { type: 'bone.remove', boneId: 'tip' } });
  expect(samplePose({ project: baseUpdated, time: 0 }).bones.root.rotation).toBeCloseTo(baseBefore.bones.root.rotation);
  expect(baseUpdated.attachments[0]).toEqual(project.attachments[0]);
});
