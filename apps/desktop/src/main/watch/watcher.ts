import fs from 'node:fs/promises';
import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import type {
  OptimiseSettings,
  RunMode,
  WorkerResponse,
  WorkerTask,
  WatchFileDetectedEvent,
  WatchFileOptimizedEvent,
  WatchFolderSettings,
  WatchFolderStatus,
  DEFAULT_WATCH_SETTINGS
} from '../../shared/types';
import { getAutoConcurrency, WorkerPool } from '../optimizer/workerPool';
import { ProcessedIndexStore, FileFingerprint } from './processedIndex';
import { StabilityChecker } from './stability';
import { Logger } from '../logger';

const log = new Logger('WatchService');

interface PersistedWatchState {
  folders: Array<{
    path: string;
    enabled: boolean;
    settings?: WatchFolderSettings;
  }>;
  globalSettings?: WatchFolderSettings;
}

const WATCH_CONFIG_FILE = 'watch-config.json';
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff']);
const IGNORE_PATTERNS = [
  // Hidden files
  /^\..*/,
  // System junk
  /Thumbs\.db$/i,
  /Desktop\.ini$/i,
  /\.DS_Store$/i,
  // Temp/partial patterns
  /\.tmp$/i,
  /\.part$/i,
  /\.crdownload$/i,
  /\.download$/i,
  /^~/,
  /^\._/
];

export class WatchFolderService {
  private readonly configPath: string;
  private readonly watchers = new Map<string, FSWatcher>();
  private readonly folderConfigs = new Map<string, { enabled: boolean; settings?: WatchFolderSettings }>();

  private readonly queue: Array<{ folder: string; filePath: string; retryCount: number }> = [];
  private readonly pending = new Set<string>();
  private readonly inFlight = new Set<string>();

  private readonly pool: WorkerPool;
  private readonly maxConcurrent: number;
  private readonly indexStore: ProcessedIndexStore;
  private readonly stabilityChecker: StabilityChecker;

  private activeJobs = 0;
  private globalSettings: WatchFolderSettings;

  constructor(
    userDataPath: string,
    private readonly onDetected: (payload: WatchFileDetectedEvent) => void,
    private readonly onOptimized: (payload: WatchFileOptimizedEvent) => void
  ) {
    this.configPath = path.join(userDataPath, WATCH_CONFIG_FILE);
    this.maxConcurrent = getAutoConcurrency();
    this.pool = new WorkerPool(this.maxConcurrent);
    this.indexStore = new ProcessedIndexStore(userDataPath);
    this.stabilityChecker = new StabilityChecker();

    // We'll initialize globalSettings from DEFAULT_WATCH_SETTINGS in init()
    this.globalSettings = {
      triggerBehavior: 'new',
      stabilityWaitMs: 2000,
      maxFileSizeMb: 100,
      watchEnabled: true,
      runMode: 'optimize',
      optimiseSettings: {
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
        responsiveSettings: {
          mode: 'width',
          widths: [320, 480, 640, 768, 1024, 1280, 1536, 1920, 2560],
          dprBaseWidth: 400,
          formatPolicy: 'webp-fallback',
          allowUpscale: false,
          includeOriginal: false,
          optimizationPreset: 'web',
          sizesTemplate: 'default',
          customSizes: '(max-width: 768px) 100vw, 768px',
        },
      }
    };
  }

  async init(): Promise<void> {
    await this.indexStore.init();
    const stored = await this.loadState();

    if (stored.globalSettings) {
      this.globalSettings = stored.globalSettings;
    }

    for (const folder of stored.folders) {
      this.folderConfigs.set(folder.path, {
        enabled: folder.enabled,
        settings: folder.settings
      });

      if (folder.enabled && this.globalSettings.watchEnabled) {
        try {
          await this.startWatching(folder.path);
        } catch (error) {
          log.error(`Failed to start watching ${folder.path}:`, error);
        }
      }
    }
  }

  async close(): Promise<void> {
    await Promise.all(Array.from(this.watchers.values()).map((watcher) => watcher.close()));
    this.watchers.clear();
    await this.pool.close();
    await this.indexStore.save();
  }

  getGlobalSettings(): WatchFolderSettings {
    return this.globalSettings;
  }

