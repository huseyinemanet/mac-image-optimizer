import type { DragEventHandler, MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { OptimiseSettings, RunMode } from '@/shared/types';
import { DEFAULT_SETTINGS } from '@/shared/types';
import { BottomBar } from './components/BottomBar';
import { DropZone } from './components/DropZone';
import { FileTable } from './components/FileTable';
import { SettingsDialog } from './components/SettingsDialog';
import { ProgressOverlay } from './components/ProgressOverlay';
import { Sidebar } from './components/Sidebar';
import { formatBytes, formatElapsed } from './utils/format';
import { useFileManagement } from './hooks/useFileManagement';
import { useOptimizationRun } from './hooks/useOptimizationRun';

export function AppShell(): React.JSX.Element {

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<OptimiseSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<RunMode>('optimize');
  const [canRestore, setCanRestore] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showDropHint, setShowDropHint] = useState(true);

  const {
    inputs,
    files,
    selected,
    rowRuntime,
    setRowRuntime,
    selectedBytes,
    rows,
    targets,
    addPaths,
    refreshFiles,
    onSelect,
    selectAll,
    removeFromList,
    setSelected
  } = useFileManagement();

  const refreshRestoreAvailability = async () => {
    const available = await window.api.canRestoreLastRun();
    setCanRestore(available);
  };

  const { busy, activeRunId, summary, progress, runBeforeBytes, run, cancel } = useOptimizationRun({
    files,
    settings,
    setRowRuntime,
    refreshRestoreAvailability
  });

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
      void window.api.notify(`Optimized clipboard image (${sign}${event.savedPercent}%)`);
    });

    const offError = window.api.onClipboardError((event) => {
      void window.api.notify('Clipboard optimize error', event.message);
    });

    return () => {
      offOptimized();
      offError();
    };
  }, []);

  useEffect(() => {
    const offLog = window.api.onLog?.((payload) => {
      const { level, context, message, args } = payload;
      const prefix = `[Main] [${context}]`;
      if (level === 'error') {
        console.error(prefix, message, ...args);
      } else if (level === 'warn') {
        console.warn(prefix, message, ...args);
      } else {
        console.log(prefix, message, ...args);
      }
    });

    return () => {
      offLog?.();
    };
  }, []);

  // Handle Native context menu removals and actions
  useEffect(() => {
    const offRemove = window.api.onRemoveItems?.((paths: string[]) => {
      removeFromList(paths);
    });

    const offActionOpt = window.api.onActionOptimize?.((paths: string[]) => {
      void run('optimize', paths);
    });

    const offActionConv = window.api.onActionConvert?.((paths: string[]) => {
      void run('convertWebp', paths);
    });

    const offActionRev = window.api.onActionReveal?.((paths: string[]) => {
      void window.api.revealInFileManager(paths);
    });

    return () => {
      offRemove?.();
      offActionOpt?.();
      offActionConv?.();
      offActionRev?.();
    };
  }, [removeFromList, run]);

  const onOpenContextMenu = (path: string, event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    let targetPaths: string[];
    if (selected.size > 0 && selected.has(path)) {
      targetPaths = Array.from(selected);
    } else {
      targetPaths = [path];
      setSelected(new Set([path]));
    }

    window.api.showRowContextMenu?.(targetPaths);
  };

  const onDragEnter: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  const onDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const onDrop: DragEventHandler<HTMLDivElement> = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    setShowDropHint(false);

    const files = Array.from(event.dataTransfer.files);
    const dropped = files
      .map((file) => window.api.getPathForFile(file))
      .filter((item): item is string => Boolean(item));

    if (dropped.length > 0) {
      await addPaths(dropped);
    }
  };

  // Prevent default browser behavior for drag and drop globally
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      // Don't log dragover as it's too noisy, but ensure it's prevented
      e.preventDefault();
    };
    const onGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', onGlobalDrop);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', onGlobalDrop);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        const active = document.activeElement;
        const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active as HTMLElement)?.isContentEditable;
        if (!isInput && files.length > 0) {
          e.preventDefault();
          selectAll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [files.length, selectAll]);

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
      <div className="app-shell">
        <Sidebar
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
              void window.api.notify('Restore', result.message);
              void refreshRestoreAvailability();
              void refreshFiles(inputs);
            });
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div
          className="content-area"
          onDragOver={onDragOver}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <main className="flex-1 flex flex-col min-h-0 w-full">
            {files.length === 0 ? (
              <DropZone
                isDragActive={dragActive}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              />
            ) : (
              <FileTable
                rows={rows}
                selected={selected}
                onSelect={onSelect}
                onContextMenu={onOpenContextMenu}
                setSelected={setSelected}
                showDropHint={showDropHint && !dragActive}
              />
            )}
          </main>

          <ProgressOverlay
            busy={busy}
            progressPercent={progressPercent}
            done={progress.done}
            total={progress.total}
            savedText={formatBytes(progress.savedBytes)}
            savedPercent={savedPercent}
            onCancel={() => {
              if (activeRunId) {
                void window.api.cancelRun(activeRunId);
              }
            }}
          />

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
        </div>

        <SettingsDialog open={settingsOpen} runMode={mode} settings={settings} onClose={() => setSettingsOpen(false)} onChange={setSettings} />
      </div>
    </div>
  );
}

export default function App(): React.JSX.Element {
  return <AppShell />;
}
