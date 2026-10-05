const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('boneStudio', {
  getMcpConfiguration: () => ipcRenderer.invoke('mcp:configuration'),
  copyMcpConfiguration: () => ipcRenderer.invoke('mcp:copy'),
  openProject: (options) => ipcRenderer.invoke('project:open', options),
  restoreProject: (options) => ipcRenderer.invoke('project:restore', options),
  setProjectSession: (options) => ipcRenderer.invoke('project:session', options),
  saveProject: (options) => ipcRenderer.invoke('project:save', options),
  importImages: () => ipcRenderer.invoke('images:import'),
  saveFile: (options) => ipcRenderer.invoke('file:save', options),
  exportFile: (options) => ipcRenderer.invoke('file:save', options),
  onAutomationRequest: (handler) => {
    const listener = (_event, request) => handler(request);
    ipcRenderer.on('automation:request', listener);
    ipcRenderer.send('automation:ready', true);
    return () => { ipcRenderer.removeListener('automation:request', listener); ipcRenderer.send('automation:ready', false); };
  },
  replyAutomation: (reply) => ipcRenderer.send('automation:reply', reply),
});
