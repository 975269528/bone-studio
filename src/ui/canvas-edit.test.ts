import { expect, it } from 'vitest';
import { executeCommand, samplePose } from '@/core/api';
import { makeTestProject } from '@/core/test-fixtures';
import type { Attachment } from '@/core/types';
import { attachmentWorld, hitAttachment, planAttachmentDrag } from './attachment-edit';
import { drawnBone } from './draw-bone';
import { hitCanvasTarget, planCanvasDrag } from './canvas-edit';
import { applyCommands, getEditorState, replaceProject, updateEditor } from './store';

function testPart(): Attachment {
  return { id: 'part', name: '图片', assetId: 'asset', boneId: null, x: 200, y: 200, rotation: 0,
    scaleX: 1, scaleY: 1, anchorX: 0.5, anchorY: 0.5, opacity: 1, zIndex: 0 };
}

it('draws independent branches in a rotated parent frame without moving the parent', () => {
  const project = makeTestProject(); project.bones[0].rotation = 45;
  const context = { project, animationId: null, time: 0 };
  const first = drawnBone({ context, start: { x: 70, y: 90 }, end: { x: 140, y: 120 }, parentId: 'root' });
  const second = drawnBone({ context, start: { x: 100, y: 100 }, end: { x: 110, y: 160 }, parentId: 'root' });
  project.bones.push(first, second); const pose = samplePose(context);
  expect(first.parentId).toBe('root'); expect(second.parentId).toBe('root');
  expect(pose.bones[first.id].x).toBeCloseTo(70); expect(pose.bones[first.id].y).toBeCloseTo(90);
  expect(pose.bones[first.id].endX).toBeCloseTo(140); expect(pose.bones[first.id].endY).toBeCloseTo(120);
  expect(pose.bones[second.id].endX).toBeCloseTo(110); expect(pose.bones[second.id].endY).toBeCloseTo(160);
});

it('selects frontmost transformed images while keeping IK and joints accessible', () => {
  const project = makeTestProject(); const part = testPart(); project.attachments.push(part);
  project.assets.push({ id: 'asset', name: '素材', width: 100, height: 100, dataUrl: 'data:image/png;base64,' });
  part.boneId = null; part.x = 200; part.y = 200; part.rotation = 90; part.scaleX = -2;
  const front = { ...part, id: 'front', zIndex: part.zIndex + 1 }; project.attachments.push(front);
  const context = { project, animationId: null, time: 0 };
  expect(hitAttachment(context, { x: 200, y: 200 })?.id).toBe('front');
  front.zIndex = part.zIndex;
  expect(hitAttachment(context, { x: 200, y: 200 })?.id).toBe('front');
  expect(hitCanvasTarget(context, { x: 200, y: 200 })?.kind).toBe('attachment');
  const root = samplePose(context).bones.root; front.x = root.x; front.y = root.y;
  expect(hitCanvasTarget(context, root)?.kind).toBe('bone');
  expect(hitCanvasTarget({ ...context, showBones: false }, root)?.id).toBe('front');
});

it('moves bound images in parent coordinates and preserves world rotation and scale ratios', () => {
  const project = makeTestProject(); project.bones[0].rotation = 90;
  const attachment = { ...testPart(), boneId: 'root', x: 10, y: 20, scaleX: 2, scaleY: 3 };
  const context = { project, animationId: null, time: 0 }; const anchor = attachmentWorld(context, attachment);
  const start = { x: anchor.x + 30, y: anchor.y }; const point = { x: start.x + 20, y: start.y + 10 };
  const move = planAttachmentDrag({ context, drag: { attachment, start, mode: 'select' }, point });
  expect(move.type === 'attachment.update' && move.changes.x).toBeCloseTo(20);
  expect(move.type === 'attachment.update' && move.changes.y).toBeCloseTo(0);
  const rotate = planAttachmentDrag({ context, drag: { attachment, start, mode: 'rotate' }, point: { x: anchor.x, y: anchor.y + 30 } });
  expect(rotate.type === 'attachment.update' && rotate.changes.rotation).toBeCloseTo(attachment.rotation + 90);
  const scale = planAttachmentDrag({ context, drag: { attachment, start, mode: 'scale' }, point: { x: anchor.x + 60, y: anchor.y } });
  expect(scale.type === 'attachment.update' && scale.changes.scaleX).toBeCloseTo(4);
  expect(scale.type === 'attachment.update' && scale.changes.scaleY).toBeCloseTo(6);
});

it('adjusts length from a frozen world origin without rotating or adding animation keys', () => {
  const project = makeTestProject(); const context = { project, animationId: 'walk', time: 0.5 };
  const world = samplePose(context).bones.root; const target = hitCanvasTarget(context, { x: world.endX, y: world.endY }, 'length');
  expect(target?.kind).toBe('length'); if (!target) throw new Error('Missing length handle');
  const result = planCanvasDrag({ context, drag: target, point: { x: world.x + 120, y: world.y } });
  if (!('command' in result)) throw new Error(result.message);
  const edited = executeCommand({ project, command: result.command });
  expect(edited.bones[0].length).toBeCloseTo(120); expect(edited.bones[0].rotation).toBe(project.bones[0].rotation);
  expect(edited.animations).toEqual(project.animations);
});

it('retains setup editing and repeats notification lifetimes without view changes creating undo history', () => {
  replaceProject(makeTestProject()); updateEditor({ animationId: null });
  applyCommands([{ type: 'project.update', changes: { name: '中文项目名称' } }]);
  expect(getEditorState().animationId).toBeNull();
  const { past, revision } = getEditorState(); updateEditor({ pan: { x: 50, y: -25 }, zoom: 1.2, message: '同一提示' });
  const version = getEditorState().messageVersion; updateEditor({ message: '同一提示' });
  expect(getEditorState().messageVersion).toBe(version + 1);
  expect(getEditorState().past).toBe(past); expect(getEditorState().revision).toBe(revision);
});
