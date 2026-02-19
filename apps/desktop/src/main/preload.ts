import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  ClipboardErrorEvent,
  ClipboardOptimizedEvent,
  ImageListItem,
  RunProgressEvent,
  StartRunPayload,
  StartRunResult,
  WatchFileDetectedEvent,
  WatchFileOptimizedEvent,
} from '../shared/types';

/** Creates a typed IPC event listener with proper cleanup. */
function createListener<T>(channel: string) {
  return (cb: (payload: T) => void) => {
    const listener = (_event: unknown, payload: T) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  };
}

contextBridge.exposeInMainWorld('api', {
  // ── Utilities ──
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  // ── Dialogs ──
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder') as Promise<string | null>,
  selectFiles: () => ipcRenderer.invoke('dialog:select-files') as Promise<string[]>,

  // ── File Scanning ──
  scanPaths: (paths: string[]) => ipcRenderer.invoke('scan:paths', paths) as Promise<ImageListItem[]>,

  // ── Optimization Run ──
  startRun: (payload: StartRunPayload) => ipcRenderer.invoke('run:start', payload) as Promise<StartRunResult>,
  cancelRun: (runId: string) => ipcRenderer.invoke('run:cancel', runId) as Promise<void>,
  onProgress: createListener<RunProgressEvent>('run:progress'),

  // ── Restore ──
  restoreLastRun: () =>
    ipcRenderer.invoke('optimise:restore-last') as Promise<{ restoredCount: number; failedCount: number; message: string }>,
  canRestoreLastRun: () => ipcRenderer.invoke('optimise:can-restore-last') as Promise<boolean>,

  // ── File Operations ──
  revealInFileManager: (paths: string[]) => ipcRenderer.invoke('file:reveal', paths) as Promise<void>,
  openPath: (path: string) => ipcRenderer.invoke('file:open', path) as Promise<void>,
  copyToClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text) as Promise<void>,

  // ── Notifications ──
  notify: (title: string, body?: string, silent?: boolean) =>
    ipcRenderer.invoke('notification:show', { title, body, silent }) as Promise<void>,

  // ── Watch Folders ──
  addWatchFolder: (path: string) => ipcRenderer.invoke('watch:add-folder', path) as Promise<string[]>,
  removeWatchFolder: (path: string) => ipcRenderer.invoke('watch:remove-folder', path) as Promise<string[]>,
  listWatchFolders: () => ipcRenderer.invoke('watch:list-folders') as Promise<string[]>,
  onWatchFileDetected: createListener<WatchFileDetectedEvent>('watch:fileDetected'),
  onWatchFileOptimized: createListener<WatchFileOptimizedEvent>('watch:fileOptimized'),

  // ── Clipboard Auto-Optimize ──
  setClipboardAutoOptimize: (payload: { enabled: boolean; settings: StartRunPayload['settings'] }) =>
    ipcRenderer.invoke('clipboard:auto-optimize', payload) as Promise<void>,
  onClipboardOptimized: createListener<ClipboardOptimizedEvent>('clipboard:optimized'),
  onClipboardError: createListener<ClipboardErrorEvent>('clipboard:error'),

  // ── Logging ──
  onLog: createListener<{ level: string; context: string; message: string; args: any[] }>('app:log'),

  // ── Context Menu ──
  showRowContextMenu: (paths: string[]) => ipcRenderer.send('menu:row-context', paths),
  onRemoveItems: createListener<string[]>('menu:remove-items'),
  onActionOptimize: createListener<string[]>('menu:action-optimize'),
  onActionConvert: createListener<string[]>('menu:action-convert'),
  onActionReveal: createListener<string[]>('menu:action-reveal'),
});
