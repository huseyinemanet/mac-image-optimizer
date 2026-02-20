import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
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
let tray: Tray | null = null;
let isQuitting = false;

function getIconPath(): string {
  const candidates = [
    path.join(app.getAppPath(), 'resources', 'icon.png'),
    path.join(process.resourcesPath, 'icon.png'),
    path.join(__dirname, '..', '..', 'resources', 'icon.png'),
    path.join(__dirname, '..', '..', '..', 'resources', 'icon.png'),
  ];
  const hit = candidates.find((candidate) => fs.existsSync(candidate));
  if (hit) return hit;
  return candidates[0];
}

function getIcnsPath(): string {
  const candidates = [
    path.join(app.getAppPath(), 'resources', 'icon.icns'),
    path.join(process.resourcesPath, 'icon.icns'),
    path.join(__dirname, '..', '..', 'resources', 'icon.icns'),
    path.join(__dirname, '..', '..', '..', 'resources', 'icon.icns'),
  ];
  const hit = candidates.find((candidate) => fs.existsSync(candidate));
  if (hit) return hit;
  return candidates[0];
}

function showMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function openSettingsWindow(): void {
  if (!mainWindow) return;
  showMainWindow();
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('menu:open-settings');
    });
    return;
  }
  mainWindow.webContents.send('menu:open-settings');
}

function updateTrayMenu(): void {
  if (!tray) return;

  const watchingEnabled = watchService?.getGlobalSettings().watchEnabled ?? true;
  const windowVisible = Boolean(mainWindow?.isVisible());

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: windowVisible ? 'Hide Window' : 'Open Window',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
          return;
        }
        showMainWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        openSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: watchingEnabled ? 'Pause Watching' : 'Resume Watching',
      enabled: Boolean(watchService),
      click: () => {
        const service = watchService;
        if (!service) return;
        const settings = service.getGlobalSettings();
        void service.updateGlobalSettings({ ...settings, watchEnabled: !settings.watchEnabled })
          .then(() => updateTrayMenu())
          .catch((error) => log.error('Failed to toggle watch state from tray', error));
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Crunch',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
}

function createTray(iconPath: string): void {
  if (tray) return;

  const baseIcon = nativeImage.createFromPath(iconPath);
  const trayIcon = baseIcon.resize({ width: 18, height: 18 });
  tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
  if (process.platform === 'darwin' && !trayIcon.isEmpty()) {
    trayIcon.setTemplateImage(true);
    tray.setImage(trayIcon);
  }
  if (trayIcon.isEmpty()) {
    log.warn(`Tray icon could not be loaded from: ${iconPath}`);
    tray.setTitle('CR');
  }
  tray.setToolTip('Crunch');
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      showMainWindow();
    }
    updateTrayMenu();
  });
  updateTrayMenu();
}

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
      scrollBounce: process.platform === 'darwin',
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
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
    updateTrayMenu();
  });
  mainWindow.on('show', () => updateTrayMenu());
  mainWindow.on('hide', () => updateTrayMenu());
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────

registerIpcHandlers(
  () => mainWindow,
  () => watchService,
  () => clipboardWatcher,
);

app.whenReady().then(async () => {
  const iconPath = getIconPath();

  if (process.platform === 'darwin') {
    const icnsPath = getIcnsPath();
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
  createTray(iconPath);

  Logger.setListener((level, context, message, ...args) => {
    mainWindow?.webContents.send('app:log', { level, context, message, args });
  });

  watchService = new WatchFolderService(
    app.getPath('userData'),
    (payload) => mainWindow?.webContents.send('watch:fileDetected', payload),
    (payload) => mainWindow?.webContents.send('watch:fileOptimized', payload),
  );
  await watchService.init();
  updateTrayMenu();

  clipboardWatcher = new ClipboardWatcherService(
    (payload) => mainWindow?.webContents.send('clipboard:optimized', payload),
    (payload) => mainWindow?.webContents.send('clipboard:error', payload),
  );
  clipboardWatcher.start();
});

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const iconPath = getIconPath();
    createWindow(iconPath);
    updateTrayMenu();
    return;
  }
  showMainWindow();
});

app.on('before-quit', async () => {
  isQuitting = true;
  if (watchService) await watchService.close();
  if (clipboardWatcher) clipboardWatcher.stop();
});
