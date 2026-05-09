const {
  app, BrowserWindow, ipcMain, globalShortcut,
  Tray, Menu, nativeImage, shell
} = require('electron');
const path = require('path');
const fs   = require('fs');
const { exec } = require('child_process');

// ── MUST be before app.whenReady ─────────────────────────────────────────────
// Web Speech API (SpeechRecognition) requires these in Electron
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-speech-dispatcher');
// These flags make SpeechRecognition actually work inside Electron on Windows:
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
app.commandLine.appendSwitch('enable-features',  'WebSpeechAPI,SpeechRecognitionAPI');

// ── Config file (survives reinstalls — stored in AppData/Roaming/Nova) ────────
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
      webSecurity: false,  // needed so file:// can call Speech API without origin issues
    },
  });

  // Grant ALL media permissions automatically
  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ['media', 'microphone', 'audioCapture', 'speech', 'notifications'];
    callback(allowed.includes(permission));
  });

  win.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    return ['media', 'microphone', 'audioCapture', 'speech'].includes(permission);
  });

  // Allow mic access from file:// without user prompt
  win.webContents.session.setDevicePermissionHandler(() => true);

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => { win.show(); win.focus(); });
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
      { label: 'Open Nova',  click: () => { if (!win) createWindow(); else { win.show(); win.focus(); } } },
      { type: 'separator' },
      { label: 'Quit Nova',  click: () => app.quit() },
    ]));
  } catch { /* tray optional */ }
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

ipcMain.handle('config:get', () => readConfig());
ipcMain.handle('config:set', (_, data) => { writeConfig(data); return true; });

ipcMain.handle('shell:open', (_, url) => shell.openExternal(url));

// Launch system apps / programs via voice command
ipcMain.handle('exec:launch', (_, command) => {
  return new Promise((resolve) => {
    exec(command, { windowsHide: false }, (err) => {
      resolve(err ? { ok: false, error: err.message } : { ok: true });
    });
  });
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.on('window-all-closed', () => { if (!tray) app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
app.on('will-quit', () => globalShortcut.unregisterAll());

app.whenReady().then(() => {
  createWindow();
  createTray();
  globalShortcut.register('Alt+Space', toggleWindow);
});

// ── Tray icon (embedded base64 so no file needed) ─────────────────────────────
const TRAY_ICON_B64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAwklEQVQ4T2NkIBIwEqmPAacBd+7coVMqKir/GRgYGBiRJe/evfv/yZMnDAMDA4z////HqBseHh7GwMDAwMjIyMjg4OAweP78+f+hoaH/Hz9+/H9paen/8PDw/wDAwMD4+/fv/6mpqf+jo6MYTExMYoA5BISBQMDBuoHBQYGBgZGBgYGBgZGRkZGBgYGBgZGRkZGBgYGBgZGRkZGBgYGBgZGRkZGBgYGBgZGRkZGBgYGBgZGRkZGBgYGBgZGRkZGBgYFBAQAJUiAREI+EgAAAABJRU5ErkJggg==';
