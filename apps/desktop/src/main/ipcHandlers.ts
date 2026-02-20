import fs from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, clipboard, dialog, ipcMain, shell, Menu, MenuItem, Notification } from 'electron';
import type { BackupRecord, OptimiseSettings, PreviewResult, StartRunPayload } from '../shared/types';
import { analyzeImage } from './optimizer/analysis';
import { findOptimalQuality } from './optimizer/smartSearch';
import { toEffectiveSettings } from './optimizer/types';
import { getOutputFormatForPath } from './optimizer/candidates';
import { scanImageList } from './fileScanner';
import { executeRun, cancelRun } from './services/runService';
import type { WatchFolderService } from './watch/watcher';
import type { ClipboardWatcherService } from './clipboardWatcher';
import { Logger } from './logger';

const log = new Logger('Main');

// ─── Last Run State ──────────────────────────────────────────────────────────

interface LastRunState {
	runId: string;
	backupDir?: string;
	backupRecords: BackupRecord[];
	logPath: string;
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
			message: `Restore finished. Restored ${restored} file(s), failed ${failed}.`,
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

// ─── Timestamp ───────────────────────────────────────────────────────────────

function createTimestamp(): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

// ─── Register All Handlers ───────────────────────────────────────────────────

export function registerIpcHandlers(
	getMainWindow: () => BrowserWindow | null,
	getWatchService: () => WatchFolderService | null,
	getClipboardWatcher: () => ClipboardWatcherService | null,
): void {
	// ── Dialogs ──

	ipcMain.handle('dialog:select-folder', async () => {
		const win = getMainWindow();
		const result = await dialog.showOpenDialog(win!, {
			properties: ['openDirectory'],
		});
		return result.canceled ? null : result.filePaths[0] ?? null;
	});

	ipcMain.handle('dialog:select-files', async () => {
		const win = getMainWindow();
		const result = await dialog.showOpenDialog(win!, {
			properties: ['openFile', 'multiSelections'],
			filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
		});
		return result.canceled ? [] : result.filePaths;
	});

	// ── File Scanning ──

	ipcMain.handle('scan:paths', async (_event, paths: string[]) => scanImageList(paths));

	// ── Optimization Run ──

	ipcMain.handle('run:start', async (_event, payload: StartRunPayload) => {
		log.info(`IPC: run:start received (paths: ${payload.paths.length})`);
		getClipboardWatcher()?.configure(Boolean(payload.settings.optimizeClipboardImages), payload.settings);
		const runId = createTimestamp();
		// executeRun now expects (runId, payload, mainWindow, updateLastRunState)
		void executeRun(runId, payload, getMainWindow(), writeLastRunState);
		return { runId };
	});

	ipcMain.handle('run:cancel', async (_event, runId: string) => {
		cancelRun(runId);
	});

	// ── Restore ──

	ipcMain.handle('optimise:restore-last', async () => restoreLastRun());
	ipcMain.handle('optimise:can-restore-last', async () => canRestoreLastRun());
	ipcMain.handle('optimise:preview', async (_event, filePath: string, settings: OptimiseSettings) => {
		const originalBuffer = await fs.readFile(filePath);
		const effective = toEffectiveSettings(settings, 'smart');
		const type = getOutputFormatForPath(filePath);

		if (type === 'jpeg' || type === 'webp') {
			const features = await analyzeImage(originalBuffer);
			const res = await findOptimalQuality(filePath, originalBuffer, features, effective, type);
			if (res) {
				return {
					buffer: res.buffer,
					originalBuffer,
					size: res.buffer.length,
					quality: res.quality,
					ssim: res.metrics.mssim
				} as PreviewResult;
			}
		}

		return {
			buffer: originalBuffer,
			originalBuffer,
			size: originalBuffer.length,
			quality: 100,
			ssim: 1
		} as PreviewResult;
	});

	// ── File Operations ──

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

	// ── Clipboard Auto-Optimize ──

	ipcMain.handle('clipboard:auto-optimize', async (_event, payload: { enabled: boolean; settings: OptimiseSettings }) => {
		getClipboardWatcher()?.configure(payload.enabled, payload.settings);
	});

	// ── Watch Folders ──
	log.debug('Registering watch IPC handlers');
	ipcMain.handle('watch:add-folder', async (_event, folderPath: string) => {
		const ws = getWatchService();
		if (!ws) throw new Error('Watch service not initialized');
		return ws.addFolder(folderPath);
	});

	ipcMain.handle('watch:remove-folder', async (_event, folderPath: string) => {
		const ws = getWatchService();
		if (!ws) throw new Error('Watch service not initialized');
		return ws.removeFolder(folderPath);
	});

	ipcMain.handle('watch:list-folders', async () => {
		return getWatchService()?.listFolders() ?? [];
	});

	ipcMain.handle('watch:update-folder-settings', async (_event, folderPath: string, settings: any) => {
		const ws = getWatchService();
		if (!ws) throw new Error('Watch service not initialized');
		return ws.updateFolderSettings(folderPath, settings);
	});

	ipcMain.handle('watch:toggle-folder', async (_event, folderPath: string, enabled: boolean) => {
		const ws = getWatchService();
		if (!ws) throw new Error('Watch service not initialized');
		return ws.toggleFolder(folderPath, enabled);
	});

	ipcMain.handle('watch:get-global-settings', async () => {
		const ws = getWatchService();
		if (!ws) throw new Error('Watch service not initialized');
		return ws.getGlobalSettings();
	});

	ipcMain.handle('watch:update-global-settings', async (_event, settings: any) => {
		const ws = getWatchService();
		if (!ws) throw new Error('Watch service not initialized');
		return ws.updateGlobalSettings(settings);
	});

	// ── Notifications ──

	ipcMain.handle('notification:show', (_event, payload: { title: string; body?: string; silent?: boolean }) => {
		const iconPath = path.join(app.getAppPath(), 'resources', 'icon.png');
		const notification = new Notification({
			title: 'Crunch',
			subtitle: payload.title,
			body: payload.body,
			silent: payload.silent,
			icon: iconPath,
		});
		notification.show();
	});

	// ── Context Menu ──

	ipcMain.on('menu:row-context', (_event, paths: string[]) => {
		const menu = new Menu();
		const win = getMainWindow();

		menu.append(new MenuItem({
			label: 'Optimize Selected',
			click: () => win?.webContents.send('menu:action-optimize', paths),
		}));

		menu.append(new MenuItem({
			label: 'Convert to WebP',
			click: () => win?.webContents.send('menu:action-convert', paths),
		}));

		menu.append(new MenuItem({ type: 'separator' }));

		menu.append(new MenuItem({
			label: 'Reveal in Finder',
			click: () => {
				for (const target of paths) {
					shell.showItemInFolder(target);
				}
			},
		}));

		menu.append(new MenuItem({
			label: 'Remove from List',
			click: () => win?.webContents.send('menu:remove-items', paths),
		}));

		menu.popup({ window: win! });
	});
}
