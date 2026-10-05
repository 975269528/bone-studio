import { describe, expect, it } from 'vitest';
import { createDemoProject } from '@/core/api';
import { dragWheelPixels, LIBRARY_SECTIONS, selectionPath } from './library-layout';

describe('library group navigation', () => {
  it('opens the bones group and every ancestor of a selected nested image', () => {
    const project = createDemoProject(); const attachment = project.attachments.find(item => item.boneId === 'head')!;
    expect(selectionPath(project, { kind: 'attachment', id: attachment.id })).toEqual([LIBRARY_SECTIONS.bones, 'head', 'torso', 'root']);
    expect(selectionPath(project, { kind: 'bone', id: 'head' })).toEqual([LIBRARY_SECTIONS.bones, 'torso', 'root']);
  });

  it('reveals each independent group without opening unrelated bone ancestors', () => {
    const project = createDemoProject(); const attachment = { ...project.attachments[0], boneId: null }; project.attachments = [attachment];
    expect(selectionPath(project, { kind: 'attachment', id: attachment.id })).toEqual([LIBRARY_SECTIONS.unbound]);
    expect(selectionPath(project, { kind: 'ik', id: project.ikConstraints[0].id })).toEqual([LIBRARY_SECTIONS.ik]);
    expect(selectionPath(project, { kind: 'asset', id: project.assets[0].id })).toEqual([]);
    expect(selectionPath(project, null)).toEqual([]);
  });

  it('converts high resolution, line and page wheel deltas in both directions', () => {
    expect(dragWheelPixels({ delta: 0.5, mode: 0, pageHeight: 160 })).toBe(0.5);
    expect(dragWheelPixels({ delta: -3, mode: 1, pageHeight: 160 })).toBe(-84);
    expect(dragWheelPixels({ delta: 1, mode: 2, pageHeight: 160 })).toBe(160);
  });
});
