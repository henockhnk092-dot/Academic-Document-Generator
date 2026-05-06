// Preload script for Electron
// This runs in a sandboxed context with limited Node.js access

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  // Add any additional APIs you need to expose to the renderer
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
