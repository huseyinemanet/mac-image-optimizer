import type { DragEventHandler, MouseEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FileStatus, ImageListItem, OptimiseSettings, RunMode, RunSummary } from '@/shared/types';
import { BottomBar } from './components/BottomBar';
import { DropZone } from './components/DropZone';
import { FileTable, type FileTableRow } from './components/FileTable';
import { RowContextMenu, type RowContextMenuState } from './components/RowContextMenu';
import { SettingsDialog } from './components/SettingsDialog';
import { ToastHost, useToastHost } from './components/ToastHost';
import { TopBar } from './components/TopBar';
import { formatBytes, formatElapsed, formatPercent, formatSizeCell } from './utils/format';

const defaultSettings: OptimiseSettings = {
  outputMode: 'subfolder',
  exportPreset: 'web',
  namingPattern: '{name}',
  keepMetadata: false,
  optimizeClipboardImages: false,
  jpegQuality: 82,
  webpNearLossless: true,
  webpQuality: 80,
  webpEffort: 5,
  reencodeExistingWebp: false,
  aggressivePng: false,
  concurrencyMode: 'auto',
  concurrencyValue: 3,
  allowLargerOutput: false,
  replaceWithWebp: false,
  confirmDangerousWebpReplace: false,
  deleteOriginalAfterWebp: false,
  qualityGuardrailSsim: false
};

interface RowRuntime {
  status: FileStatus;
  beforeBytes: number;
  afterBytes?: number;
  reason?: string;
}

