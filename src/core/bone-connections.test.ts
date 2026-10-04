import { expect, it } from 'vitest';
import { executeCommand } from './commands';
import { validateProject } from './validation';
import { makeBranchProject } from './rig-test-fixtures';
import { addAnimatedIK, makeAttachedProject } from './edit-test-fixtures';

it('显式头尾连接要求与父关节坐标匹配，根骨不能声明连接', () => {
  const project = makeBranchProject();
  project.bones[2].x = 79;
  expect(validateProject(project).errors.join()).toContain('共享关节');
  project.bones[2].x = 80;
  project.bones[3].y = 1;
  expect(validateProject(project).errors.join()).toContain('共享关节');
  project.bones[3].y = 0;
  project.bones[0].connection = 'head';
  expect(validateProject(project).errors.join()).toContain('根骨骼');
});

it('旧骨长更新只保持尾连接，位置重叠但显式脱开不会跟随', () => {
  const project = makeBranchProject();
  const edited = executeCommand({ project, command: { type: 'bone.update', boneId: 'root', changes: { length: 100 } } });
  expect(edited.bones[1].x).toBe(100);
  expect(edited.bones[2].x).toBe(100);
  expect(edited.bones[3]).toEqual(project.bones[3]);
  expect(edited.bones[4]).toEqual(project.bones[4]);
  expect(() => executeCommand({ project, command: { type: 'bone.update', boneId: 'branch', changes: { x: 75 } } })).toThrow('共享关节');
});

it('IK 下骨即使禁用仍要求尾连接，几何重叠的 none 不能绕过', () => {
  const project = makeAttachedProject();
  addAnimatedIK(project);
  project.ikConstraints[0].enabled = false;
  project.bones[1].connection = 'none';
  expect(validateProject(project).errors.join()).toContain('相接');
  project.bones[1].connection = 'tail';
  expect(validateProject(project).valid).toBe(true);
});
