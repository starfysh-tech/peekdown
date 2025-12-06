const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onFileContent: (callback) => {
    ipcRenderer.on('file-content', (_event, content, filename, is_pdf_mode) => {
      callback(content, filename, is_pdf_mode);
    });
  },

  onError: (callback) => {
    ipcRenderer.on('error', (_event, message) => {
      callback(message);
    });
  }
});
