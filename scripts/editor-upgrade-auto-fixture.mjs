import { createUpgradeProject } from './editor-upgrade-startup.mjs';

/** Extend the UI fixture with a visible two-bone IK chain and existing easing metadata. */
export function createAutoKeyProject() {
  const project = createUpgradeProject();
  const root = { id: 'auto-ik-root', name: 'IK 第一段', parentId: null, x: 40, y: 60, rotation: 0, length: 60 };
  const tip = { id: 'auto-ik-tip', name: 'IK 第二段', parentId: root.id, connection: 'tail', x: 60, y: 0, rotation: 0, length: 50 };
  project.bones.push(root, tip);
  project.attachments.push({ ...project.attachments[0], id: 'auto-ik-image', name: 'IK 验收部件', boneId: root.id, scaleX: 0.5 });
  project.ikConstraints.push({ id: 'auto-ik', name: '验收 IK', rootBoneId: root.id, tipBoneId: tip.id,
    targetX: 130, targetY: 70, bendDirection: 1, enabled: true, animationId: 'upgrade-animation',
    targetKeys: [{ time: 0, x: 130, y: 70, interpolation: 'smooth' }, { time: 3, x: 145, y: 80 }] });
  Object.assign(project.animations[0].tracks[0].keyframes[0], {
    interpolation: 'bezier', curve: { x1: 0.25, y1: 0.1, x2: 0.75, y2: 0.9 },
  });
  return project;
}
