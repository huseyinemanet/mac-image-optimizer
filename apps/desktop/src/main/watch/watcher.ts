import fs from 'node:fs/promises';
import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import type { OptimiseSettings, RunMode, WorkerResponse, WorkerTask } from '../../shared/types';
import { getAutoConcurrency, WorkerPool } from '../optimizer/workerPool';

interface PersistedWatchState {
  folders: string[];
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

const WATCH_FILE_NAME = 'watch-folders.json';
const TEMP_SUFFIXES = ['.tmp', '.crdownload', '.download'];
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);

function isTempFile(inputPath: string): boolean {
  const lower = inputPath.toLowerCase();
  return TEMP_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function isSupportedFile(inputPath: string): boolean {
  const ext = path.extname(inputPath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

function shouldIgnorePath(inputPath: string): boolean {
  const normalized = inputPath.replaceAll('\\', '/');
  if (normalized.includes('/.optimise-tmp/') || normalized.includes('/.optimise-backup/')) {
    return true;
  }
  if (normalized.includes('/Optimized/')) {
    return true;
  }
  return isTempFile(inputPath);
}

function defaultWatchSettings(): OptimiseSettings {
  return {
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
}

export class WatchFolderService {
  private readonly settingsPath: string;
  private readonly watchers = new Map<string, FSWatcher>();
  private readonly folders = new Set<string>();
  private readonly queue: Array<{ folder: string; filePath: string }> = [];
  private readonly pending = new Set<string>();
  private readonly inFlight = new Set<string>();
  private readonly pool: WorkerPool;
  private readonly maxConcurrent: number;

  private activeJobs = 0;
  private optimizeSettings: OptimiseSettings = defaultWatchSettings();
  private optimizeMode: RunMode = 'optimize';

  constructor(
    userDataPath: string,
    private readonly onDetected: (payload: WatchFileDetectedEvent) => void,
    private readonly onOptimized: (payload: WatchFileOptimizedEvent) => void
  ) {
    this.settingsPath = path.join(userDataPath, WATCH_FILE_NAME);
    this.maxConcurrent = getAutoConcurrency();
    this.pool = new WorkerPool(this.maxConcurrent);
  }

  async init(): Promise<void> {
    const stored = await this.loadState();
    for (const folder of stored.folders) {
      try {
        const stat = await fs.stat(folder);
        if (stat.isDirectory()) {
          await this.startWatching(folder);
        }
      } catch {
        // Skip missing folders from previous sessions.
      }
    }
  }

  async close(): Promise<void> {
    await Promise.all(Array.from(this.watchers.values()).map((watcher) => watcher.close()));
    this.watchers.clear();
    await this.pool.close();
  }

  listFolders(): string[] {
    return Array.from(this.folders).sort((a, b) => a.localeCompare(b));
  }

  async addFolder(folderPath: string): Promise<string[]> {
    const normalized = path.resolve(folderPath);
    if (this.folders.has(normalized)) {
      return this.listFolders();
    }

    const stat = await fs.stat(normalized);
    if (!stat.isDirectory()) {
      throw new Error('Watch folder must be a directory.');
    }

    await this.startWatching(normalized);
    await this.saveState();
    return this.listFolders();
  }

  async removeFolder(folderPath: string): Promise<string[]> {
    const normalized = path.resolve(folderPath);
    const watcher = this.watchers.get(normalized);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(normalized);
    }

    this.folders.delete(normalized);
    await this.saveState();
    return this.listFolders();
  }

  updateRunPreferences(settings: OptimiseSettings, mode: RunMode): void {
    this.optimizeSettings = {
      ...settings,
      outputMode: 'subfolder',
      exportPreset: settings.exportPreset,
      replaceWithWebp: false,
      confirmDangerousWebpReplace: false,
      deleteOriginalAfterWebp: false
    };

    this.optimizeMode = mode;
  }

  private async startWatching(folderPath: string): Promise<void> {
    const watcher = chokidar.watch(folderPath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      },
      ignored: (entryPath) => shouldIgnorePath(entryPath)
    });

    watcher.on('add', (filePath) => {
      void this.onFileAdded(folderPath, filePath);
    });

    watcher.on('error', () => {
      // Keep watcher alive, errors are non-fatal for queue handling.
    });

    this.watchers.set(folderPath, watcher);
    this.folders.add(folderPath);
  }

  private async onFileAdded(folder: string, filePath: string): Promise<void> {
    const resolved = path.resolve(filePath);
    if (!isSupportedFile(resolved) || shouldIgnorePath(resolved)) {
      return;
    }

    if (this.pending.has(resolved) || this.inFlight.has(resolved)) {
      return;
    }

    this.pending.add(resolved);
    this.queue.push({ folder, filePath: resolved });
    this.onDetected({ folder, path: resolved });
    this.pumpQueue();
  }

  private pumpQueue(): void {
    while (this.activeJobs < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) {
        return;
      }

      this.pending.delete(next.filePath);
      this.inFlight.add(next.filePath);
      this.activeJobs += 1;

      void this.processQueuedFile(next.folder, next.filePath)
        .catch(() => {
          // Errors are reported through onOptimized event in processQueuedFile.
        })
        .finally(() => {
          this.inFlight.delete(next.filePath);
          this.activeJobs -= 1;
          this.pumpQueue();
        });
    }
  }

  private async processQueuedFile(folder: string, filePath: string): Promise<void> {
    const task: WorkerTask = {
      inputPath: filePath,
      settings: this.optimizeSettings,
      mode: this.optimizeMode,
      commonRoot: path.dirname(filePath)
    };

    let response: WorkerResponse;
    try {
      response = await this.pool.run(task);
    } catch (error) {
      this.onOptimized({
        folder,
        path: filePath,
        status: 'failed',
        beforeBytes: 0,
        afterBytes: 0,
        savedBytes: 0,
        message: error instanceof Error ? error.message : String(error)
      });
      return;
    }

    if (!response.ok) {
      this.onOptimized({
        folder,
        path: filePath,
        status: 'failed',
        beforeBytes: 0,
        afterBytes: 0,
        savedBytes: 0,
        message: response.message
      });
      return;
    }

    const action =
      this.optimizeMode === 'convertWebp'
        ? response.actions.webp
        : this.optimizeMode === 'optimize'
          ? response.actions.optimised
          : response.actions.optimised ?? response.actions.webp;

    const beforeBytes = action?.originalBytes ?? response.originalBytes;
    const afterBytes = action?.outputBytes ?? beforeBytes;
    const savedBytes = Math.max(0, beforeBytes - afterBytes);

    const status: WatchFileOptimizedEvent['status'] =
      action?.status === 'success' ? 'success' : action?.status === 'failed' ? 'failed' : 'skipped';

    this.onOptimized({
      folder,
      path: filePath,
      status,
      beforeBytes,
      afterBytes,
      savedBytes,
      message: action?.reason
    });
  }

  private async loadState(): Promise<PersistedWatchState> {
    try {
      const raw = await fs.readFile(this.settingsPath, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedWatchState;
      if (!Array.isArray(parsed.folders)) {
        return { folders: [] };
      }
      return {
        folders: parsed.folders.map((item) => path.resolve(item))
      };
    } catch {
      return { folders: [] };
    }
  }

  private async saveState(): Promise<void> {
    const payload: PersistedWatchState = {
      folders: this.listFolders()
    };

    await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
    await fs.writeFile(this.settingsPath, JSON.stringify(payload, null, 2), 'utf-8');
  }
}
