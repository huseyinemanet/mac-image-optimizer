import { contextBridge, ipcRenderer } from 'electron';
import type {
  ClipboardErrorEvent,
  ClipboardOptimizedEvent,
  ImageListItem,
  RunProgressEvent,
  StartRunPayload,
  StartRunResult,
  WatchFileDetectedEvent,
  WatchFileOptimizedEvent
} from '../shared/types';

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder') as Promise<string | null>,
  selectFiles: () => ipcRenderer.invoke('dialog:select-files') as Promise<string[]>,
  scanPaths: (paths: string[]) => ipcRenderer.invoke('scan:paths', paths) as Promise<ImageListItem[]>,
  startRun: (payload: StartRunPayload) => ipcRenderer.invoke('run:start', payload) as Promise<StartRunResult>,
  startOptimize: (payload: StartRunPayload) => ipcRenderer.invoke('optimize:start', payload) as Promise<StartRunResult>,
  cancelRun: (runId: string) => ipcRenderer.invoke('run:cancel', runId) as Promise<void>,
  cancelOptimize: (runId: string) => ipcRenderer.invoke('optimize:cancel', runId) as Promise<void>,
  onProgress: (cb: (event: RunProgressEvent) => void) => {
    const listener = (_event: unknown, payload: RunProgressEvent) => cb(payload);
    ipcRenderer.on('run:progress', listener);
    return () => {
      ipcRenderer.removeListener('run:progress', listener);
    };
  },
  addWatchFolder: (path: string) => ipcRenderer.invoke('watch:add-folder', path) as Promise<string[]>,
  removeWatchFolder: (path: string) => ipcRenderer.invoke('watch:remove-folder', path) as Promise<string[]>,
  listWatchFolders: () => ipcRenderer.invoke('watch:list-folders') as Promise<string[]>,
  onWatchFileDetected: (cb: (event: WatchFileDetectedEvent) => void) => {
    const listener = (_event: unknown, payload: WatchFileDetectedEvent) => cb(payload);
    ipcRenderer.on('watch:fileDetected', listener);
    return () => {
      ipcRenderer.removeListener('watch:fileDetected', listener);
    };
  },
  onWatchFileOptimized: (cb: (event: WatchFileOptimizedEvent) => void) => {
    const listener = (_event: unknown, payload: WatchFileOptimizedEvent) => cb(payload);
    ipcRenderer.on('watch:fileOptimized', listener);
    return () => {
      ipcRenderer.removeListener('watch:fileOptimized', listener);
    };
  },
  setClipboardAutoOptimize: (payload: { enabled: boolean; settings: StartRunPayload['settings'] }) =>
    ipcRenderer.invoke('clipboard:auto-optimize', payload) as Promise<void>,
  onClipboardOptimized: (cb: (event: ClipboardOptimizedEvent) => void) => {
    const listener = (_event: unknown, payload: ClipboardOptimizedEvent) => cb(payload);
    ipcRenderer.on('clipboard:optimized', listener);
    return () => {
      ipcRenderer.removeListener('clipboard:optimized', listener);
    };
  },
  onClipboardError: (cb: (event: ClipboardErrorEvent) => void) => {
    const listener = (_event: unknown, payload: ClipboardErrorEvent) => cb(payload);
    ipcRenderer.on('clipboard:error', listener);
    return () => {
      ipcRenderer.removeListener('clipboard:error', listener);
    };
  },
  restoreLastRun: () =>
    ipcRenderer.invoke('optimise:restore-last') as Promise<{ restoredCount: number; failedCount: number; message: string }>,
  canRestoreLastRun: () => ipcRenderer.invoke('optimise:can-restore-last') as Promise<boolean>,
  revealInFileManager: (paths: string[]) => ipcRenderer.invoke('file:reveal', paths) as Promise<void>,
  openPath: (path: string) => ipcRenderer.invoke('file:open', path) as Promise<void>,
  copyToClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text) as Promise<void>
});
