export type SupportedImageType = 'jpeg' | 'png' | 'webp';

export type OutputMode = 'replace' | 'subfolder';
export type RunMode = 'optimize' | 'convertWebp' | 'optimizeAndWebp' | 'smart' | 'responsive';
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
  jpegQualityMode: 'auto' | 'fixed';
  jpegQuality: number;
  webpQualityMode: 'auto' | 'fixed';
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
  smartCompressionMode: boolean;
  smartTarget: 'visually-lossless' | 'high' | 'balanced' | 'small' | 'custom';
  qualityGuardrail: number;
  optimizationSpeed: 'fast' | 'balanced' | 'thorough';
  responsiveSettings: ResponsiveSettings;
}

export type ResponsiveMode = 'width' | 'dpr';
export type ResponsiveFormatPolicy = 'keep' | 'webp-fallback' | 'webp-only';

export interface ResponsiveSettings {
  mode: ResponsiveMode;
  widths: number[];
  dprBaseWidth: number;
  formatPolicy: ResponsiveFormatPolicy;
  allowUpscale: boolean;
  includeOriginal: boolean;
  optimizationPreset: ExportPreset;
  sizesTemplate: string;
  customSizes: string;
}

export const DEFAULT_RESPONSIVE_SETTINGS: ResponsiveSettings = {
  mode: 'width',
  widths: [320, 480, 640, 768, 1024, 1280, 1536, 1920, 2560],
  dprBaseWidth: 400,
  formatPolicy: 'webp-fallback',
  allowUpscale: false,
  includeOriginal: false,
  optimizationPreset: 'web',
  sizesTemplate: 'default',
  customSizes: '(max-width: 768px) 100vw, 768px',
};

export const DEFAULT_SETTINGS: OptimiseSettings = {
  outputMode: 'subfolder',
  exportPreset: 'web',
  namingPattern: '{name}',
  keepMetadata: false,
  optimizeClipboardImages: false,
  jpegQualityMode: 'auto',
  jpegQuality: 82,
  webpQualityMode: 'auto',
  webpNearLossless: false,
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
  qualityGuardrailSsim: false,
  smartCompressionMode: false,
  smartTarget: 'visually-lossless',
  qualityGuardrail: 90,
  optimizationSpeed: 'balanced',
  responsiveSettings: DEFAULT_RESPONSIVE_SETTINGS,
};

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

export type WatchTriggerBehavior = 'new' | 'modified';

export interface WatchFolderSettings {
  triggerBehavior: WatchTriggerBehavior;
  stabilityWaitMs: number;
  maxFileSizeMb: number;
  watchEnabled: boolean;
  runMode: RunMode;
  optimiseSettings: OptimiseSettings;
}

export const DEFAULT_WATCH_SETTINGS: WatchFolderSettings = {
  triggerBehavior: 'new',
  stabilityWaitMs: 2000,
  maxFileSizeMb: 100,
  watchEnabled: true,
  runMode: 'optimize',
  optimiseSettings: DEFAULT_SETTINGS,
};

export interface WatchFolderStatus {
  path: string;
  enabled: boolean;
  folderSettings?: WatchFolderSettings;
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

export interface ResponsiveDerivative {
  width: number | null;
  dpr: number | null;
  format: SupportedImageType;
  outputPath: string;
  size: number;
}

export interface ResponsiveResult {
  status: 'success';
  inputPath: string;
  originalWidth: number;
  originalHeight: number;
  derivatives: ResponsiveDerivative[];
  htmlImg: string;
  htmlPicture: string;
  manifest: any;
  reason?: string;
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

export interface PreviewResult {
  buffer: Buffer;
  originalBuffer?: Buffer;
  size: number;
  quality: number;
  ssim: number;
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
      responsive?: ResponsiveResult;
    };
    backups: BackupRecord[];
    status: 'success' | 'skipped' | 'failed';
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
      getPathForFile: (file: File) => string;
      selectFolder: () => Promise<string | null>;
      selectFiles: () => Promise<string[]>;
      scanPaths: (paths: string[]) => Promise<ImageListItem[]>;
      startRun: (payload: StartRunPayload) => Promise<StartRunResult>;
      cancelRun: (runId: string) => Promise<void>;
      restoreLastRun: () => Promise<{ restoredCount: number; failedCount: number; message: string }>;
      canRestoreLastRun: () => Promise<boolean>;
      onProgress: (cb: (event: RunProgressEvent) => void) => () => void;

      // Folder Watch API
      addWatchFolder: (path: string) => Promise<WatchFolderStatus[]>;
      removeWatchFolder: (path: string) => Promise<WatchFolderStatus[]>;
      listWatchFolders: () => Promise<WatchFolderStatus[]>;
      updateWatchFolderSettings: (path: string, settings: WatchFolderSettings) => Promise<WatchFolderStatus[]>;
      toggleWatchFolder: (path: string, enabled: boolean) => Promise<WatchFolderStatus[]>;
      getGlobalWatchSettings: () => Promise<WatchFolderSettings>;
      updateGlobalWatchSettings: (settings: WatchFolderSettings) => Promise<void>;
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
