const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  toggleFullscreen: () => ipcRenderer.send("toggle-fullscreen"),
  quitApp: () => ipcRenderer.send("quit-app"),
  checkForUpdates: () => ipcRenderer.send("check-for-updates"),
  downloadUpdate: () => ipcRenderer.send("download-update"),
  installUpdate: () => ipcRenderer.send("install-update"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  onUpdateProgress: (callback) =>
    ipcRenderer.on("update-progress", (event, percent) => callback(percent)),
  onUpdateStatus: (callback) =>
    ipcRenderer.on("update-status", (event, status) => callback(status)),
  onUpdateStatus: (callback) =>
    ipcRenderer.on("update-status", (event, status) => callback(status)),
});
