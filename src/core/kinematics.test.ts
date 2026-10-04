import { expect, it } from 'vitest';
import { forwardKinematics, solveTwoBoneIK } from './kinematics';
import { makeTestProject } from './test-fixtures';

it('父旋转改变子骨起点与多层末端，不修改局部骨骼', () => {
  const project = makeTestProject();
  project.bones[0].rotation = 90;
  project.bones.push({ id: 'child', name: '第三层', parentId: 'tip', x: 60, y: 0, rotation: -90, length: 20 });
  const pose = forwardKinematics([...project.bones].reverse());
  expect(pose.tip.x).toBeCloseTo(10);
  expect(pose.tip.y).toBeCloseTo(100);
  expect(pose.child.endX).toBeCloseTo(30);
  expect(pose.child.endY).toBeCloseTo(160);
  expect(project.bones[1].x).toBe(80);
});

it('原型名称也能作为稳定 ID 正常计算', () => {
  const project = makeTestProject();
  project.bones[0].id = '__proto__';
  project.bones[1].id = 'constructor';
  project.bones[1].parentId = '__proto__';
  const pose = forwardKinematics(project.bones);
  expect(Object.hasOwn(pose, '__proto__')).toBe(true);
  expect(pose[project.bones[1].id].endX).toBeCloseTo(150);
});

it('可达目标精确到达，两种弯曲方向产生不同肘部', () => {
  const options = { rootX: 10, rootY: 20, targetX: 100, targetY: 50, rootLength: 80, tipLength: 60 };
  const positive = solveTwoBoneIK({ ...options, bendDirection: 1 });
  const negative = solveTwoBoneIK({ ...options, bendDirection: -1 });
  expect(positive.reachable).toBe(true);
  expect(positive.endX).toBeCloseTo(100);
  expect(positive.endY).toBeCloseTo(50);
  expect(negative.endX).toBeCloseTo(100);
  expect(negative.endY).toBeCloseTo(50);
  expect(positive.rootRotation).not.toBeCloseTo(negative.rootRotation);
});

it('不可达的过远与过近目标稳定夹到可达边界', () => {
  const options = { rootX: 0, rootY: 0, targetY: 0, rootLength: 80, tipLength: 60, bendDirection: 1 as const };
  const far = solveTwoBoneIK({ ...options, targetX: 200 });
  const near = solveTwoBoneIK({ ...options, targetX: 5 });
  expect(far.reachable).toBe(false);
  expect(far.endX).toBeCloseTo(140);
  expect(near.reachable).toBe(false);
  expect(near.endX).toBeCloseTo(20);
  expect(near.endY).toBeCloseTo(0);
});

it('等长骨链目标在根点时不产生 NaN，拒绝零长度', () => {
  const options = { rootX: 0, rootY: 0, targetX: 0, targetY: 0, rootLength: 60, tipLength: 60, bendDirection: -1 as const, fallbackRotation: 30 };
  const result = solveTwoBoneIK(options);
  expect(result.reachable).toBe(true);
  expect(result.rootRotation).toBeCloseTo(30);
  expect(result.endX).toBeCloseTo(0);
  expect(result.endY).toBeCloseTo(0);
  expect(() => solveTwoBoneIK({ ...options, rootLength: 0 })).toThrow('骨长');
});
