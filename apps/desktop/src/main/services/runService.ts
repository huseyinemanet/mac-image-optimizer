import path from 'node:path';
import fs from 'node:fs/promises';
import type { ActionResult, BackupRecord, FileStatus, ResponsiveResult, RunMode, RunProgressEvent, RunSummary, StartRunPayload, WorkerTask } from '../../shared/types';
import { resolveInputPaths } from '../fileScanner';
import { Logger } from '../logger';
import { getAutoConcurrency, WorkerPool } from '../optimizer/workerPool';
import { BrowserWindow } from 'electron';

interface RunLogEntry {
	originalPath: string;
	originalBytes: number;
	actions: {
		optimised?: ActionResult;
		webp?: ActionResult;
		responsive?: ResponsiveResult;
	};
	status: 'success' | 'skipped' | 'failed';
	reason?: string;
}

interface RunControl {
	cancelled: boolean;
}

const activeRuns = new Map<string, RunControl>();
const log = new Logger('RunService');

function getCommonBaseDir(paths: string[]): string {
	if (paths.length === 0) {
		// Fallback if no paths (unlikely in a run)
		return '/'; // Or app.getPath('documents') if we had access to app here easily, but '/' is safe enough for common base calc
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

function emitProgress(mainWindow: BrowserWindow | null, event: RunProgressEvent): void {
	mainWindow?.webContents.send('run:progress', event);
}

function inferFileStatus(mode: RunMode, actions: { optimised?: ActionResult; webp?: ActionResult; responsive?: ResponsiveResult }): FileStatus {
	const primary = mode === 'convertWebp' ? actions.webp : mode === 'optimize' ? actions.optimised : mode === 'responsive' ? actions.responsive : actions.webp ?? actions.optimised;
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

function actionForMode(mode: RunMode, actions: { optimised?: ActionResult; webp?: ActionResult; responsive?: ResponsiveResult }): ActionResult | ResponsiveResult | undefined {
	if (mode === 'optimize') {
		return actions.optimised;
	}
	if (mode === 'convertWebp') {
		return actions.webp;
	}
	if (mode === 'responsive') {
		return actions.responsive;
	}
	return actions.webp ?? actions.optimised;
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
	if (!control) {
		return;
	}

	const settings = payload.settings;
	const start = Date.now();
	log.info(`Starting run ${runId} (Mode: ${payload.mode}, Output: ${settings.outputMode})`);
	const resolved = await resolveInputPaths(payload.paths);
	log.info(`Resolved ${resolved.length} paths to process for run ${runId}`);
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
		emitProgress(mainWindow, {
			runId,
			overall: {
				total,
				done,
				failed,
				skipped,
				savedBytes,
				savedByMetadataBytes: 0,
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
					log.error(`File failed: ${response.inputPath} - ${response.message}`);
					failures.push({ path: response.inputPath, message: response.message });
					logEntries.push({
						originalPath: response.inputPath,
						originalBytes: 0,
						actions: {},
						status: 'failed',
						reason: response.message
					});
					sendFileProgress(response.inputPath, 'Failed', 0, 0, `Failed: ${response.message}`);
					continue;
				}

				backupRecords.push(...response.backups);

				const relevantAction = actionForMode(payload.mode, response.actions);
				if (response.actions.webp?.status === 'success') {
					converted += 1;
				}

				const originalBytes = response.originalBytes;
				let outputBytes = originalBytes;

				if (payload.mode === 'responsive') {
					const res = response.actions.responsive;
					if (res?.status === 'success') {
						outputBytes = res.derivatives.reduce((acc, d) => acc + d.size, 0);
					}
				} else {
					const act = relevantAction as ActionResult;
					outputBytes = act?.status === 'success' ? act.outputBytes : originalBytes;
				}

				const bytesSaved = Math.max(0, originalBytes - outputBytes);

				totalOriginalBytes += originalBytes;
				totalOutputBytes += outputBytes;
				savedBytes += bytesSaved;

				log.debug(`Processed ${path.basename(response.inputPath)}: ${originalBytes} -> ${outputBytes} (${bytesSaved} saved)`);

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
		totalSavedByMetadataBytes: 0,
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

	await updateLastRunState({ runId, backupDir, backupRecords, logPath });

	log.info(`Run ${runId} completed. Summary: ${summary.processedFiles} processed, ${summary.convertedFiles} converted, ${summary.skippedFiles} skipped, ${summary.failedFiles} failed. Saved ${summary.totalSavedBytes} bytes.`);

	emitProgress(mainWindow, {
		runId,
		overall: {
			total,
			done,
			failed,
			skipped,
			savedBytes: summary.totalSavedBytes,
			savedByMetadataBytes: summary.totalSavedByMetadataBytes ?? 0,
			elapsedMs: summary.elapsedMs
		},
		finished: true,
		cancelled: control.cancelled,
		summary
	});

	activeRuns.delete(runId);
}