  async updateGlobalSettings(settings: WatchFolderSettings): Promise<void> {
    const wasEnabled = this.globalSettings.watchEnabled;
    this.globalSettings = settings;

    if (wasEnabled && !settings.watchEnabled) {
      // Stop all watchers
      await Promise.all(Array.from(this.watchers.values()).map(w => w.close()));
      this.watchers.clear();
    } else if (!wasEnabled && settings.watchEnabled) {
      // Resume enabled watchers
      for (const [folderPath, config] of this.folderConfigs.entries()) {
        if (config.enabled) {
          await this.startWatching(folderPath);
        }
      }
    }

    await this.saveState();
  }

  listFolders(): WatchFolderStatus[] {
    return Array.from(this.folderConfigs.entries()).map(([path, config]) => ({
      path,
      enabled: config.enabled,
      folderSettings: config.settings
    })).sort((a, b) => a.path.localeCompare(b.path));
  }

  async addFolder(folderPath: string): Promise<WatchFolderStatus[]> {
    const normalized = path.resolve(folderPath);
    if (this.folderConfigs.has(normalized)) {
      return this.listFolders();
    }

    const stat = await fs.stat(normalized);
    if (!stat.isDirectory()) {
      throw new Error('Watch folder must be a directory.');
    }

    this.folderConfigs.set(normalized, { enabled: true });

    if (this.globalSettings.watchEnabled) {
      await this.startWatching(normalized);
    }

    await this.saveState();
    return this.listFolders();
  }

  async removeFolder(folderPath: string): Promise<WatchFolderStatus[]> {
    const normalized = path.resolve(folderPath);
    const watcher = this.watchers.get(normalized);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(normalized);
    }

