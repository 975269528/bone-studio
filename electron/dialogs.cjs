const { dialog } = require('electron');
const { z } = require('zod');
const { importAssets, readProject, writeOutput } = require('./files.cjs');
const saveSchema = z.object({
  suggestedName: z.string().min(1).max(200),
  data: z.string().max(360000000),
  encoding: z.enum(['utf8', 'base64']).optional(),
  filters: z.array(z.object({ name: z.string().max(100), extensions: z.array(z.string().regex(/^[a-z0-9]+$/)).min(1).max(10) }).strict()).max(10).optional(),
}).strict();

/** Register dialog-only filesystem capabilities for the trusted editor window. */
function registerDialogs(window, ipcMain) {
  const assertSender = (event) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('无权访问桌面文件接口。');
  };
  ipcMain.handle('project:open', async (event) => {
    assertSender(event);
    const result = await dialog.showOpenDialog(window, { title: '打开骨骼项目', properties: ['openFile'], filters: [{ name: '骨骼项目', extensions: ['json'] }] });
    return result.canceled ? null : readProject(result.filePaths[0]);
  });
  ipcMain.handle('images:import', async (event) => {
    assertSender(event);
    const result = await dialog.showOpenDialog(window, { title: '导入拆分图片', properties: ['openFile', 'multiSelections'], filters: [{ name: '图片部件', extensions: ['png', 'webp', 'jpg', 'jpeg'] }] });
    return result.canceled ? [] : importAssets(result.filePaths);
  });
  ipcMain.handle('file:save', async (event, input) => {
    assertSender(event);
    const options = saveSchema.parse(input);
    const result = await dialog.showSaveDialog(window, { defaultPath: options.suggestedName, filters: options.filters });
    if (result.canceled || !result.filePath) return null;
    return writeOutput({ outputPath: result.filePath, data: options.data, encoding: options.encoding, replace: true });
  });
}

module.exports = { registerDialogs };
