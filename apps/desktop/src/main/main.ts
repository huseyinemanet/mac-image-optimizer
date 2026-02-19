import fs from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell, Menu, MenuItem, Notification } from 'electron';
import type {
  BackupRecord,
  OptimiseSettings,
  StartRunPayload
} from '../shared/types';
import { scanImageList } from './fileScanner';
import { executeRun, cancelRun } from './services/runService';
import { WatchFolderService } from './watch/watcher';
import { ClipboardWatcherService } from './clipboardWatcher';
import { Logger } from './logger';

const log = new Logger('Main');

interface LastRunState {
  runId: string;
  backupDir?: string;
  backupRecords: BackupRecord[];
  logPath: string;
}

let mainWindow: BrowserWindow | null = null;
let watchService: WatchFolderService | null = null;
let clipboardWatcher: ClipboardWatcherService | null = null;

function createTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function getLastRunFilePath(): string {
  return path.join(app.getPath('userData'), 'last-run.json');
}

async function writeLastRunState(state: LastRunState): Promise<void> {
  const filePath = getLastRunFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
}


async function restoreLastRun(): Promise<{ restoredCount: number; failedCount: number; message: string }> {
  try {
    const raw = await fs.readFile(getLastRunFilePath(), 'utf-8');
    const state = JSON.parse(raw) as LastRunState;

    if (!state.backupRecords.length) {
      return { restoredCount: 0, failedCount: 0, message: 'No backup records found for last run.' };
    }

    let restored = 0;
    let failed = 0;

    for (const record of state.backupRecords) {
      try {
        if (record.removeOnRestore) {
          await fs.rm(record.removeOnRestore, { force: true });
        }

        const tempPath = `${record.originalPath}.restore.tmp`;
        await fs.copyFile(record.backupPath, tempPath);
        await fs.rename(tempPath, record.originalPath);
        restored += 1;
      } catch {
        failed += 1;
      }
    }

    return {
      restoredCount: restored,
      failedCount: failed,
      message: `Restore finished. Restored ${restored} file(s), failed ${failed}.`
    };
  } catch {
    return { restoredCount: 0, failedCount: 0, message: 'No previous run backup data available.' };
  }
}

async function canRestoreLastRun(): Promise<boolean> {
  try {
    const raw = await fs.readFile(getLastRunFilePath(), 'utf-8');
    const state = JSON.parse(raw) as LastRunState;
    return state.backupRecords.length > 0;
  } catch {
    return false;
  }
}

function createWindow(): void {
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
    title: 'Image Optimizer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.on('maximize', () => {
    mainWindow?.unmaximize();
  });

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.setFullScreen(false);
  });
}

app.whenReady().then(async () => {
  createWindow();

  Logger.setListener((level, context, message, ...args) => {
    mainWindow?.webContents.send('app:log', { level, context, message, args });
  });

  watchService = new WatchFolderService(
    app.getPath('userData'),
    (payload) => {
      mainWindow?.webContents.send('watch:fileDetected', payload);
    },
    (payload) => {
      mainWindow?.webContents.send('watch:fileOptimized', payload);
    }
  );

  await watchService.init();

  clipboardWatcher = new ClipboardWatcherService(
    (payload) => {
      mainWindow?.webContents.send('clipboard:optimized', payload);
    },
    (payload) => {
      mainWindow?.webContents.send('clipboard:error', payload);
    }
  );
  clipboardWatcher.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// macOS: app stays alive when all windows are closed (reopens via 'activate')

app.on('before-quit', async () => {
  if (watchService) {
    await watchService.close();
  }
  if (clipboardWatcher) {
    clipboardWatcher.stop();
  }
});

ipcMain.handle('dialog:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle('dialog:select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('scan:paths', async (_event, paths: string[]) => scanImageList(paths));

ipcMain.handle('run:start', async (_event, payload: StartRunPayload) => {
  log.info(`IPC: run:start received (paths: ${payload.paths.length})`);
  watchService?.updateRunPreferences(payload.settings, payload.mode);
  clipboardWatcher?.configure(Boolean(payload.settings.optimizeClipboardImages), payload.settings);
  const runId = createTimestamp();
  void executeRun(runId, payload, mainWindow, writeLastRunState);
  return { runId };
});

ipcMain.handle('optimize:start', async (_event, payload: StartRunPayload) => {
  log.info(`IPC: optimize:start received (paths: ${payload.paths.length})`);
  watchService?.updateRunPreferences(payload.settings, payload.mode);
  clipboardWatcher?.configure(Boolean(payload.settings.optimizeClipboardImages), payload.settings);
  const runId = createTimestamp();
  void executeRun(runId, payload, mainWindow, writeLastRunState);
  return { runId };
});

ipcMain.handle('run:cancel', async (_event, runId: string) => {
  cancelRun(runId);
});

ipcMain.handle('optimize:cancel', async (_event, runId: string) => {
  cancelRun(runId);
});

ipcMain.handle('optimise:restore-last', async () => restoreLastRun());
ipcMain.handle('optimise:can-restore-last', async () => canRestoreLastRun());
ipcMain.handle('file:reveal', async (_event, paths: string[]) => {
  for (const target of paths) {
    shell.showItemInFolder(target);
  }
});
ipcMain.handle('file:open', async (_event, targetPath: string) => {
  await shell.openPath(targetPath);
});
ipcMain.handle('clipboard:write', async (_event, value: string) => {
  clipboard.writeText(value);
});

ipcMain.handle('clipboard:auto-optimize', async (_event, payload: { enabled: boolean; settings: OptimiseSettings }) => {
  clipboardWatcher?.configure(payload.enabled, payload.settings);
});

ipcMain.handle('watch:add-folder', async (_event, folderPath: string) => {
  if (!watchService) {
    throw new Error('Watch service not initialized');
  }
  return watchService.addFolder(folderPath);
});

ipcMain.handle('watch:remove-folder', async (_event, folderPath: string) => {
  if (!watchService) {
    throw new Error('Watch service not initialized');
  }
  return watchService.removeFolder(folderPath);
});

ipcMain.handle('watch:list-folders', async () => {
  return watchService?.listFolders() ?? [];
});

ipcMain.handle('notification:show', (_event, payload: { title: string; body?: string; silent?: boolean }) => {
  const notification = new Notification({
    title: payload.title,
    body: payload.body,
    silent: payload.silent
  });
  notification.show();
});
ipcMain.on('menu:row-context', (_event, paths: string[]) => {
  const menu = new Menu();

  menu.append(new MenuItem({
    label: 'Optimize Selected',
    click: () => {
      mainWindow?.webContents.send('menu:action-optimize', paths);
    }
  }));

  menu.append(new MenuItem({
    label: 'Convert to WebP',
    click: () => {
      mainWindow?.webContents.send('menu:action-convert', paths);
    }
  }));

  menu.append(new MenuItem({ type: 'separator' }));

  menu.append(new MenuItem({
    label: 'Reveal in Finder',
    click: () => {
      for (const target of paths) {
        shell.showItemInFolder(target);
      }
    }
  }));

  menu.append(new MenuItem({
    label: 'Remove from List',
    click: () => {
      mainWindow?.webContents.send('menu:remove-items', paths);
    }
  }));

  menu.popup({ window: mainWindow! });
});
