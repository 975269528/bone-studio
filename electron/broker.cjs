const { randomUUID } = require('node:crypto');
const REQUEST_TIMEOUT_MS = 90000;

/** Bridge bounded automation requests to the single canonical renderer session. */
function createBroker(window, ipcMain) {
  const pending = new Map();
  let isReady = false;
  const readyListener = (event, ready) => {
    if (event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame) isReady = ready === true;
  };
  ipcMain.on('automation:ready', readyListener);
  const listener = (event, reply) => {
    if (event.sender !== window.webContents || !reply || typeof reply.id !== 'string') return;
    const request = pending.get(reply.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(reply.id);
    if (reply.error) request.reject(new Error(String(reply.error).slice(0, 1000)));
    else request.resolve(reply.result);
  };
  ipcMain.on('automation:reply', listener);
  const request = (method, params) => new Promise((resolve, reject) => {
    if (window.isDestroyed() || window.webContents.isDestroyed()) return reject(new Error('编辑器窗口已关闭。'));
    if (!isReady) return reject(new Error('编辑器尚未准备好，请等待项目加载后重试。'));
    if (pending.size >= 16) return reject(new Error('等待中的请求过多，请稍后重试。'));
    const id = randomUUID();
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('编辑器操作超过 90 秒。')); }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    window.webContents.send('automation:request', { id, method, params });
  });
  const close = () => {
    ipcMain.removeListener('automation:reply', listener);
    ipcMain.removeListener('automation:ready', readyListener);
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('编辑器窗口已关闭。')); }
    pending.clear();
  };
  window.once('closed', close);
  return { request, close };
}

module.exports = { createBroker };
