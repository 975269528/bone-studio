import { z } from 'zod';
import type { ExecuteCommandOptions, ExecuteCommandsOptions, ProjectCommand } from './types';
import { animationSchema, assetSchema, attachmentSchema, boneKeyframeSchema,
  boneSchema, connectionSchema, coordinateSchema, idSchema, ikSchema, interpolationSchema, projectChangesSchema,
  targetKeyframeSchema, timeSchema } from './schema';
import { parseProject } from './validation';
import { applyMutation } from './mutations';

export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('project.update'), changes: projectChangesSchema }).strict(),
  z.object({ type: z.literal('project.scale'), factor: z.number().finite().min(0.1).max(10),
    pivotX: coordinateSchema.optional(), pivotY: coordinateSchema.optional() }).strict(),
  z.object({ type: z.literal('asset.add'), asset: assetSchema }).strict(),
  z.object({ type: z.literal('asset.update'), assetId: idSchema, changes: assetSchema.pick({ name: true }).partial().strict() }).strict(),
  z.object({ type: z.literal('bone.add'), bone: boneSchema }).strict(),
  z.object({ type: z.literal('bone.update'), boneId: idSchema, changes: boneSchema.omit({ id: true }).partial().strict() }).strict(),
  z.object({ type: z.literal('bone.edit'), boneId: idSchema, endpoint: z.enum(['head', 'tail', 'body']),
    x: coordinateSchema, y: coordinateSchema, keepImages: z.boolean().optional() }).strict(),
  z.object({ type: z.literal('bone.reparent'), boneId: idSchema, parentId: idSchema.nullable(),
    connection: connectionSchema.optional(), keepImages: z.boolean().optional() }).strict(),
  z.object({ type: z.literal('bone.remove'), boneId: idSchema,
    animationId: idSchema.nullable().optional(), time: timeSchema.optional() }).strict(),
  z.object({ type: z.literal('attachment.add'), attachment: attachmentSchema }).strict(),
  z.object({ type: z.literal('attachment.update'), attachmentId: idSchema, changes: attachmentSchema.omit({ id: true }).partial().strict() }).strict(),
  z.object({ type: z.literal('attachment.remove'), attachmentId: idSchema }).strict(),
  z.object({ type: z.literal('animation.add'), animation: animationSchema }).strict(),
  z.object({ type: z.literal('animation.update'), animationId: idSchema, changes: animationSchema.omit({ id: true }).partial().strict() }).strict(),
  z.object({ type: z.literal('animation.remove'), animationId: idSchema }).strict(),
  z.object({ type: z.literal('keyframe.set'), animationId: idSchema, boneId: idSchema, keyframe: boneKeyframeSchema, interpolation: interpolationSchema.optional() }).strict(),
  z.object({ type: z.literal('keyframe.remove'), animationId: idSchema, boneId: idSchema, time: timeSchema }).strict(),
  z.object({ type: z.literal('ik.add'), constraint: ikSchema }).strict(),
  z.object({ type: z.literal('ik.update'), constraintId: idSchema, changes: ikSchema.omit({ id: true }).partial().strict() }).strict(),
  z.object({ type: z.literal('ik.remove'), constraintId: idSchema }).strict(),
  z.object({ type: z.literal('ik.keyframe.set'), constraintId: idSchema, keyframe: targetKeyframeSchema }).strict(),
  z.object({ type: z.literal('ik.keyframe.remove'), constraintId: idSchema, time: timeSchema }).strict(),
]);

/** 验证外部编辑命令，拒绝未知动作和字段；返回与输入分离的命令对象。 */
export function parseCommand(input: unknown): ProjectCommand {
  const result = commandSchema.safeParse(input);
  if (!result.success) throw new Error(`命令校验失败：${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('；')}`);
  return result.data;
}

/** 原子执行一条编辑命令；失败时不改变项目输入。 */
export function executeCommand(options: ExecuteCommandOptions) {
  return executeCommands({ project: options.project, commands: [options.command] });
}

/** 原子执行命令批次；允许批次内暂时悬空，最终必须满足完整项目约束。 */
export function executeCommands(options: ExecuteCommandsOptions) {
  if (options.commands.length > 1000) throw new Error('单次事务最多包含 1000 条命令');
  const project = parseProject(options.project);
  const commands = options.commands.map(parseCommand);
  for (const command of commands) applyMutation(project, command);
  return parseProject(project);
}
