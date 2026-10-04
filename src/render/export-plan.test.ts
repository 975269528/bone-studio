import { expect, it } from 'vitest';
import { createExportPlan } from './export-plan';
import { makeTestProject } from '../core/test-fixtures';

it('按整数帧采样但不重复末尾，计划与可变编辑状态隔离', () => {
  const project = makeTestProject();
  const plan = createExportPlan({ project, animationId: 'walk', format: 'sequence', fps: 24 });
  project.bones[0].x = 999;
  expect(plan.frameCount).toBe(48);
  expect((plan.frameCount - 1) / plan.fps).toBeLessThan(plan.animation.duration);
  expect(plan.project.bones[0].x).toBe(10);
});

it('非整帧时长向上取帧数，所有帧时间仍小于时长', () => {
  const project = makeTestProject();
  project.animations[0].duration = 1.01;
  const plan = createExportPlan({ project, animationId: 'walk', format: 'sequence', fps: 24 });
  expect(plan.frameCount).toBe(25);
  expect(24 / plan.fps).toBeLessThan(1.01);
});

it('精灵图具有统一格子、透明间隔与足够布局空间', () => {
  const plan = createExportPlan({ project: makeTestProject(), animationId: 'walk', format: 'sheet', width: 64, height: 64 });
  expect(plan.columns * plan.rows).toBeGreaterThanOrEqual(plan.frameCount);
  expect(plan.sheetWidth).toBe(plan.columns * 64 + (plan.columns - 1) * 2);
  expect(plan.sheetHeight).toBe(plan.rows * 64 + (plan.rows - 1) * 2);
});

it('拒绝缺失动画、非法帧率和非整数输出尺寸', () => {
  const options = { project: makeTestProject(), animationId: 'walk', format: 'sequence' as const };
  expect(() => createExportPlan({ ...options, animationId: null })).toThrow('选择');
  expect(() => createExportPlan({ ...options, animationId: 'missing' })).toThrow('不存在');
  expect(() => createExportPlan({ ...options, fps: 121 })).toThrow('帧率');
  expect(() => createExportPlan({ ...options, width: 10.5 })).toThrow('整数');
});

it('超大单帧、过长动画、总像素与精灵图边长提前拒绝', () => {
  const project = makeTestProject();
  expect(() => createExportPlan({ project, animationId: 'walk', format: 'sequence', width: 8192, height: 8192 })).toThrow('单帧');
  project.animations[0].duration = 600;
  expect(() => createExportPlan({ project, animationId: 'walk', format: 'sequence', fps: 120 })).toThrow('帧数');
  project.animations[0].duration = 2;
  expect(() => createExportPlan({ project, animationId: 'walk', format: 'sequence', width: 4096, height: 4096 })).toThrow('总像素');
  expect(() => createExportPlan({ project, animationId: 'walk', format: 'sheet', fps: 1, width: 8192, height: 2048 })).toThrow('像素');
});
