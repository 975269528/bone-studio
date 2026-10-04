import type { Attachment, Bone, Project } from './types';
import { createDemoAssets } from './demo-assets';
import { parseProject } from './validation';

/** 创建空项目；使用画布像素坐标和秒时间轴。 */
export function createEmptyProject(name = '未命名项目'): Project {
  return { version: 1, id: crypto.randomUUID(), name, width: 512, height: 512,
    assets: [], bones: [], attachments: [], animations: [], ikConstraints: [] };
}

function createBones(): Bone[] {
  const definitions: [string, string, string | null, number, number, number, number][] = [
    ['root', '身体根节点', null, 256, 340, 0, 18],
    ['torso', '躯干', 'root', 0, -20, -90, 110],
    ['head', '头', 'torso', 110, 0, 90, 25],
    ['arm-left', '左上臂', 'root', -52, -101, 130, 58],
    ['forearm-left', '左前臂', 'arm-left', 58, 0, -28, 52],
    ['arm-right', '右上臂', 'root', 52, -101, -35, 58],
    ['forearm-right', '右前臂', 'arm-right', 58, 0, -65, 52],
    ['thigh-left', '左大腿', 'root', -24, 0, 95, 58],
    ['shin-left', '左小腿', 'thigh-left', 58, 0, -5, 55],
    ['thigh-right', '右大腿', 'root', 24, 0, 85, 58],
    ['shin-right', '右小腿', 'thigh-right', 58, 0, 5, 55],
  ];
  return definitions.map(([id, name, parentId, x, y, rotation, length]) => ({ id, name, parentId, x, y, rotation, length }));
}

function part(options: { assetId: string; boneId: string; zIndex: number; changes?: Partial<Attachment> }): Attachment {
  return { id: `part-${options.boneId}-${options.assetId}`, name: options.boneId,
    assetId: options.assetId, boneId: options.boneId, x: 0, y: 0, rotation: 0,
    scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1,
    zIndex: options.zIndex, ...options.changes };
}

function createParts(): Attachment[] {
  const limbParts = ['left', 'right'].flatMap((side) => [
    part({ assetId: 'asset-upper-arm', boneId: `arm-${side}`, zIndex: side === 'left' ? 2 : 5, changes: { anchorX: 14 / 86 } }),
    part({ assetId: 'asset-lower-arm', boneId: `forearm-${side}`, zIndex: 6, changes: { anchorX: 14 / 80 } }),
    part({ assetId: 'asset-hand', boneId: `forearm-${side}`, zIndex: 7, changes: { x: 52, rotation: 90, anchorY: 0.9 } }),
    part({ assetId: 'asset-thigh', boneId: `thigh-${side}`, zIndex: 0, changes: { anchorX: 14 / 86 } }),
    part({ assetId: 'asset-shin', boneId: `shin-${side}`, zIndex: 1, changes: { anchorX: 14 / 83 } }),
    part({ assetId: 'asset-foot', boneId: `shin-${side}`, zIndex: 3, changes: { x: 55, rotation: -90, anchorX: 0.35 } }),
  ]);
  return [...limbParts,
    part({ assetId: 'asset-torso', boneId: 'torso', zIndex: 4, changes: { x: 48, rotation: 90 } }),
    part({ assetId: 'asset-head', boneId: 'head', zIndex: 8, changes: { y: -30 } }),
  ];
}

/** 创建可保存和自动化编辑的透明部件机器人，含身体起伏与两骨 IK 挥手。 */
export function createDemoProject(): Project {
  const project = createEmptyProject('机器人 · 挥手示例');
  project.assets = createDemoAssets();
  project.bones = createBones();
  project.attachments = createParts();
  project.animations = [{ id: 'animation-wave', name: '挥手', duration: 2, fps: 24, loop: true,
    tracks: [{ boneId: 'root', interpolation: 'smooth', keyframes: [
      { time: 0, x: 256, y: 340, rotation: 0 }, { time: 1, x: 256, y: 335, rotation: 0 },
      { time: 2, x: 256, y: 340, rotation: 0 },
    ] }] }];
  project.ikConstraints = [{ id: 'ik-wave', name: '右手挥动 IK', rootBoneId: 'arm-right',
    tipBoneId: 'forearm-right', targetX: 379, targetY: 181, bendDirection: -1, enabled: true,
    animationId: 'animation-wave', targetKeys: [
      { time: 0, x: 379, y: 181 }, { time: 0.5, x: 361, y: 165 },
      { time: 1, x: 389, y: 187 }, { time: 1.5, x: 361, y: 165 }, { time: 2, x: 379, y: 181 },
    ] }];
  return parseProject(project);
}
