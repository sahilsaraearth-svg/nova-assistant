const {
  app, BrowserWindow, ipcMain, globalShortcut,
  Tray, Menu, nativeImage, session, shell
} = require('electron');
const path = require('path');
const fs   = require('fs');

// ── Config file for persistent settings (survives reinstalls) ─────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'nova-config.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return {}; }
}
function writeConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

let win  = null;
let tray = null;

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 700,
    frame: false,
    // NO transparent — causes blank window on many Windows setups
    transparent: false,
    backgroundColor: '#0d0d1a',
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Required for speech + mic in Electron
      webSecurity: true,
    },
  });

  // ── Grant mic permission automatically ──────────────────────────────────────
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
      callback(true);
    } else {
      callback(false);
    }
  });

  win.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
      return true;
    }
    return false;
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.on('closed', () => { win = null; });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  try {
    const icon = nativeImage.createFromDataURL(TRAY_ICON_B64);
    tray = new Tray(icon);
    tray.setToolTip('Nova Voice Assistant');
    tray.on('click', toggleWindow);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Nova', click: () => { if (!win) createWindow(); else { win.show(); win.focus(); } } },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
  } catch(e) {
    // tray fails silently
  }
}

function toggleWindow() {
  if (!win) { createWindow(); return; }
  if (win.isVisible()) win.hide();
  else { win.show(); win.focus(); }
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle('window:close',    () => win?.hide());
ipcMain.handle('window:minimize', () => win?.minimize());
ipcMain.handle('window:toggle',   () => toggleWindow());

// Persistent config (userData dir — survives reinstalls)
ipcMain.handle('config:get', () => readConfig());
ipcMain.handle('config:set', (_, data) => { writeConfig(data); return true; });

// Open external links
ipcMain.handle('shell:open', (_, url) => shell.openExternal(url));

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.on('window-all-closed', () => { if (!tray) app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
app.on('will-quit', () => globalShortcut.unregisterAll());

app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Allow MediaRecorder + getUserMedia in Electron
app.commandLine.appendSwitch('enable-media-stream');

app.whenReady().then(() => {
  createWindow();
  createTray();
  globalShortcut.register('Alt+Space', toggleWindow);
});

// ── Tray icon (embedded so no file needed) ────────────────────────────────────
const TRAY_ICON_B64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAwklEQVQ4T2NkIBIwEqmPAacBd+7coVMqKir/GRgYGBiRJe/evfv/yZMnDAMDA4z////HqBseHh7GwMDAwMjIyMjg4OAweP78+f+hoaH/Hz9+/H9paen/8PDw/wDAwMD4+/fv/6mpqf+jo6MYTExMYoA5BISBQMDBuoHBQYGBgZGBgYGBgZGRkZGBgYGBgZGRkZGBgYGBgZGRkZGBgYGBgZGRkZGBgYGBgZGRkZGBgYGBgZGRkZGBgYGBgZGRkZGBgYFBAQAJUiAREI+EgAAAABJRU5ErkJggg==';
