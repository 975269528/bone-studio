import type { Project } from './types';
import { createEmptyProject } from './project';

/** 创建测试用可连接的两骨链，默认未启用 IK。 */
export function makeTestProject(): Project {
  const project = createEmptyProject('测试角色');
  project.bones = [
    { id: 'root', name: '上骨', parentId: null, x: 10, y: 20, rotation: 0, length: 80 },
    { id: 'tip', name: '下骨', parentId: 'root', x: 80, y: 0, rotation: 0, length: 60 },
  ];
  project.animations = [{ id: 'walk', name: '动作', duration: 2, fps: 24, loop: false, tracks: [] }];
  return project;
}
