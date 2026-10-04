const { z } = require('zod');
const { commandSchema } = require('../dist-mcp/commands.cjs');

const identifier = z.string().min(1).max(128);
const output = { outputPath: z.string().min(1).max(4096), replace: z.boolean().default(false) };
const emptySchema = z.object({}).strict();
const schemas = {
  get_project: emptySchema,
  apply_commands: z.object({ commands: z.array(commandSchema).min(1).max(500), expectedRevision: z.number().int().nonnegative().optional() }).strict(),
  import_assets: z.object({ paths: z.array(z.string().min(1).max(4096)).min(1).max(100) }).strict(),
  render_preview: z.object({ animationId: identifier.optional(), time: z.number().min(0).max(600).optional() }).strict(),
  export_animation: z.object({ animationId: identifier, format: z.enum(['sequence', 'sheet']), fps: z.number().int().min(1).max(120).optional(), ...output }).strict(),
  save_project: z.object(output).strict(),
  undo: emptySchema,
  redo: emptySchema,
};

/** Validate one allowlisted method and its exact parameters. */
function validateRequest(input) {
  const envelope = z.object({ method: z.enum(Object.keys(schemas)), params: z.unknown().optional() }).strict().parse(input);
  return { method: envelope.method, params: schemas[envelope.method].parse(envelope.params ?? {}) };
}

module.exports = { schemas, validateRequest };
