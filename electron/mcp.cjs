const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { schemas } = require('./protocol.cjs');
const connectionSchema = z.object({ version: z.literal(1), host: z.literal('127.0.0.1'), port: z.number().int().min(1024).max(65535), token: z.string().regex(/^[a-f0-9]{64}$/), pid: z.number().int().positive() }).strict();
const descriptions = {
  get_project: '读取当前编辑器的完整项目、revision 与 dirty；包含未保存的变更。',
  apply_commands: '原子执行项目指令；支持骨骼、附件、动画、关键帧和两段 IK。建议先 get_project，再传 expectedRevision 防止覆盖并发修改。',
  import_images: '将明确指定的本地 PNG/WebP/JPEG 文件作为部件导入当前项目；每张最多 18 MB、8192 像素边长，单批最多 36 MB。',
  render_preview: '渲染指定动画和时间的一帧透明 PNG，返回 MCP image，可多次取样检查效果。',
  export_animation: '渲染动画并保存 sequence（PNG 序列 ZIP）或 sheet（spritesheet PNG + JSON ZIP）。路径必须 .zip，覆盖须 replace:true。',
  save_project: '将当前未保存项目保存到明确指定的 .json 路径。已有文件只有 replace:true 才覆盖。',
  undo: '撤销当前会话的一次项目编辑，包含 AI 和 UI 的变更。',
  redo: '重做当前会话的一次已撤销编辑。',
};

/** Locate only the configured connection file; no general filesystem tools are exposed. */
function connectionPath() {
  if (process.env.BONE_STUDIO_CONNECTION) return path.resolve(process.env.BONE_STUDIO_CONNECTION);
  const dataRoot = process.env.APPDATA ?? (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
  return path.join(dataRoot, 'BoneStudio', 'ai-connection.json');
}

/** Re-read credentials for every call so restarting the desktop needs no MCP restart. */
async function callEditor(method, params) {
  let connection;
  try { connection = connectionSchema.parse(JSON.parse(await fs.readFile(connectionPath(), 'utf8'))); }
  catch { throw new Error('无法读取有效连接信息，请先启动 BoneStudio，并检查 BONE_STUDIO_CONNECTION。'); }
  let response;
  try {
    response = await fetch(`http://127.0.0.1:${connection.port}/command`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}` },
      body: JSON.stringify({ method, params }), signal: AbortSignal.timeout(95000),
    });
  } catch { throw new Error('无法连接 BoneStudio 或操作超时，请确认编辑器仍在运行。'); }
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error ?? '编辑器请求失败。');
  return body.result;
}

/** Preserve rendered PNGs as native MCP images alongside structured metadata. */
function toolContent(name, result) {
  if (name !== 'render_preview') return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  if (!result || result.mimeType !== 'image/png' || typeof result.base64 !== 'string') throw new Error('编辑器没有返回有效 PNG 预览。');
  const { base64, ...metadata } = result;
  return { content: [{ type: 'image', data: base64, mimeType: 'image/png' }, { type: 'text', text: JSON.stringify(metadata) }] };
}

/** Register exact domain schemas and report operation failures as MCP tool errors. */
function registerTools(server) {
  for (const [name, description] of Object.entries(descriptions)) {
    const method = name === 'import_images' ? 'import_assets' : name;
    server.registerTool(name, { description, inputSchema: schemas[method], annotations: { readOnlyHint: ['get_project', 'render_preview'].includes(name), destructiveHint: ['save_project', 'export_animation'].includes(name), openWorldHint: false } }, async (params) => {
      try { return toolContent(name, await callEditor(method, params)); }
      catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
    });
  }
}

const server = new McpServer({ name: 'bone-studio', version: '0.1.0' });
registerTools(server);
server.connect(new StdioServerTransport()).catch(() => {
  console.error('BoneStudio MCP stdio 启动失败。');
  process.exitCode = 1;
});
