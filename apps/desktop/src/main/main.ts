import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import { WatchFolderService } from './watch/watcher';
import { ClipboardWatcherService } from './clipboardWatcher';
import { Logger } from './logger';
import { registerIpcHandlers } from './ipcHandlers';

const log = new Logger('Main');

app.setName('Crunch');
process.title = 'Crunch';
if (process.platform === 'win32') {
  app.setAppUserModelId('com.crunch.app');
}

let mainWindow: BrowserWindow | null = null;
let watchService: WatchFolderService | null = null;
let clipboardWatcher: ClipboardWatcherService | null = null;

function createWindow(iconPath: string): void {
  mainWindow = new BrowserWindow({
    width: 774,
    height: 568,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    closable: true,
    minimizable: true,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    transparent: true,
    backgroundColor: '#00000000',
    trafficLightPosition: { x: 16, y: 16 },
    title: 'Crunch',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.on('maximize', () => mainWindow?.unmaximize());
  mainWindow.on('enter-full-screen', () => mainWindow?.setFullScreen(false));
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────

registerIpcHandlers(
  () => mainWindow,
  () => watchService,
  () => clipboardWatcher,
);

app.whenReady().then(async () => {
  const iconPath = path.join(__dirname, '..', '..', 'resources', 'icon.png');

  if (process.platform === 'darwin') {
    const icnsPath = path.join(__dirname, '..', '..', 'resources', 'icon.icns');
    try {
      app.dock?.setIcon(icnsPath);
    } catch (err) {
      log.warn('Failed to set dock icon', err);
    }
  }

  app.setAboutPanelOptions({
    applicationName: 'Crunch',
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: `Copyright © ${new Date().getFullYear()} Crunch`,
    iconPath: iconPath,
  });
  createWindow(iconPath);

  Logger.setListener((level, context, message, ...args) => {
    mainWindow?.webContents.send('app:log', { level, context, message, args });
  });

  watchService = new WatchFolderService(
    app.getPath('userData'),
    (payload) => mainWindow?.webContents.send('watch:fileDetected', payload),
    (payload) => mainWindow?.webContents.send('watch:fileOptimized', payload),
  );
  await watchService.init();

  clipboardWatcher = new ClipboardWatcherService(
    (payload) => mainWindow?.webContents.send('clipboard:optimized', payload),
    (payload) => mainWindow?.webContents.send('clipboard:error', payload),
  );
  clipboardWatcher.start();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const iconPath = path.join(__dirname, '..', '..', 'resources', 'icon.png');
    createWindow(iconPath);
  }
});

app.on('before-quit', async () => {
  if (watchService) await watchService.close();
  if (clipboardWatcher) clipboardWatcher.stop();
});
