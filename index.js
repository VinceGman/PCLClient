const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("checking-for-update", () => {
  console.log("Checking for updates...");
});

autoUpdater.on("update-available", (info) => {
  console.log("Update available:", info.version);
});

autoUpdater.on("update-not-available", () => {
  console.log("PCLClient is up to date.");
});

autoUpdater.on("download-progress", (progress) => {
  console.log(`Downloading update: ${Math.round(progress.percent)}%`);
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("Update downloaded:", info.version);
});

autoUpdater.on("error", (error) => {
  console.error("Updater error:", error);
});

const fs = require("fs");
const path = require("path");

const dataDirectory = path.join(app.getPath("userData"), "data");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: __dirname + "/preload.js",
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile("index.html");
}

ipcMain.on("toggle-fullscreen", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.setFullScreen(!win.isFullScreen());
});

ipcMain.on("quit-app", () => {
  app.quit();
});

ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates();
});

ipcMain.on('download-update', () => {
    autoUpdater.downloadUpdate();
});

ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdates();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
