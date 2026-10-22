const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('workbench', {
  call: (method, args) => ipcRenderer.invoke('workbench:call', method, args),
  chooseRoot: () => ipcRenderer.invoke('workbench:choose-root'),
  importOracleState: args => ipcRenderer.invoke('workbench:oracle-state', args),
  exportFile: args => ipcRenderer.invoke('workbench:export', args),
  exportRules: args => ipcRenderer.invoke('workbench:rules-export', args),
  exportMerged: args => ipcRenderer.invoke('workbench:merge-export', args),
  images: requests => ipcRenderer.invoke('workbench:images', requests),
  imageStatus: () => ipcRenderer.invoke('workbench:image-status'),
  chooseImages: () => ipcRenderer.invoke('workbench:choose-images'),
  copy: text => ipcRenderer.invoke('workbench:copy', text),
  theme: value => ipcRenderer.invoke('workbench:theme', value),
  galleryAction: (action, args) => ipcRenderer.invoke('workbench:gallery-action', action, args),
  openDocumentLink: url => ipcRenderer.invoke('workbench:document-link', url),
  onEvent: callback => { const listener = (_event, value) => callback(value); ipcRenderer.on('workbench:event', listener); return () => ipcRenderer.removeListener('workbench:event', listener); }
});
