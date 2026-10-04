import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'bone-studio-check', version: '1.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: ['electron/mcp.cjs'], cwd: process.cwd() });
const expectedCommandTypes = [
  'project.update', 'project.scale', 'asset.add', 'asset.update',
  'bone.add', 'bone.update', 'bone.edit', 'bone.reparent', 'bone.remove',
  'attachment.add', 'attachment.update', 'attachment.remove',
  'animation.add', 'animation.update', 'animation.remove',
  'keyframe.set', 'keyframe.remove', 'ik.add', 'ik.update', 'ik.remove',
  'ik.keyframe.set', 'ik.keyframe.remove',
];
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ['apply_commands', 'export_animation', 'get_project', 'import_images', 'redo', 'render_preview', 'save_project', 'undo']);
  const commands = tools.find((tool) => tool.name === 'apply_commands');
  assert.equal(commands.inputSchema.additionalProperties, false);
  const variants = commands.inputSchema.properties.commands.items.oneOf;
  assert.deepEqual(variants.map((variant) => variant.properties.type.const).sort(), expectedCommandTypes.toSorted());
  const assetUpdate = variants.find((variant) => variant.properties.type.const === 'asset.update');
  assert.deepEqual(Object.keys(assetUpdate.properties.changes.properties), ['name']);
  const boneRemoval = variants.find((variant) => variant.properties.type.const === 'bone.remove');
  assert.ok(boneRemoval.properties.animationId);
  assert.ok(boneRemoval.properties.time);
  const projectScale = variants.find((variant) => variant.properties.type.const === 'project.scale');
  assert.equal(projectScale.properties.factor.minimum, 0.1);
  assert.equal(projectScale.properties.factor.maximum, 10);
  const boneEdit = variants.find((variant) => variant.properties.type.const === 'bone.edit');
  assert.deepEqual(boneEdit.properties.endpoint.enum, ['head', 'tail', 'body']);
  assert.equal(boneEdit.properties.keepImages.type, 'boolean');
  assert.equal(boneEdit.properties.x.maximum, 1_000_000);
  const reparent = variants.find((variant) => variant.properties.type.const === 'bone.reparent');
  assert.deepEqual(reparent.properties.connection.enum, ['head', 'tail', 'none']);
  assert.ok(reparent.properties.parentId);
  const invalid = await client.callTool({ name: 'apply_commands', arguments: { commands: [{ type: 'execute_code', code: 'no' }] } });
  assert.equal(invalid.isError, true);
  console.log('MCP stdio 握手、8 个工具、22 种命令及新增参数 schema 和非法命令拒绝通过。');
} finally {
  await client.close();
}
