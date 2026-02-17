import fs from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron';
import type {
  ActionResult,
  BackupRecord,
  FileStatus,
  OptimiseSettings,
  RunMode,
  RunProgressEvent,
  RunSummary,
  StartRunPayload,
  WorkerTask
} from '../shared/types';
import { resolveInputPaths, scanImageList } from './fileScanner';
import { getAutoConcurrency, WorkerPool } from './optimizer/workerPool';
import { WatchFolderService } from './watch/watcher';
import { ClipboardWatcherService } from './clipboardWatcher';

interface LastRunState {
  runId: string;
  backupDir?: string;
  backupRecords: BackupRecord[];
  logPath: string;
}

interface RunLogEntry {
  originalPath: string;
  originalBytes: number;
  actions: {
    optimised?: ActionResult;
    webp?: ActionResult;
  };
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
}

interface RunControl {
  cancelled: boolean;
}

let mainWindow: BrowserWindow | null = null;
const activeRuns = new Map<string, RunControl>();
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

function getCommonBaseDir(paths: string[]): string {
  if (paths.length === 0) {
    return app.getPath('documents');
  }

  const resolved = paths.map((item) => path.resolve(item));
  let common = path.dirname(resolved[0]);

  for (let i = 1; i < resolved.length; i += 1) {
    const current = path.dirname(resolved[i]);
    while (!current.startsWith(common) && common.length > path.parse(common).root.length) {
      common = path.dirname(common);
    }
  }

  return common;
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

function emitProgress(event: RunProgressEvent): void {
  mainWindow?.webContents.send('run:progress', event);
}

function inferFileStatus(mode: RunMode, actions: { optimised?: ActionResult; webp?: ActionResult }): FileStatus {
  const primary = mode === 'convertWebp' ? actions.webp : mode === 'optimize' ? actions.optimised : actions.webp ?? actions.optimised;
  if (!primary) {
    return 'Skipped';
  }

  if (primary.status === 'failed') {
    return 'Failed';
  }

  if (primary.status === 'skipped') {
    return 'Skipped';
  }
  return 'Done';
}

function actionForMode(mode: RunMode, actions: { optimised?: ActionResult; webp?: ActionResult }): ActionResult | undefined {
  if (mode === 'optimize') {
    return actions.optimised;
  }
  if (mode === 'convertWebp') {
    return actions.webp;
  }
  return actions.webp ?? actions.optimised;
}

async function executeRun(runId: string, payload: StartRunPayload): Promise<void> {
  const control = activeRuns.get(runId);
  if (!control) {
    return;
  }

  const settings = payload.settings;
  const start = Date.now();
  const resolved = await resolveInputPaths(payload.paths);
  const total = resolved.length;

  const commonRoot = getCommonBaseDir(resolved);
  const backupDir = settings.outputMode === 'replace' ? path.join(commonRoot, 'Originals Backup', runId) : undefined;
  const logPath = path.join(commonRoot, '.optimise-logs', runId, 'optimise-log.json');

  if (backupDir) {
    await fs.mkdir(backupDir, { recursive: true });
  }

  const concurrency = settings.concurrencyMode === 'auto' ? getAutoConcurrency() : Math.max(1, settings.concurrencyValue);
  const pool = new WorkerPool(concurrency);

  let index = 0;
  let done = 0;
  let skipped = 0;
  let failed = 0;
  let converted = 0;
  let totalOriginalBytes = 0;
  let totalOutputBytes = 0;
  let savedBytes = 0;

  const failures: Array<{ path: string; message: string }> = [];
  const backupRecords: BackupRecord[] = [];
  const logEntries: RunLogEntry[] = [];

  const sendFileProgress = (
    filePath: string,
    status: FileStatus,
    beforeBytes: number,
    afterBytes: number,
    message?: string
  ) => {
    emitProgress({
      runId,
      overall: {
        total,
        done,
        failed,
        skipped,
        savedBytes,
        elapsedMs: Date.now() - start
      },
      file: {
        path: filePath,
        status,
        beforeBytes,
        afterBytes,
        savedBytes: beforeBytes - afterBytes,
        message
      }
    });
  };

  try {
    const workers = Array.from({ length: concurrency }, async () => {
      while (true) {
        if (control.cancelled) {
          break;
        }

        if (index >= resolved.length) {
          break;
        }

        const nextPath = resolved[index];
        index += 1;

        sendFileProgress(nextPath, 'Processing', 0, 0, 'Processing');

        const task: WorkerTask = {
          inputPath: nextPath,
          settings,
          backupDir,
          commonRoot,
          mode: payload.mode
        };

        const response = await pool.run(task);
        done += 1;

        if (!response.ok) {
          failed += 1;
          failures.push({ path: response.inputPath, message: response.message });
          logEntries.push({
            originalPath: response.inputPath,
            originalBytes: 0,
            actions: {},
            status: 'failed',
            reason: response.message
          });
          sendFileProgress(response.inputPath, 'Failed', 0, 0, 'Processing failed');
          continue;
        }

        backupRecords.push(...response.backups);

        const relevantAction = actionForMode(payload.mode, response.actions);
        if (response.actions.webp?.status === 'success') {
          converted += 1;
        }

        const originalBytes = relevantAction?.originalBytes ?? response.originalBytes;
        const outputBytes = relevantAction?.outputBytes ?? response.originalBytes;
        const bytesSaved = Math.max(0, originalBytes - outputBytes);

        totalOriginalBytes += originalBytes;
        totalOutputBytes += outputBytes;
        savedBytes += bytesSaved;

        const status = inferFileStatus(payload.mode, response.actions);
        if (status === 'Skipped' || status === 'Cancelled') {
          skipped += 1;
        }

        logEntries.push({
          originalPath: response.inputPath,
          originalBytes: response.originalBytes,
          actions: response.actions,
          status: response.status,
          reason: relevantAction?.reason
        });

        sendFileProgress(response.inputPath, status, originalBytes, outputBytes, relevantAction?.reason);
      }
    });

    await Promise.all(workers);

    if (control.cancelled && index < resolved.length) {
      while (index < resolved.length) {
        const cancelledPath = resolved[index];
        index += 1;
        done += 1;
        skipped += 1;
        sendFileProgress(cancelledPath, 'Cancelled', 0, 0, 'Cancelled by user');
      }
    }
  } finally {
    await pool.close();
  }

  const summary: RunSummary = {
    runId,
    totalFiles: total,
    processedFiles: done,
    convertedFiles: converted,
    skippedFiles: skipped,
    failedFiles: failed,
    totalOriginalBytes,
    totalOutputBytes,
    totalSavedBytes: Math.max(0, totalOriginalBytes - totalOutputBytes),
    elapsedMs: Date.now() - start,
    logPath,
    failures
  };

  await writeJson(logPath, {
    runId,
    mode: payload.mode,
    settings,
    startedAt: new Date(start).toISOString(),
    finishedAt: new Date().toISOString(),
    cancelled: control.cancelled,
    summary,
    entries: logEntries
  });

  await writeJson(getLastRunFilePath(), { runId, backupDir, backupRecords, logPath } satisfies LastRunState);

  emitProgress({
    runId,
    overall: {
      total,
      done,
      failed,
      skipped,
      savedBytes: summary.totalSavedBytes,
      elapsedMs: summary.elapsedMs
    },
    finished: true,
    cancelled: control.cancelled,
    summary
  });

  activeRuns.delete(runId);
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

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
  watchService?.updateRunPreferences(payload.settings, payload.mode);
  clipboardWatcher?.configure(Boolean(payload.settings.optimizeClipboardImages), payload.settings);
  const runId = createTimestamp();
  activeRuns.set(runId, { cancelled: false });
  void executeRun(runId, payload);
  return { runId };
});

ipcMain.handle('optimize:start', async (_event, payload: StartRunPayload) => {
  watchService?.updateRunPreferences(payload.settings, payload.mode);
  clipboardWatcher?.configure(Boolean(payload.settings.optimizeClipboardImages), payload.settings);
  const runId = createTimestamp();
  activeRuns.set(runId, { cancelled: false });
  void executeRun(runId, payload);
  return { runId };
});

ipcMain.handle('run:cancel', async (_event, runId: string) => {
  const active = activeRuns.get(runId);
  if (active) {
    active.cancelled = true;
  }
});

ipcMain.handle('optimize:cancel', async (_event, runId: string) => {
  const active = activeRuns.get(runId);
  if (active) {
    active.cancelled = true;
  }
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
