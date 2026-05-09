const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  config: {
    get: ()       => ipcRenderer.invoke('config:get'),
    set: (data)   => ipcRenderer.invoke('config:set', data),
  },
  window: {
    close:    () => ipcRenderer.invoke('window:close'),
    minimize: () => ipcRenderer.invoke('window:minimize'),
  },
  shell: {
    open: (url) => ipcRenderer.invoke('shell:open', url),
  },
});
