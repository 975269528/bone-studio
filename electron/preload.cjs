const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('boneStudio', {
  openProject: () => ipcRenderer.invoke('project:open'),
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
