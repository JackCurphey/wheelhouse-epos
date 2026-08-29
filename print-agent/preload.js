const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('printAgent', {
  getStatus: () => ipcRenderer.invoke('agent:getStatus'),
  login: (email, password) => ipcRenderer.invoke('agent:login', email, password),
  logout: () => ipcRenderer.invoke('agent:logout'),
  onStatusChanged: (callback) => ipcRenderer.on('status-changed', callback),
});
