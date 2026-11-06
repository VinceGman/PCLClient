const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

const fs = require("fs");
const path = require("path");

const dataDirectory = path.join(app.getPath("userData"), "data");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: __dirname, "src/helpers/preload.js",
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    win.webContents.send("update-status", "Checking for updates...");
  });

  autoUpdater.on("update-available", () => {
    win.webContents.send("update-status", "Downloading update...");
  });

  autoUpdater.on("update-downloaded", () => {
    win.webContents.send("update-status", "Installing update...");

    autoUpdater.quitAndInstall(true, true);
  });

  autoUpdater.on("update-not-available", () => {
    win.webContents.send("update-status", "up-to-date");
  });

  autoUpdater.on("download-progress", (progress) => {
    console.log("Download:", progress.percent);

    win.webContents.send("update-progress", Math.round(progress.percent));
  });

  autoUpdater.on("error", (error) => {
    console.error("Updater error:", error);
  });

  win.loadFile("src/views/index.html");
}

ipcMain.on("toggle-fullscreen", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.setFullScreen(!win.isFullScreen());
});

ipcMain.on("quit-app", () => {
  app.quit();
});

ipcMain.on("check-for-updates", () => {
  autoUpdater.checkForUpdates();
});

ipcMain.on("download-update", () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle("get-app-version", () => app.getVersion());

// win.webContents.send("transfer-data", data);

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdates();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
