import type { Project } from './types';
import { makeTestProject } from './test-fixtures';

/** 创建包含绑定与自由部件的旧版项目，方便验证可逆编辑。 */
export function makeAttachedProject(): Project {
  const project = makeTestProject();
  project.assets = [{ id: 'image', name: '图', width: 1, height: 1, dataUrl: 'data:image/png;base64,AA==' }];
  project.attachments = [{ id: 'bound', name: '手', assetId: 'image', boneId: 'tip', x: 12, y: 5,
    rotation: 15, scaleX: 2, scaleY: 3, anchorX: 0.5, anchorY: 0.5, opacity: 0.8, zIndex: 2 },
  { id: 'free', name: '地面', assetId: 'image', boneId: null, x: 200, y: 100,
    rotation: 5, scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1, zIndex: 0 }];
  return project;
}

/** 为测试项目添加有动画目标的 IK；下骨关键帧始终保持连接。 */
export function addAnimatedIK(project: Project): void {
  project.animations[0].tracks = [
    { boneId: 'root', interpolation: 'linear', keyframes: [{ time: 1, x: 30, y: 40, rotation: 90 }] },
    { boneId: 'tip', interpolation: 'linear', keyframes: [{ time: 1, x: 80, y: 0, rotation: 30 }] },
  ];
  project.ikConstraints = [{ id: 'ik', name: '手 IK', rootBoneId: 'root', tipBoneId: 'tip',
    targetX: 100, targetY: 80, bendDirection: 1, enabled: true, animationId: 'walk',
    targetKeys: [{ time: 1, x: 110, y: 90 }] }];
}
