import type { Attachment, Bone, Project } from './types';
import { createDemoAssets } from './demo-assets';
import { DEMO_RIG } from './demo-style';
import { parseProject } from './validation';

/** 创建空项目；使用画布像素坐标和秒时间轴。 */
export function createEmptyProject(name = '未命名项目'): Project {
  return { version: 1, id: crypto.randomUUID(), name, width: 512, height: 512,
    assets: [], bones: [], attachments: [], animations: [], ikConstraints: [] };
}

function createBones(): Bone[] {
  const leftHip = { length: Math.hypot(-19, 2), rotation: Math.atan2(2, -19) * 180 / Math.PI };
  const rightHip = { length: Math.hypot(17, 3), rotation: Math.atan2(3, 17) * 180 / Math.PI };
  const definitions: [string, string, string | null, number, number, number, number][] = [
    ['root', '身体根节点 · 骨盆中心', null, DEMO_RIG.rootX, DEMO_RIG.rootY, 0, 18],
    ['torso', '躯干', 'root', 0, 0, -90, 116],
    ['head', '头部', 'torso', 116, 0, 90, 26],
    ['arm-left', '远侧左上臂', 'root', -34, -93, 103, DEMO_RIG.upperArmLength],
    ['forearm-left', '远侧左前臂', 'arm-left', DEMO_RIG.upperArmLength, 0, -8, DEMO_RIG.forearmLength],
    ['arm-right', '近侧右上臂', 'root', 37, -90, 68, DEMO_RIG.upperArmLength],
    ['forearm-right', '近侧右前臂', 'arm-right', DEMO_RIG.upperArmLength, 0, 19, DEMO_RIG.forearmLength],
    ['hip-left', '远侧左髋 · 骨盆分叉', 'root', 0, 0, leftHip.rotation, leftHip.length],
    ['thigh-left', '远侧左大腿', 'hip-left', leftHip.length, 0, 94 - leftHip.rotation, 39],
    ['shin-left', '远侧左小腿', 'thigh-left', 39, 0, -4, 30],
    ['hip-right', '近侧右髋 · 骨盆分叉', 'root', 0, 0, rightHip.rotation, rightHip.length],
    ['thigh-right', '近侧右大腿', 'hip-right', rightHip.length, 0, 86 - rightHip.rotation, 39],
    ['shin-right', '近侧右小腿', 'thigh-right', 39, 0, 4, 30],
  ];
  return definitions.map(([id, name, parentId, x, y, rotation, length]) => ({ id, name, parentId, x, y, rotation, length }));
}

function part(options: { assetId: string; boneId: string; name: string; zIndex: number; changes?: Partial<Attachment> }): Attachment {
  return { id: `part-${options.boneId}-${options.assetId}`, name: options.name,
    assetId: options.assetId, boneId: options.boneId, x: 0, y: 0, rotation: 0,
    scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1,
    zIndex: options.zIndex, ...options.changes };
}

function createLimbParts(): Attachment[] {
  return ['left', 'right'].flatMap((side) => {
    const isNear = side === 'right'; const name = isNear ? '近侧右' : '远侧左';
    return [
      part({ assetId: `asset-upper-arm-${side}`, boneId: `arm-${side}`, name: `${name}衣袖`, zIndex: isNear ? 6 : 1, changes: { anchorX: 12 / 63 } }),
      part({ assetId: `asset-lower-arm-${side}`, boneId: `forearm-${side}`, name: `${name}前臂`, zIndex: isNear ? 5 : 0, changes: { anchorX: 10 / 58 } }),
      part({ assetId: `asset-hand-${side}`, boneId: `forearm-${side}`, name: `${name}手掌`, zIndex: isNear ? 7 : 1,
        changes: { x: 42, rotation: isNear ? 90 : -90, anchorX: 0.5, anchorY: isNear ? 0.83 : 0.16 } }),
      part({ assetId: `asset-thigh-${side}`, boneId: `thigh-${side}`, name: `${name}裤腿`, zIndex: isNear ? 2 : 0, changes: { anchorX: 12 / 61 } }),
      part({ assetId: `asset-shin-${side}`, boneId: `shin-${side}`, name: `${name}小腿`, zIndex: isNear ? 1 : -1, changes: { anchorX: 10 / 45 } }),
      part({ assetId: `asset-foot-${side}`, boneId: `shin-${side}`, name: `${name}布鞋`, zIndex: isNear ? 2 : 0,
        changes: { x: 30, rotation: -90, anchorX: 0.68, anchorY: 0.2 } }),
    ];
  });
}

function createParts(): Attachment[] {
  return [...createLimbParts(),
    part({ assetId: 'asset-torso', boneId: 'torso', name: '衬衣与领口', zIndex: 3, changes: { x: 58, rotation: 90 } }),
    part({ assetId: 'asset-apron', boneId: 'torso', name: '紫围裙', zIndex: 4, changes: { x: 58, rotation: 90, anchorY: 64 / 140 } }),
    part({ assetId: 'asset-head', boneId: 'head', name: '紫头巾与侧脸', zIndex: 8, changes: { x: -5, y: 6, anchorY: 1 } }),
  ];
}

/** 创建参考风格的小厨师；近侧手臂两骨 IK 挥手，身体与脚底固定。 */
export function createDemoProject(): Project {
  const project = createEmptyProject('紫头巾小厨师 · 挥手示例');
  project.assets = createDemoAssets(); project.bones = createBones(); project.attachments = createParts();
  project.animations = [{ id: 'animation-wave', name: '近侧右手挥手', duration: 2, fps: 24, loop: true, tracks: [] }];
  project.ikConstraints = [{ id: 'ik-wave', name: '近侧右手挥手 IK', rootBoneId: 'arm-right',
    tipBoneId: 'forearm-right', targetX: 351, targetY: 238, bendDirection: -1, enabled: true,
    animationId: 'animation-wave', targetKeys: [
      { time: 0, x: 351, y: 238 }, { time: 0.5, x: 343, y: 224 },
      { time: 1, x: 361, y: 240 }, { time: 1.5, x: 343, y: 224 }, { time: 2, x: 351, y: 238 },
    ] }];
  return parseProject(project);
}
