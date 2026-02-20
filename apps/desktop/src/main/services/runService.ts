import path from 'node:path';
import fs from 'node:fs/promises';
import { BrowserWindow } from 'electron';
import type { BackupRecord, RunSummary, StartRunPayload } from '../../shared/types';
import { resolveInputPaths } from '../fileScanner';
import { Logger } from '../logger';
import { getAutoConcurrency, WorkerPool } from '../optimizer/workerPool';
import { runTask } from '../core/pipeline';
import { JobStateMachine } from '../core/jobs';
import { IPC_EVENTS, type JobUpdatePayload } from '../../shared/ipcEvents';

const log = new Logger('RunService');
const activeRuns = new Map<string, { cancelled: boolean }>();

function emitJobUpdate(mainWindow: BrowserWindow | null, payload: JobUpdatePayload): void {
	mainWindow?.webContents.send(IPC_EVENTS.JOB_UPDATED, payload);
}

export function cancelRun(runId: string) {
	const active = activeRuns.get(runId);
	if (active) {
		active.cancelled = true;
	}
}

export async function executeRun(
	runId: string,
	payload: StartRunPayload,
	mainWindow: BrowserWindow | null,
	updateLastRunState: (state: { runId: string, backupDir?: string, backupRecords: BackupRecord[], logPath: string }) => Promise<void>
): Promise<void> {
	activeRuns.set(runId, { cancelled: false });
	const control = activeRuns.get(runId);
	if (!control) return;

	const start = Date.now();
	const resolved = await resolveInputPaths(payload.paths);
	const total = resolved.length;

	const commonRoot = getCommonBaseDir(resolved);
	const backupDir = payload.settings.outputMode === 'replace' ? path.join(commonRoot, 'Originals Backup', runId) : undefined;
	const logPath = path.join(commonRoot, '.optimise-logs', runId, 'optimise-log.json');

	if (backupDir) {
		await fs.mkdir(backupDir, { recursive: true });
	}

	const concurrency = payload.settings.concurrencyMode === 'auto' ? getAutoConcurrency() : Math.max(1, payload.settings.concurrencyValue);
	const pool = new WorkerPool(concurrency);

	let done = 0;
	let skipped = 0;
	let failed = 0;
	let totalSavedBytes = 0;
	let totalOriginalBytes = 0;
	let totalOutputBytes = 0;
	let convertedFiles = 0;
	const backupRecords: BackupRecord[] = [];

	try {
		const processPromises = resolved.map(async (inputPath) => {
			if (control.cancelled) return;

			const state = new JobStateMachine({
				id: Math.random().toString(36).slice(2, 9),
				inputPath,
				settings: { ...payload.settings, mode: payload.mode },
				backupDir,
				commonRoot
			});

			state.on('change', (event) => {
				emitJobUpdate(mainWindow, {
					jobId: event.jobId,
					inputPath: inputPath,
					status: event.status,
					progress: event.progress,
					result: event.result ? {
						outputPath: event.result.outputPath,
						originalBytes: event.result.originalBytes,
						outputBytes: event.result.outputBytes,
						bytesSaved: event.result.bytesSaved,
						error: event.result.error ? {
							code: event.result.error.code,
							message: event.result.error.message
						} : undefined
					} : undefined
				});
			});

			const result = await runTask(state.task, state);

			done++;
			totalOriginalBytes += result.originalBytes;
			totalOutputBytes += result.outputBytes;
			if (result.status === 'success') {
				totalSavedBytes += result.bytesSaved;
				if (result.outputPath?.toLowerCase().endsWith('.webp')) {
					convertedFiles += 1;
				}
			} else if (result.status === 'failed') {
				failed++;
			} else if (result.status === 'skipped') {
				skipped++;
			}
			if (result.backupPath) {
				backupRecords.push({ originalPath: inputPath, backupPath: result.backupPath });
			}
		});

		await Promise.all(processPromises);

	} finally {
		await pool.close();
	}

	const summary: RunSummary = {
	runId,
	totalFiles: total,
	processedFiles: done,
	convertedFiles,
	skippedFiles: skipped,
	failedFiles: failed,
	totalOriginalBytes,
	totalOutputBytes,
	totalSavedBytes,
	elapsedMs: Date.now() - start,
	logPath,
	failures: []
};

	await updateLastRunState({
		runId,
		backupDir,
		backupRecords,
		logPath
	});

	mainWindow?.webContents.send(IPC_EVENTS.JOB_FINISHED, summary);
	activeRuns.delete(runId);
}

function getCommonBaseDir(paths: string[]): string {
	if (paths.length === 0) return '/';
	const resolved = paths.map((item) => path.resolve(item));
	let common = path.dirname(resolved[0]);
	for (let i = 1; i < resolved.length; i++) {
		const current = path.dirname(resolved[i]);
		while (!current.startsWith(common) && common.length > path.parse(common).root.length) {
			common = path.dirname(common);
		}
	}
	return common;
}