    this.folderConfigs.delete(normalized);
    await this.saveState();
    return this.listFolders();
  }

  async toggleFolder(folderPath: string, enabled: boolean): Promise<WatchFolderStatus[]> {
    const config = this.folderConfigs.get(folderPath);
    if (!config) return this.listFolders();

    config.enabled = enabled;

    if (enabled && this.globalSettings.watchEnabled) {
      await this.startWatching(folderPath);
    } else {
      const watcher = this.watchers.get(folderPath);
      if (watcher) {
        await watcher.close();
        this.watchers.delete(folderPath);
      }
    }

    await this.saveState();
    return this.listFolders();
  }

  async updateFolderSettings(folderPath: string, settings: WatchFolderSettings): Promise<WatchFolderStatus[]> {
    const config = this.folderConfigs.get(folderPath);
    if (!config) return this.listFolders();

    config.settings = settings;
    await this.saveState();
    return this.listFolders();
  }

  private async startWatching(folderPath: string): Promise<void> {
    if (this.watchers.has(folderPath)) return;

    const watcher = chokidar.watch(folderPath, {
      ignoreInitial: true,
      persistent: true,
      ignored: (entryPath) => this.shouldIgnorePath(entryPath, folderPath)
    });

    watcher.on('add', (filePath) => {
      this.onFileEvent('add', folderPath, filePath);
    });

    watcher.on('change', (filePath) => {
      this.onFileEvent('change', folderPath, filePath);
    });

    watcher.on('error', (error) => {
      log.error(`Watcher error for ${folderPath}:`, error);
    });

    this.watchers.set(folderPath, watcher);
  }

  private shouldIgnorePath(inputPath: string, watchRoot: string): boolean {
    const fileName = path.basename(inputPath);

    // Check ignore patterns
    if (IGNORE_PATTERNS.some(pattern => pattern.test(fileName))) {
      return true;
    }

    const normalized = inputPath.replaceAll('\\', '/');

    // Prevent infinite loops if outputting to subfolders
    if (normalized.includes('/Optimized/') || normalized.includes('/.optimise-tmp/') || normalized.includes('/.optimise-backup/')) {
      return true;
    }

    return false;
  }

  private isSupportedFile(inputPath: string): boolean {
    const ext = path.extname(inputPath).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  }

  private onFileEvent(event: 'add' | 'change', folder: string, filePath: string): void {
    const resolved = path.resolve(filePath);

    if (!this.isSupportedFile(resolved)) return;

    const config = this.folderConfigs.get(folder);
    const settings = config?.settings || this.globalSettings;

    if (event === 'change' && settings.triggerBehavior === 'new') {
      return;
    }

    if (this.pending.has(resolved) || this.inFlight.has(resolved)) {
      return;
    }

    log.info(`Detected ${event}: ${resolved}`);
    this.pending.add(resolved);
    this.queue.push({ folder, filePath: resolved, retryCount: 0 });
    this.onDetected({ folder, path: resolved });
    this.pumpQueue();
  }

  private pumpQueue(): void {
    while (this.activeJobs < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) return;

      this.pending.delete(next.filePath);
      this.inFlight.add(next.filePath);
      this.activeJobs += 1;

      void this.processFileWithLifecycle(next)
        .finally(() => {
          this.inFlight.delete(next.filePath);
          this.activeJobs -= 1;
          this.pumpQueue();
        });
    }
  }

  private async processFileWithLifecycle(item: { folder: string; filePath: string; retryCount: number }): Promise<void> {
    const { folder, filePath } = item;
    const config = this.folderConfigs.get(folder);
    const settings = config?.settings || this.globalSettings;

    try {
      // 1. Stability Check
      const isStable = await this.stabilityChecker.waitUntilStable(filePath);
      if (!isStable) {
        throw new Error('File did not become stable within timeout');
      }

      // 2. Size Check
      const stat = await fs.stat(filePath);
      if (settings.maxFileSizeMb > 0 && stat.size > settings.maxFileSizeMb * 1024 * 1024) {
        this.emitOptimized(folder, filePath, 'skipped', stat.size, stat.size, 0, 'File too large');
        return;
      }

      // 3. De-duplication Check
      const fingerprint = await this.indexStore.getFingerprint(filePath);
      if (this.indexStore.hasBeenProcessed(filePath, fingerprint)) {
        log.info(`Skipping already processed file: ${filePath}`);
        this.emitOptimized(folder, filePath, 'skipped', stat.size, stat.size, 0, 'Already processed');
        return;
      }

      // 4. Optimization
      await this.runOptimization(folder, filePath, settings, fingerprint);

    } catch (error) {
      log.error(`Failed to process ${filePath}:`, error);

      // Retry logic
      if (item.retryCount < 2) {
        log.info(`Retrying ${filePath} (attempt ${item.retryCount + 1})`);
        setTimeout(() => {
          this.queue.push({ ...item, retryCount: item.retryCount + 1 });
          this.pumpQueue();
        }, 3000 * (item.retryCount + 1));
      } else {
        this.emitOptimized(folder, filePath, 'failed', 0, 0, 0, error instanceof Error ? error.message : String(error));
      }
    }
  }

  private async runOptimization(folder: string, filePath: string, settings: WatchFolderSettings, fingerprint: FileFingerprint): Promise<void> {
    const task: WorkerTask = {
      inputPath: filePath,
      settings: settings.optimiseSettings,
      mode: settings.runMode,
      commonRoot: path.dirname(filePath)
    };

    const response: WorkerResponse = await this.pool.run(task);

    if (!response.ok) {
      throw new Error(response.message);
    }

    const action =
      settings.runMode === 'convertWebp'
        ? response.actions.webp
        : settings.runMode === 'optimize'
          ? response.actions.optimised
          : response.actions.optimised ?? response.actions.webp;

    const beforeBytes = action?.originalBytes ?? response.originalBytes;
    const afterBytes = action?.outputBytes ?? beforeBytes;
    const savedBytes = Math.max(0, beforeBytes - afterBytes);

    const status: WatchFileOptimizedEvent['status'] =
      action?.status === 'success' ? 'success' : action?.status === 'failed' ? 'failed' : 'skipped';

    if (status === 'success') {
      this.indexStore.markProcessed(filePath, fingerprint);
    }

    this.emitOptimized(folder, filePath, status, beforeBytes, afterBytes, savedBytes, action?.reason);
  }

  private emitOptimized(folder: string, path: string, status: WatchFileOptimizedEvent['status'], before: number, after: number, saved: number, message?: string): void {
    this.onOptimized({
      folder,
      path,
      status,
      beforeBytes: before,
      afterBytes: after,
      savedBytes: saved,
      message
    });
  }

  private async loadState(): Promise<PersistedWatchState> {
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(raw) as PersistedWatchState;
    } catch {
      return { folders: [] };
    }
  }

  private async saveState(): Promise<void> {
    const payload: PersistedWatchState = {
      folders: this.listFolders(),
      globalSettings: this.globalSettings
    };

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(payload, null, 2), 'utf-8');
  }
}
