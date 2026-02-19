export type SupportedImageType = 'jpeg' | 'png' | 'webp';

export type OutputMode = 'replace' | 'subfolder';
export type RunMode = 'optimize' | 'convertWebp' | 'optimizeAndWebp';
export type ExportPreset = 'original' | 'web' | 'design';

export type FileStatus =
  | 'Ready'
  | 'Processing'
  | 'Done'
  | 'Skipped'
  | 'Failed'
  | 'Cancelled';

export interface OptimiseSettings {
  outputMode: OutputMode;
  exportPreset: ExportPreset;
  namingPattern: string;
  keepMetadata: boolean;
  optimizeClipboardImages: boolean;
  jpegQuality: number;
  webpNearLossless: boolean;
  webpQuality: number;
  webpEffort: number;
  reencodeExistingWebp: boolean;
  aggressivePng: boolean;
  concurrencyMode: 'auto' | 'manual';
  concurrencyValue: number;
  allowLargerOutput: boolean;
  replaceWithWebp: boolean;
  confirmDangerousWebpReplace: boolean;
  deleteOriginalAfterWebp: boolean;
  qualityGuardrailSsim: boolean;
}

export interface StartRunPayload {
  paths: string[];
  settings: OptimiseSettings;
  mode: RunMode;
}

export interface ImageListItem {
  path: string;
  name: string;
  size: number;
  ext: string;
  width: number;
  height: number;
}

export interface RunOverallProgress {
  total: number;
  done: number;
  failed: number;
  skipped: number;
  savedBytes: number;
  elapsedMs: number;
}

export interface RunFileProgress {
  path: string;
  status: FileStatus;
  beforeBytes: number;
  afterBytes: number;
  savedBytes: number;
  message?: string;
}

export interface RunSummary {
  runId: string;
  totalFiles: number;
  processedFiles: number;
  convertedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  totalOriginalBytes: number;
  totalOutputBytes: number;
  totalSavedBytes: number;
  elapsedMs: number;
  logPath: string;
  failures: Array<{ path: string; message: string }>;
}

export interface RunProgressEvent {
  runId: string;
  overall: RunOverallProgress;
  file?: RunFileProgress;
  finished?: boolean;
  cancelled?: boolean;
  summary?: RunSummary;
}

export interface StartRunResult {
  runId: string;
}

export interface WatchFileDetectedEvent {
  folder: string;
  path: string;
}

export interface WatchFileOptimizedEvent {
  folder: string;
  path: string;
  status: 'success' | 'skipped' | 'failed';
  beforeBytes: number;
  afterBytes: number;
  savedBytes: number;
  message?: string;
}

export interface ClipboardOptimizedEvent {
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  savedPercent: number;
}

export interface ClipboardErrorEvent {
  message: string;
}

export interface ActionResult {
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
  outputPath?: string;
  originalBytes: number;
  outputBytes: number;
  bytesSaved: number;
}

export interface BackupRecord {
  originalPath: string;
  backupPath: string;
  removeOnRestore?: string;
}

export interface WorkerTask {
  inputPath: string;
  settings: OptimiseSettings;
  backupDir?: string;
  commonRoot?: string;
  mode: RunMode;
}

export type WorkerResponse =
  | {
    ok: true;
    inputPath: string;
    originalBytes: number;
    actions: {
      optimised?: ActionResult;
      webp?: ActionResult;
    };
    backups: BackupRecord[];
    status: 'success' | 'skipped';
    message?: string;
  }
  | {
    ok: false;
    inputPath: string;
    message: string;
  };

declare global {
  interface Window {
    api: {
      selectFolder: () => Promise<string | null>;
      selectFiles: () => Promise<string[]>;
      scanPaths: (paths: string[]) => Promise<ImageListItem[]>;
      startRun: (payload: StartRunPayload) => Promise<StartRunResult>;
      startOptimize: (payload: StartRunPayload) => Promise<StartRunResult>;
      cancelRun: (runId: string) => Promise<void>;
      cancelOptimize: (runId: string) => Promise<void>;
      restoreLastRun: () => Promise<{ restoredCount: number; failedCount: number; message: string }>;
      canRestoreLastRun: () => Promise<boolean>;
      onProgress: (cb: (event: RunProgressEvent) => void) => () => void;
      addWatchFolder: (path: string) => Promise<string[]>;
      removeWatchFolder: (path: string) => Promise<string[]>;
      listWatchFolders: () => Promise<string[]>;
      onWatchFileDetected: (cb: (event: WatchFileDetectedEvent) => void) => () => void;
      onWatchFileOptimized: (cb: (event: WatchFileOptimizedEvent) => void) => () => void;
      setClipboardAutoOptimize: (payload: { enabled: boolean; settings: OptimiseSettings }) => Promise<void>;
      onClipboardOptimized: (cb: (event: ClipboardOptimizedEvent) => void) => () => void;
      onClipboardError: (cb: (event: ClipboardErrorEvent) => void) => () => void;
      revealInFileManager: (paths: string[]) => Promise<void>;
      openPath: (path: string) => Promise<void>;
      copyToClipboard: (text: string) => Promise<void>;
      notify: (title: string, body?: string, silent?: boolean) => Promise<void>;
      showRowContextMenu: (paths: string[]) => void;
      onRemoveItems: (cb: (paths: string[]) => void) => () => void;
      onActionOptimize: (cb: (paths: string[]) => void) => () => void;
      onActionConvert: (cb: (paths: string[]) => void) => () => void;
      onActionReveal: (cb: (paths: string[]) => void) => () => void;
      onLog?: (cb: (payload: { level: string; context: string; message: string; args: any[] }) => void) => () => void;
    };
  }
}
