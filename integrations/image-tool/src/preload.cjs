'use strict';
const { contextBridge, ipcRenderer } = require('electron');
async function call(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
contextBridge.exposeInMainWorld('guide', Object.freeze({
  load: () => call('catalog'),
  copyName: (id, kind) => call('copy-name', id, kind),
  copyImage: id => call('copy-image', id),
  imageInfo: id => call('image-info', id),
  saveImage: (id, naming) => call('save-image', id, naming),
  exportImages: (ids, naming) => call('export-images', ids, naming),
  cancelExport: () => call('cancel-export'),
  openExportFolder: () => call('open-export-folder'),
  saveSettings: value => call('settings', value),
  onProgress: callback => ipcRenderer.on('export-progress', (_event, value) => callback(value)),
  onExportClose: callback => ipcRenderer.on('close-during-export', () => callback())
}));
