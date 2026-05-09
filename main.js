const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let win = null;
let tray = null;

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 680,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.on('closed', () => { win = null; });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) { createTrayFromEmpty(); return; }
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    setupTray();
  } catch {
    createTrayFromEmpty();
  }
}

function createTrayFromEmpty() {
  try {
    // Create a minimal 16x16 icon from data URI
    const icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADMSURBVDiNrdMxDoJAEAXQb2MsrLyHnkAaegsOYOEFhAMYKq2NlbWJhbGzsNVzAAktJCaEkH0WC3bBXTDbTDLJy8z8nQWAiJiZK2ZeSUJERADo3vsBYGutzVtrPwBYMfMEYA+gB1CZ2btzbgEgM7OImXNFRNLEBSTpb7zWejaze4BJ3gHoSZKkiLgFkCSp957XWs+SpHvPkqR7z5JkAGBdBwAbALMkI2aeJekJoHXOLQCsmXkCoABQAJSZRc65UlJpZp8A5a0P+3L1AI8kTwAAAABJRU5ErkJggg=='
    );
    tray = new Tray(icon);
    setupTray();
  } catch {
    // No tray — app still works from taskbar
  }
}

function setupTray() {
  if (!tray) return;
  tray.setToolTip('Nova Voice Assistant');
  tray.on('click', toggleWindow);
  const menu = Menu.buildFromTemplate([
    { label: 'Open Nova', click: () => { if (!win) createWindow(); else { win.show(); win.focus(); } } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

function toggleWindow() {
  if (!win) { createWindow(); return; }
  if (win.isVisible()) win.hide();
  else { win.show(); win.focus(); }
}

// IPC
ipcMain.handle('window:close', () => { if (win) win.hide(); });
ipcMain.handle('window:minimize', () => { if (win) win.minimize(); });

app.on('window-all-closed', () => {
  if (!tray) app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  globalShortcut.register('Alt+Space', () => toggleWindow());
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
