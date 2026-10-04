import { expect } from 'vitest';
import type { BonePoints, RigPoints } from './bone-joints';
import type { Project } from './types';
import { snapshotBonePoints } from './bone-joints';
import { makeTestProject } from './test-fixtures';

/** 创建头、尾两种连接及位置重叠但明确脱开的多分支基础骨架。 */
export function makeBranchProject(): Project {
  const project = makeTestProject();
  project.bones.push(
    { id: 'branch', name: '尾分支', parentId: 'root', connection: 'tail', x: 80, y: 0, rotation: 90, length: 40 },
    { id: 'head', name: '头分支', parentId: 'root', connection: 'head', x: 0, y: 0, rotation: -90, length: 30 },
    { id: 'free', name: '脱开分支', parentId: 'root', connection: 'none', x: 80, y: 0, rotation: -90, length: 40 },
  );
  return project;
}

/** 用误差比较骨头、骨尾世界位置，忽略局部角度的等价表达。 */
export function expectBonePoints(actual: BonePoints, expected: BonePoints): void {
  (['head', 'tail'] as const).forEach((endpoint) => {
    expect(actual[endpoint].x).toBeCloseTo(expected[endpoint].x, 7);
    expect(actual[endpoint].y).toBeCloseTo(expected[endpoint].y, 7);
  });
}

/** 验证两套基础世界骨架的全部端点。 */
export function expectRigPoints(actual: Project, expected: RigPoints): void {
  const points = snapshotBonePoints(actual.bones);
  expected.forEach((bone, id) => expectBonePoints(points.get(id)!, bone));
}
