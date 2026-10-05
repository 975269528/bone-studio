import { z } from 'zod';
import { MAX_ROTATION } from './rotation';

export const idSchema = z.string().min(1).max(128);
const nameSchema = z.string().min(1).max(200);
export const coordinateSchema = z.number().finite().min(-1_000_000).max(1_000_000);
const angleSchema = z.number().finite().min(-MAX_ROTATION).max(MAX_ROTATION);
export const timeSchema = z.number().finite().min(0).max(600);
export const interpolationSchema = z.enum(['linear', 'smooth', 'step', 'step-start', 'bezier']);
export const connectionSchema = z.enum(['head', 'tail', 'none']);
const curveCoordinateSchema = z.number().finite().min(0).max(1);
export const bezierCurveSchema = z.object({
  x1: curveCoordinateSchema,
  y1: curveCoordinateSchema,
  x2: curveCoordinateSchema,
  y2: curveCoordinateSchema,
}).strict();

export const assetSchema = z.object({
  id: idSchema,
  name: nameSchema,
  dataUrl: z.string().max(25_000_000).regex(/^data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/),
  width: z.number().int().min(1).max(8192),
  height: z.number().int().min(1).max(8192),
}).strict();

export const boneSchema = z.object({
  id: idSchema,
  name: nameSchema,
  parentId: idSchema.nullable(),
  connection: connectionSchema.optional(),
  x: coordinateSchema,
  y: coordinateSchema,
  rotation: angleSchema,
  length: z.number().finite().positive().max(100_000),
}).strict();

export const attachmentSchema = z.object({
  id: idSchema,
  name: nameSchema,
  assetId: idSchema,
  boneId: idSchema.nullable(),
  x: coordinateSchema,
  y: coordinateSchema,
  rotation: angleSchema,
  scaleX: z.number().finite().min(0.001).max(100),
  scaleY: z.number().finite().min(0.001).max(100),
  anchorX: z.number().finite().min(0).max(1),
  anchorY: z.number().finite().min(0).max(1),
  opacity: z.number().finite().min(0).max(1),
  zIndex: z.number().int().min(-100_000).max(100_000),
}).strict();

export const boneKeyframeSchema = z.object({
  time: timeSchema,
  x: coordinateSchema,
  y: coordinateSchema,
  rotation: angleSchema,
  interpolation: interpolationSchema.optional(),
  curve: bezierCurveSchema.optional(),
}).strict();

export const targetKeyframeSchema = z.object({
  time: timeSchema,
  x: coordinateSchema,
  y: coordinateSchema,
  interpolation: interpolationSchema.optional(),
  curve: bezierCurveSchema.optional(),
}).strict();

export const animationSchema = z.object({
  id: idSchema,
  name: nameSchema,
  duration: z.number().finite().min(1 / 120).max(600),
  fps: z.number().int().min(1).max(120),
  loop: z.boolean(),
  tracks: z.array(z.object({
    boneId: idSchema,
    keyframes: z.array(boneKeyframeSchema).max(10_000),
    interpolation: interpolationSchema,
  }).strict()).max(1000),
}).strict();

export const ikSchema = z.object({
  id: idSchema,
  name: nameSchema,
  rootBoneId: idSchema,
  tipBoneId: idSchema,
  targetX: coordinateSchema,
  targetY: coordinateSchema,
  bendDirection: z.union([z.literal(1), z.literal(-1)]),
  enabled: z.boolean(),
  targetKeys: z.array(targetKeyframeSchema).max(10_000),
  animationId: idSchema.optional(),
}).strict();

export const projectChangesSchema = z.object({
  name: nameSchema,
  width: z.number().int().min(1).max(8192),
  height: z.number().int().min(1).max(8192),
}).partial().strict();

export const projectSchema = z.object({
  version: z.literal(1),
  id: idSchema,
  name: nameSchema,
  width: z.number().int().min(1).max(8192),
  height: z.number().int().min(1).max(8192),
  assets: z.array(assetSchema).max(1000),
  bones: z.array(boneSchema).max(1000),
  attachments: z.array(attachmentSchema).max(2000),
  animations: z.array(animationSchema).max(100),
  ikConstraints: z.array(ikSchema).max(500),
}).strict();
