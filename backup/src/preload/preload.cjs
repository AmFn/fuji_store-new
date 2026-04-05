const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Example method
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Add more methods as needed
});
