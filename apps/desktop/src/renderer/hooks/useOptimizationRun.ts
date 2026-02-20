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
		const unsubUpdated = (window.api as any).onJobUpdated((event: any) => {
			if (!event.inputPath) return;

			setRowRuntime((prev) => {
				const current = prev[event.inputPath] || { beforeBytes: 0, status: 'Ready' };

				// Map status
				let status: FileStatus = 'Ready';
				if (event.status === 'running') status = 'Processing';
				if (event.status === 'success') status = 'Done';
				if (event.status === 'failed') status = 'Failed';
				if (event.status === 'cancelled') status = 'Cancelled';
				if (event.status === 'skipped') status = 'Skipped';

				const next = {
					...current,
					status,
					beforeBytes: event.result?.originalBytes || current.beforeBytes,
					afterBytes: event.result?.outputBytes || current.afterBytes,
					reason: event.result?.error?.message || event.progress?.stage || current.reason
				};

				return { ...prev, [event.inputPath]: next };
			});

			if (event.status === 'success' || event.status === 'failed' || event.status === 'skipped') {
				setProgress((prev) => ({
					...prev,
					done: prev.done + 1,
					savedBytes: prev.savedBytes + (event.result?.bytesSaved || 0)
				}));
			}
		});

		const unsubFinished = (window.api as any).onJobFinished((event: RunSummary) => {
			setBusy(false);
			setActiveRunId(null);
			setSummary(event);

			const elapsed = formatElapsed(event.elapsedMs);
			const savedBytes = event.totalSavedBytes;

			if (event.failedFiles > 0) {
				void window.api.notify('Completed with issues', `${event.failedFiles} failed • Saved ${formatBytes(savedBytes)} in ${elapsed}`);
			} else {
				void window.api.notify('Success', `Saved ${formatBytes(savedBytes)} in ${elapsed}`);
			}

			void refreshRestoreAvailability();
		});

		return () => {
			unsubUpdated();
			unsubFinished();
		};
	}, [setRowRuntime, refreshRestoreAvailability]);

	const run = async (runMode: RunMode, paths: string[]) => {
		if (busy || paths.length === 0) return;

		setBusy(true);
		setSummary(null);
		setRunBeforeBytes(
			paths.reduce((sum, itemPath) => {
				const file = files.find((entry) => entry.path === itemPath);
				return sum + (file?.size ?? 0);
			}, 0)
		);

		setProgress({ done: 0, total: paths.length, savedBytes: 0 });
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
