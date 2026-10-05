const fs = require('node:fs/promises');
const path = require('node:path');
const { app, clipboard } = require('electron');
const { writeOutput } = require('./files.cjs');
const REQUIREMENTS = [
  '仅 AI / MCP 接入需要安装 Node.js 22.12 或更高版本，并确保 node 命令可用。编辑器 EXE 本身不需要 Node.js。',
  '请保持 BoneStudio 编辑器打开；关闭后重新启动，无需重新复制此配置。',
  '适配器会保存在当前用户的数据目录，不需要源码或 node_modules。更改数据目录后请重新复制配置。',
];

/** Publish a self-contained adapter and describe only local launch paths, never credentials. */
async function getMcpConfiguration() {
  const userData = app.getPath('userData');
  const adapterPath = path.join(userData, 'mcp-adapter.cjs');
  try {
    const data = await fs.readFile(path.join(__dirname, '..', 'dist-mcp', 'mcp-adapter.cjs'));
    await fs.mkdir(userData, { recursive: true });
    await writeOutput({ outputPath: adapterPath, data, replace: true });
  } catch (error) {
    throw new Error(`生成 MCP 配置失败（${error.code ?? error.message}）。`, { cause: error });
  }
  const configuration = JSON.stringify({ mcpServers: { 'bone-studio': {
    command: 'node', args: [adapterPath],
    env: { BONE_STUDIO_CONNECTION: path.join(userData, 'ai-connection.json') },
  } } }, null, 2);
  return { configuration, requirements: [...REQUIREMENTS] };
}

/** Expose configuration and clipboard operations only to the editor's main frame. */
function registerMcpConfiguration(window, ipcMain) {
  const assertSender = event => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('无权访问 MCP 配置接口。');
  };
  ipcMain.handle('mcp:configuration', async event => {
    assertSender(event);
    return getMcpConfiguration();
  });
  ipcMain.handle('mcp:copy', async event => {
    assertSender(event);
    const result = await getMcpConfiguration();
    await clipboard.writeText(result.configuration);
  });
}

module.exports = { registerMcpConfiguration };
