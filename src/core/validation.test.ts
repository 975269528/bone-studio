import { describe, expect, it } from 'vitest';
import { createDemoProject } from './project';
import { makeTestProject } from './test-fixtures';
import { parseProject, validateProject } from './validation';

describe('项目文件完整性校验', () => {
  it('生成的示例包含透明分件、动画与特定动作的 IK', () => {
    const project = createDemoProject();
    expect(validateProject(project)).toEqual({ valid: true, errors: [] });
    expect(project.assets).toHaveLength(15);
    expect(project.ikConstraints[0].animationId).toBe('animation-wave');
    expect(project.attachments).toHaveLength(project.assets.length);
  });

  it('拒绝对象 ID 重复、缺失素材与关键帧超出时长', () => {
    const project = makeTestProject();
    project.bones[1].id = 'root';
    expect(validateProject(project).errors.join(' ')).toContain('重复');
    const animation = makeTestProject();
    animation.animations[0].tracks = [{ boneId: 'tip', interpolation: 'linear', keyframes: [{ time: 3, x: 80, y: 0, rotation: 0 }] }];
    expect(() => parseProject(animation)).toThrow('时长');
    expect(() => parseProject({ ...makeTestProject(), width: 0 })).toThrow('width');
  });

  it('约束属于具体动画时，不限制其他短动画', () => {
    const project = makeTestProject();
    project.animations.push({ id: 'short', name: '短动作', duration: 0.2, fps: 24, loop: false, tracks: [] });
    project.ikConstraints = [{ id: 'ik', name: '手', rootBoneId: 'root', tipBoneId: 'tip', targetX: 100,
      targetY: 20, bendDirection: 1, enabled: true, animationId: 'walk', targetKeys: [{ time: 2, x: 100, y: 20 }] }];
    expect(validateProject(project).valid).toBe(true);
    delete project.ikConstraints[0].animationId;
    expect(validateProject(project).errors.join(' ')).toContain('时长');
  });

  it('拒绝重叠 IK 和破坏下骨连接的动画位置', () => {
    const project = makeTestProject();
    const constraint = { id: 'ik', name: '手', rootBoneId: 'root', tipBoneId: 'tip', targetX: 100,
      targetY: 20, bendDirection: 1 as const, enabled: true, targetKeys: [] };
    project.ikConstraints = [constraint, { ...constraint, id: 'other' }];
    expect(validateProject(project).errors.join(' ')).toContain('重叠');
    project.ikConstraints = [constraint];
    project.animations[0].tracks = [{ boneId: 'tip', interpolation: 'linear', keyframes: [{ time: 0, x: 82, y: 0, rotation: 0 }] }];
    expect(validateProject(project).errors.join(' ')).toContain('保持连接');
  });
});
