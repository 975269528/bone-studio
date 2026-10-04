import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'bone-studio-check', version: '1.0.0' });
const transport = new StdioClientTransport({ command: process.execPath, args: ['electron/mcp.cjs'], cwd: process.cwd() });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ['apply_commands', 'export_animation', 'get_project', 'import_images', 'redo', 'render_preview', 'save_project', 'undo']);
  const commands = tools.find((tool) => tool.name === 'apply_commands');
  assert.equal(commands.inputSchema.additionalProperties, false);
  assert.equal(commands.inputSchema.properties.commands.items.oneOf.length, 18);
  const invalid = await client.callTool({ name: 'apply_commands', arguments: { commands: [{ type: 'execute_code', code: 'no' }] } });
  assert.equal(invalid.isError, true);
  console.log('MCP stdio 握手、8 个工具、18 种命令 schema 和非法命令拒绝通过。');
} finally {
  await client.close();
}
