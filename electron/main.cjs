const path = require('node:path');
const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const { createBroker } = require('./broker.cjs');
const { registerDialogs } = require('./dialogs.cjs');
const { startSession } = require('./session.cjs');
app.setName('BoneStudio');
const isDevelopment = process.env.BONE_STUDIO_DEV_URL === 'http://127.0.0.1:5173';
const debugPort = Number(process.env.BONE_STUDIO_DEBUG_PORT);
if (isDevelopment && Number.isInteger(debugPort) && debugPort >= 1024 && debugPort <= 65535) {
  app.commandLine.appendSwitch('remote-debugging-port', String(debugPort));
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
}
let activeSession;

/** Harden browser capabilities while retaining Vite's local development connection. */
function secureSession() {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const local = isDevelopment ? ' http://127.0.0.1:5173 ws://127.0.0.1:5173' : '';
  const devInline = isDevelopment ? " 'unsafe-inline'" : '';
  const policy = `default-src 'self'; script-src 'self'${devInline}${local}; style-src 'self' 'unsafe-inline'${local}; img-src 'self' data: blob:; connect-src 'self'${local}; font-src 'self' data:; object-src 'none'; base-uri 'self'`;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] } });
  });
}

/** Create the isolated editor and bridge its live unsaved session. */
async function createWindow() {
  secureSession();
  const window = new BrowserWindow({
    width: 1600, height: 1000, minWidth: 1100, minHeight: 720,
    title: 'BoneStudio · 2D 骨骼动画', backgroundColor: '#12131b', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => {
    // Vite can fall back to page navigation after invalidating a non-component module.
    if (!isDevelopment || event.url !== window.webContents.getURL()) event.preventDefault();
  });
  const broker = createBroker(window, ipcMain);
  registerDialogs(window, ipcMain);
  if (isDevelopment) await window.loadURL(process.env.BONE_STUDIO_DEV_URL);
  else await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  activeSession = await startSession({ broker, userData: app.getPath('userData') });
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', () => { const window = BrowserWindow.getAllWindows()[0]; window?.show(); window?.focus(); });
  app.whenReady().then(createWindow).catch((error) => {
    dialog.showErrorBox('BoneStudio 启动失败', error.message);
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (event) => {
    if (!activeSession) return;
    event.preventDefault();
    const closing = activeSession;
    activeSession = undefined;
    closing.close().catch((error) => console.error('连接信息清理失败：', error.code ?? error.message)).finally(() => app.quit());
  });
}