function AppShell(): JSX.Element {
  const toast = useToastHost();

  const [inputs, setInputs] = useState<string[]>([]);
  const [files, setFiles] = useState<ImageListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<OptimiseSettings>(defaultSettings);
  const [mode, setMode] = useState<RunMode>('optimize');
  const [busy, setBusy] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<RowContextMenuState>({ open: false, x: 0, y: 0, targetPaths: [] });
  const [canRestore, setCanRestore] = useState(false);
  const [rowRuntime, setRowRuntime] = useState<Record<string, RowRuntime>>({});
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, savedBytes: 0 });
  const [dragActive, setDragActive] = useState(false);
  const [showDropHint, setShowDropHint] = useState(true);
  const [runBeforeBytes, setRunBeforeBytes] = useState(0);

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

  const refreshRestoreAvailability = async () => {
    const available = await window.api.canRestoreLastRun();
    setCanRestore(available);
  };

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

  useEffect(() => {
    void refreshRestoreAvailability();
  }, []);

  useEffect(() => {
    void window.api.setClipboardAutoOptimize({
      enabled: settings.optimizeClipboardImages,
      settings
    });
  }, [settings]);

  useEffect(() => {
    const offOptimized = window.api.onClipboardOptimized((event) => {
      const sign = event.savedPercent > 0 ? '-' : '';
      toast.notify(`Optimized clipboard image (${sign}${event.savedPercent}%)`, undefined, 'success');
    });

    const offError = window.api.onClipboardError((event) => {
      toast.notify('Clipboard optimize error', event.message, 'info');
    });

    return () => {
      offOptimized();
      offError();
    };
  }, [toast]);

  useEffect(() => {
    const unsub = window.api.onProgress((event) => {
      if (event.file) {
        setRowRuntime((prev) => ({
          ...prev,
          [event.file.path]: {
            status: event.file.status,
            beforeBytes: event.file.beforeBytes,
            afterBytes: event.file.afterBytes > 0 ? event.file.afterBytes : undefined,
            reason: event.file.message
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
            toast.notify('Completed with issues', `${failedCount} failed • Saved ${formatBytes(savedBytes)} (${percentSaved}%) in ${elapsed}`, 'info', {
              label: 'View report',
              onClick: () => {
                void window.api.openPath(event.summary!.logPath);
              }
            });
          } else if (savedBytes > 0) {
            toast.notify(`Saved ${formatBytes(savedBytes)} (${percentSaved}%) in ${elapsed}`, undefined, 'success');
          } else if (savedBytes === 0 && skippedCount === totalCount) {
            toast.notify('No savings (all skipped)', `Skipped ${skippedCount} files`, 'info');
          } else {
            toast.notify('Completed (no savings)', `${doneCount} processed in ${elapsed}`, 'info');
          }
        }
        void refreshRestoreAvailability();
      }
    });

    return () => unsub();
  }, [toast]);

  const run = async (runMode: RunMode, paths: string[]) => {
    if (busy || paths.length === 0) {
      return;
    }

    if (settings.replaceWithWebp && !settings.confirmDangerousWebpReplace) {
      toast.notify('Settings required', 'Confirm dangerous replace in settings first.', 'error');
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

  const onSelect = (path: string, event: MouseEvent<HTMLTableRowElement>) => {
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

  const onOpenContextMenu = (path: string, event: MouseEvent<HTMLTableRowElement>) => {
    event.preventDefault();

    let targetPaths: string[];
    if (selected.size > 0 && selected.has(path)) {
      targetPaths = Array.from(selected);
    } else {
      targetPaths = [path];
      setSelected(new Set([path]));
    }

    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      targetPaths
    });
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

  const onDrop: DragEventHandler<HTMLDivElement> = async (event) => {
    event.preventDefault();
    setDragActive(false);
    setShowDropHint(false);
    const dropped = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path)
      .filter((item): item is string => Boolean(item));
    await addPaths(dropped);
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const savedPercent = runBeforeBytes > 0 ? Math.round((progress.savedBytes / runBeforeBytes) * 100) : 0;

  const summaryLine = useMemo(() => {
    if (busy) {
      return `Processing… ${progress.done}/${progress.total}`;
    }

    if (summary) {
      const savedBytes = summary.totalSavedBytes;
      const percentSaved = summary.totalOriginalBytes > 0 ? Math.round((savedBytes / summary.totalOriginalBytes) * 100) : 0;
      const elapsed = formatElapsed(summary.elapsedMs);
      if (summary.failedFiles > 0) {
        return `Completed with issues • ${summary.failedFiles} failed • ${elapsed}`;
      }
      if (savedBytes > 0) {
        return `Saved ${formatBytes(savedBytes)} (${percentSaved}%) • ${elapsed}`;
      }
      if (summary.skippedFiles === summary.totalFiles) {
        return `No savings (all skipped) • ${summary.skippedFiles} skipped • ${elapsed}`;
      }
      return `Completed (no savings) • ${summary.processedFiles} processed • ${elapsed}`;
    }

    return `${files.length} files • ${formatBytes(selectedBytes)} selected${selected.size > 0 ? ` • ${selected.size} selected` : ''}`;
  }, [busy, files.length, progress.done, progress.total, selected.size, selectedBytes, summary]);

  return (
    <div className="window">
      <div
        className="app-shell grid h-full grid-rows-[auto_1fr_auto] gap-2 p-3"
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
      >
        <TopBar
          busy={busy}
          showRestore={canRestore}
          onPickFolder={() => {
            void window.api.selectFolder().then((picked) => {
              if (picked) {
                void addPaths([picked]);
              }
            });
          }}
          onPickFiles={() => {
            void window.api.selectFiles().then((picked) => {
              void addPaths(picked);
            });
          }}
          onRestore={() => {
            void window.api.restoreLastRun().then((result) => {
              toast.notify('Restore', result.message, result.failedCount > 0 ? 'error' : 'success');
              void refreshRestoreAvailability();
              void refreshFiles(inputs);
            });
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="card min-h-0 rounded-xl p-2">
          {files.length === 0 ? (
            <DropZone
              isDragActive={dragActive}
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
            />
          ) : (
            <FileTable
              rows={rows}
              selected={selected}
              onSelect={onSelect}
              onContextMenu={onOpenContextMenu}
              showDropHint={showDropHint && !dragActive}
            />
          )}
        </main>

        <BottomBar
          summaryLine={summaryLine}
          busy={busy}
          done={progress.done}
          savedText={formatBytes(progress.savedBytes)}
          savedPercent={savedPercent}
          progressPercent={progressPercent}
          mode={mode}
          canRun={targets.length > 0}
          onModeChange={setMode}
          onRun={() => void run(mode, targets)}
          onCancel={() => {
            if (activeRunId) {
              void window.api.cancelRun(activeRunId);
            }
          }}
        />

        <RowContextMenu
          state={contextMenu}
          onClose={() => setContextMenu((prev) => ({ ...prev, open: false }))}
          onOptimize={(paths) => {
            void run('optimize', paths);
          }}
          onConvert={(paths) => {
            void run('convertWebp', paths);
          }}
          onReveal={(paths) => {
            void window.api.revealInFileManager(paths);
          }}
          onRemove={removeFromList}
        />

        <SettingsDialog open={settingsOpen} runMode={mode} settings={settings} onClose={() => setSettingsOpen(false)} onChange={setSettings} />
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <ToastHost>
      <AppShell />
    </ToastHost>
  );
}
