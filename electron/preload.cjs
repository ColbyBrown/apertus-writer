// Exposes a minimal, safe bridge for the renderer to make CORS-free requests,
// use native file dialogs, and receive application-menu actions.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aiBridge', {
  request: (args) => ipcRenderer.invoke('ai-request', args),
  chooseOpenPath: () => ipcRenderer.invoke('choose-open-path'),
  readFile: (args) => ipcRenderer.invoke('read-file', args),
  chooseSavePath: (args) => ipcRenderer.invoke('choose-save-path', args),
  chooseExportPath: (args) => ipcRenderer.invoke('choose-export-path', args),
  writeFile: (args) => ipcRenderer.invoke('write-file', args),
  exportPdfTo: (args) => ipcRenderer.invoke('export-pdf-to', args),
  printDocument: (args) => ipcRenderer.invoke('print-document', args),
  onMenuAction: (callback) => {
    const listener = (_event, action) => callback(action)
    ipcRenderer.on('menu-action', listener)
    return () => ipcRenderer.removeListener('menu-action', listener)
  },
})
