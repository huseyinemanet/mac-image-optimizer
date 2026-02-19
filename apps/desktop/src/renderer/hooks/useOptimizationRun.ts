import { useState, useEffect } from 'react';
import type { OptimiseSettings, RunMode, RunSummary, ImageListItem, FileStatus } from '@/shared/types';
import { formatBytes, formatElapsed } from '../utils/format';

interface UseOptimizationRunProps {
	files: ImageListItem[];
	settings: OptimiseSettings;
	setRowRuntime: React.Dispatch<React.SetStateAction<Record<string, {
		status: FileStatus;
		beforeBytes: number;
		afterBytes?: number;
		reason?: string;
	}>>>;
	refreshRestoreAvailability: () => void;
}

export function useOptimizationRun({ files, settings, setRowRuntime, refreshRestoreAvailability }: UseOptimizationRunProps) {
	const [busy, setBusy] = useState(false);
	const [activeRunId, setActiveRunId] = useState<string | null>(null);
	const [summary, setSummary] = useState<RunSummary | null>(null);
	const [progress, setProgress] = useState({ done: 0, total: 0, savedBytes: 0 });
	const [runBeforeBytes, setRunBeforeBytes] = useState(0);

	useEffect(() => {
		const unsub = window.api.onProgress((event) => {
			if (event.file) {
				const file = event.file;
				setRowRuntime((prev) => ({
					...prev,
					[file.path]: {
						status: file.status,
						beforeBytes: file.beforeBytes,
						afterBytes: file.afterBytes > 0 ? file.afterBytes : undefined,
						reason: file.message
					}
				}));
			}

			setProgress({
				done: event.overall.done,
				total: event.overall.total,
				savedBytes: event.overall.savedBytes
			});

			if (event.finished) {
				setBusy(false);
				setActiveRunId(null);
				if (event.summary) {
					setSummary(event.summary);
					const savedBytes = event.summary.totalSavedBytes;
					const totalCount = event.summary.totalFiles;
					const doneCount = event.summary.processedFiles;
					const skippedCount = event.summary.skippedFiles;
					const failedCount = event.summary.failedFiles;
					const elapsed = formatElapsed(event.summary.elapsedMs);
					const percentSaved = event.summary.totalOriginalBytes > 0 ? Math.round((savedBytes / event.summary.totalOriginalBytes) * 100) : 0;

					if (failedCount > 0) {
						void window.api.notify('Completed with issues', `${failedCount} failed • Saved ${formatBytes(savedBytes)} (${percentSaved}%) in ${elapsed}`);
					} else if (savedBytes > 0) {
						void window.api.notify('Success', `Saved ${formatBytes(savedBytes)} (${percentSaved}%) in ${elapsed}`);
					} else if (savedBytes === 0 && skippedCount === totalCount) {
						void window.api.notify('No savings (all skipped)', `Skipped ${skippedCount} files`);
					} else {
						void window.api.notify('Completed (no savings)', `${doneCount} processed in ${elapsed}`);
					}
				}
				void refreshRestoreAvailability();
			}
		});

		return () => unsub();
	}, [setRowRuntime, refreshRestoreAvailability]);

	const run = async (runMode: RunMode, paths: string[]) => {
		if (busy || paths.length === 0) {
			return;
		}

		if (settings.replaceWithWebp && !settings.confirmDangerousWebpReplace) {
			void window.api.notify('Settings required', 'Confirm dangerous replace in settings first.');
			return;
		}

		setBusy(true);
		setSummary(null);
		setRunBeforeBytes(
			paths.reduce((sum, itemPath) => {
				const file = files.find((entry) => entry.path === itemPath);
				return sum + (file?.size ?? 0);
			}, 0)
		);
		const { runId } = await window.api.startRun({ paths, mode: runMode, settings });
		setActiveRunId(runId);
	};

	const cancel = () => {
		if (activeRunId) {
			void window.api.cancelRun(activeRunId);
		}
	};

	return {
		busy,
		activeRunId,
		summary,
		progress,
		runBeforeBytes,
		run,
		cancel
	};
}
