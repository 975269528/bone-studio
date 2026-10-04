import { expect, it } from 'vitest';
import { createDemoProject } from './project';
import { samplePose } from './pose';
import { DEMO_RIG } from './demo-style';

it('整段挥手只改变近侧手臂，躯干与双脚保持固定', () => {
  const project = createDemoProject();
  const initial = samplePose({ project, animationId: 'animation-wave', time: 0 });
  const stationaryIds = project.bones.map(bone => bone.id).filter(id => !['arm-right', 'forearm-right'].includes(id));
  for (let frame = 0; frame <= 48; frame += 1) {
    const pose = samplePose({ project, animationId: 'animation-wave', time: frame / 24 });
    for (const id of stationaryIds) expect(pose.bones[id]).toEqual(initial.bones[id]);
  }
  const middle = samplePose({ project, animationId: 'animation-wave', time: 0.5 });
  expect(middle.bones['forearm-right'].rotation).not.toBe(initial.bones['forearm-right'].rotation);
});

it('挥手目标全程可达，两段手臂保持相接且首尾闭环', () => {
  const project = createDemoProject();
  for (let frame = 0; frame <= 48; frame += 1) {
    const pose = samplePose({ project, animationId: 'animation-wave', time: frame / 24 });
    const upper = pose.bones['arm-right']; const forearm = pose.bones['forearm-right'];
    expect(forearm.x).toBeCloseTo(upper.endX, 8); expect(forearm.y).toBeCloseTo(upper.endY, 8);
    expect(forearm.endX).toBeCloseTo(pose.ikTargets['ik-wave'].x, 8);
    expect(forearm.endY).toBeCloseTo(pose.ikTargets['ik-wave'].y, 8);
    expect(pose.ikDiagnostics[0].reachable).toBe(true);
  }
  expect(samplePose({ project, animationId: 'animation-wave', time: 2 }))
    .toEqual(samplePose({ project, animationId: 'animation-wave', time: 0 }));
});

it('人体近远侧是不同透明分件，围裙与衬衣独立绑定', () => {
  const project = createDemoProject();
  for (const category of ['upper-arm', 'lower-arm', 'hand', 'thigh', 'shin', 'foot']) {
    const far = project.assets.find(asset => asset.id === `asset-${category}-left`);
    const near = project.assets.find(asset => asset.id === `asset-${category}-right`);
    expect(far?.dataUrl).not.toBe(near?.dataUrl);
  }
  expect(project.attachments.filter(part => part.boneId === 'torso').map(part => part.assetId))
    .toEqual(['asset-torso', 'asset-apron']);
  expect(project.assets.every(asset => asset.dataUrl.startsWith('data:image/svg+xml;base64,'))).toBe(true);
});

it('新增示例不会共享可变项目或素材数组', () => {
  const first = createDemoProject(); const second = createDemoProject();
  first.bones[0].y += 10; first.assets[0].name = '已修改';
  expect(second.bones[0].y).toBe(DEMO_RIG.rootY); expect(second.assets[0].name).toBe('头部 · 紫头巾与侧脸');
  expect(first.id).not.toBe(second.id);
});

it('躯干与左右髋从同一骨盆分叉，双腿链在关节处首尾相接', () => {
  const project = createDemoProject();
  const pose = samplePose({ project, time: 0 });
  const pelvis = pose.bones.root;
  for (const branchId of ['torso', 'hip-left', 'hip-right']) {
    const branch = pose.bones[branchId];
    expect(branch.parentId).toBe('root');
    expect(branch.x).toBe(pelvis.x); expect(branch.y).toBe(pelvis.y);
  }
  for (const side of ['left', 'right']) {
    const hip = pose.bones[`hip-${side}`]; const thigh = pose.bones[`thigh-${side}`];
    const shin = pose.bones[`shin-${side}`];
    expect(thigh.parentId).toBe(hip.id); expect(shin.parentId).toBe(thigh.id);
    expect(thigh.x).toBeCloseTo(hip.endX, 8); expect(thigh.y).toBeCloseTo(hip.endY, 8);
    expect(shin.x).toBeCloseTo(thigh.endX, 8); expect(shin.y).toBeCloseTo(thigh.endY, 8);
  }
});
