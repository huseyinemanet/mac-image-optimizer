import { useRef, useState, useMemo, type MouseEvent } from 'react';
import type { ImageListItem, FileStatus } from '@/shared/types';
import { formatSizeCell, formatPercent } from '../utils/format';
import type { FileTableRow } from '../components/FileTable';

interface RowRuntime {
	status: FileStatus;
	beforeBytes: number;
	afterBytes?: number;
	reason?: string;
}

export function useFileManagement() {
	const [inputs, setInputs] = useState<string[]>([]);
	const [files, setFiles] = useState<ImageListItem[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [rowRuntime, setRowRuntime] = useState<Record<string, RowRuntime>>({});

	const lastSelectedRef = useRef<string | null>(null);

	const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
	const selectedPaths = useMemo(() => Array.from(selected), [selected]);
	const targets = selectedPaths.length > 0 ? selectedPaths : files.map((file) => file.path);

	const selectedBytes = useMemo(() => {
		if (selected.size === 0) {
			return totalBytes;
		}
		return files.reduce((sum, file) => (selected.has(file.path) ? sum + file.size : sum), 0);
	}, [files, selected, totalBytes]);

	const rows = useMemo<FileTableRow[]>(
		() =>
			files.map((file) => {
				const runtime = rowRuntime[file.path] ?? { status: 'Ready', beforeBytes: file.size };
				const before = runtime.beforeBytes || file.size;
				const after = runtime.afterBytes;
				return {
					id: file.path,
					path: file.path,
					name: file.name,
					type: file.ext,
					sizeText: formatSizeCell({
						status: runtime.status,
						beforeBytes: before,
						afterBytes: after
					}),
					status: runtime.status,
					percentSaved: typeof after === 'number' ? formatPercent(before, after) : undefined,
					reason: runtime.reason
				};
			}),
		[files, rowRuntime]
	);

	const refreshFiles = async (nextInputs: string[]) => {
		if (nextInputs.length === 0) {
			setFiles([]);
			setSelected(new Set());
			setRowRuntime({});
			return;
		}

		const scanned = await window.api.scanPaths(nextInputs);
		setFiles(scanned);
		setSelected(new Set());
		setRowRuntime(Object.fromEntries(scanned.map((item) => [item.path, { status: 'Ready', beforeBytes: item.size, reason: 'Ready to process' }])));
	};

	const addPaths = async (nextPaths: string[]) => {
		if (nextPaths.length === 0) {
			return;
		}
		const merged = Array.from(new Set([...inputs, ...nextPaths]));
		setInputs(merged);
		await refreshFiles(merged);
	};

	const onSelect = (path: string, event: MouseEvent<HTMLElement>) => {
		const isMeta = event.metaKey || event.ctrlKey;
		const isShift = event.shiftKey;

		setSelected((prev) => {
			if (isShift && lastSelectedRef.current) {
				const order = files.map((file) => file.path);
				const start = order.indexOf(lastSelectedRef.current);
				const end = order.indexOf(path);
				if (start !== -1 && end !== -1) {
					const [from, to] = start < end ? [start, end] : [end, start];
					const next = new Set(prev);
					for (let i = from; i <= to; i += 1) {
						next.add(order[i]);
					}
					return next;
				}
			}

			if (isMeta) {
				const next = new Set(prev);
				if (next.has(path)) {
					next.delete(path);
				} else {
					next.add(path);
				}
				lastSelectedRef.current = path;
				return next;
			}

			lastSelectedRef.current = path;
			return new Set([path]);
		});
	};

	const selectAll = () => {
		setSelected(new Set(files.map((file) => file.path)));
	};

	const removeFromList = (paths: string[]) => {
		const removeSet = new Set(paths);
		setFiles((prev) => prev.filter((item) => !removeSet.has(item.path)));
		setSelected((prev) => {
			const next = new Set(prev);
			for (const item of paths) {
				next.delete(item);
			}
			return next;
		});
		setRowRuntime((prev) => {
			const next = { ...prev };
			for (const item of paths) {
				delete next[item];
			}
			return next;
		});
	};

	return {
		inputs,
		files,
		selected,
		rowRuntime,
		setRowRuntime,
		totalBytes,
		selectedBytes,
		rows,
		targets,
		addPaths,
		refreshFiles,
		onSelect,
		selectAll,
		removeFromList,
		setSelected // exported if needed by consumers like context menu
	};
}
