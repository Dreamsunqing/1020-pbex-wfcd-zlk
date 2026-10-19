const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('workbench', {
  call: (method, args) => ipcRenderer.invoke('workbench:call', method, args),
  chooseRoot: () => ipcRenderer.invoke('workbench:choose-root'),
  exportFile: args => ipcRenderer.invoke('workbench:export', args),
  copy: text => ipcRenderer.invoke('workbench:copy', text),
  onEvent: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('workbench:event', listener); return () => ipcRenderer.removeListener('workbench:event', listener); }
});
