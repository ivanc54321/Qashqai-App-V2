const { app, BrowserWindow, session, shell, powerSaveBlocker } = require('electron');
const path = require('path');

let wakeBlockerId = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 360,
    title: 'Qashqai App V2',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open external links (e.g. Google Maps "Start GPS") in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  win.loadFile(indexPath);
}

app.whenReady().then(() => {
  // Keep display awake for in-car Windows tablet / car PC usage
  wakeBlockerId = powerSaveBlocker.start('prevent-display-sleep');

  // Allow GPS, camera (Reverse Assist), and audio/media inside the dashboard
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['geolocation', 'media', 'mediaKeySystem', 'fullscreen', 'notifications'];
    callback(allowed.includes(permission));
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (wakeBlockerId !== null && powerSaveBlocker.isStarted(wakeBlockerId)) {
    powerSaveBlocker.stop(wakeBlockerId);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
