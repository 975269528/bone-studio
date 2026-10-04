import { expect, it } from 'vitest';
import { executeCommand } from './commands';
import { makeAttachedProject } from './edit-test-fixtures';
import { snapshotImageFrames } from './rig-images';

it('编辑无关骨骼时保留合法高圈数，图片补偿不会越过角度上限', () => {
  const project = makeAttachedProject();
  project.bones[0].rotation = 360000;
  project.bones[1].rotation = 360000;
  project.bones.push({ id: 'other', name: '其他骨', parentId: null, x: 300, y: 200, rotation: 0, length: 50 });
  const edited = executeCommand({ project, command: { type: 'bone.edit', boneId: 'other', endpoint: 'tail', x: 360, y: 200 } });
  expect(edited.bones[0].rotation).toBeCloseTo(project.bones[0].rotation, 7);
  expect(edited.bones[1].rotation).toBeCloseTo(project.bones[1].rotation, 7);
  expect(edited.attachments[0].rotation).toBeCloseTo(project.attachments[0].rotation, 7);
});

it('上下限附近旋转用合法等价角度保全图片世界姿态', () => {
  for (const direction of [-1, 1]) {
    const project = makeAttachedProject();
    project.bones[0].rotation = direction * 360000;
    project.attachments[0].rotation = direction * 360000;
    const before = snapshotImageFrames(project)[0];
    const edited = executeCommand({ project, command: {
      type: 'bone.edit', boneId: 'root', endpoint: 'head', x: 10, y: 20 - direction,
    } });
    const after = snapshotImageFrames(edited)[0];
    expect(Math.abs(edited.bones[0].rotation)).toBeLessThanOrEqual(360000);
    expect(Math.abs(edited.attachments[0].rotation)).toBeLessThanOrEqual(360000);
    expect(after.x).toBeCloseTo(before.x, 7);
    expect(after.y).toBeCloseTo(before.y, 7);
    expect((after.rotation - before.rotation) / 360).toBeCloseTo(Math.round((after.rotation - before.rotation) / 360), 7);
  }
});

it('跨过世界角度正负180度时沿用最近圈数，避免属性角度突然跳变', () => {
  const project = makeAttachedProject();
  project.bones[0].rotation = 179;
  const angle = 181 * Math.PI / 180;
  const edited = executeCommand({ project, command: { type: 'bone.edit', boneId: 'root', endpoint: 'tail',
    x: 10 + 80 * Math.cos(angle), y: 20 + 80 * Math.sin(angle) } });
  expect(edited.bones[0].rotation).toBeCloseTo(181, 7);
});
