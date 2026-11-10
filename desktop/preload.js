// Only the local setup / offline pages get this bridge; the platform itself runs with no Node access.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("afmi", {
  saveUrl: (url) => ipcRenderer.invoke("afmi:save-url", url),
  currentUrl: () => ipcRenderer.invoke("afmi:current-url"),
  retry: () => ipcRenderer.invoke("afmi:retry"),
  language: () => ipcRenderer.invoke("afmi:language"),
});
