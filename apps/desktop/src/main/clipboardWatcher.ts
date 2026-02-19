import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { clipboard, nativeImage } from 'electron';
import type { ClipboardOptimizedEvent, ClipboardErrorEvent, OptimiseSettings } from '../shared/types';
import { computeSsim } from './optimizer/metrics/ssim';
import { runOxipng } from './optimizer/tools/oxipng';
import { runPngquant } from './optimizer/tools/pngquant';

const POLL_INTERVAL_MS = 800;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const HASH_MEMORY_LIMIT = 500;
const HASH_TTL_MS = 10 * 60 * 1000;
const DEBOUNCE_MS = 500;


interface Candidate {
  buffer: Buffer;
  bytes: number;
}

function now(): number {
  return Date.now();
}

function hashBuffer(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function pruneMemory(map: Map<string, number>): void {
  const current = now();
  for (const [key, timestamp] of map.entries()) {
    if (current - timestamp > HASH_TTL_MS) {
      map.delete(key);
    }
  }

  if (map.size <= HASH_MEMORY_LIMIT) {
    return;
  }

  const sorted = [...map.entries()].sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < sorted.length - HASH_MEMORY_LIMIT; i += 1) {
    map.delete(sorted[i][0]);
  }
}

async function optimizeClipboardPng(originalBuffer: Buffer, aggressivePng: boolean): Promise<Candidate | null> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'clip-opt-'));
  const inputPath = path.join(tempRoot, 'input.png');

  try {
    await fs.writeFile(inputPath, originalBuffer);

    const threshold = aggressivePng ? 0.99 : 0.995;
    const candidates: Candidate[] = [];

    const oxOut = path.join(tempRoot, 'oxipng.png');
    try {
      await runOxipng(inputPath, oxOut, { keepMetadata: false });
      const buffer = await fs.readFile(oxOut);
      candidates.push({ buffer, bytes: buffer.length });
    } catch {
      // Ignore failed candidate.
    }

    const quantRanges = aggressivePng
      ? [
        { min: 80, max: 95 },
        { min: 75, max: 90 },
        { min: 70, max: 85 }
      ]
      : [{ min: 80, max: 95 }];

    for (const range of quantRanges) {
      const quantPath = path.join(tempRoot, `quant-${range.min}-${range.max}.png`);
      const finalPath = path.join(tempRoot, `quant-ox-${range.min}-${range.max}.png`);

      try {
        await runPngquant(inputPath, quantPath, {
          minQuality: range.min,
          maxQuality: range.max,
          keepMetadata: false
        });
        await runOxipng(quantPath, finalPath, { keepMetadata: false });

        const buffer = await fs.readFile(finalPath);
        const score = await computeSsim(originalBuffer, buffer);
        if (score >= threshold) {
          candidates.push({ buffer, bytes: buffer.length });
        }
      } catch {
        // Ignore failed candidate.
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    return candidates.sort((a, b) => a.bytes - b.bytes)[0];
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

export class ClipboardWatcherService {
  private timer: NodeJS.Timeout | null = null;
  private enabled = false;
  private settings: OptimiseSettings | null = null;
  private processing = false;
  private processedHashes = new Map<string, number>();
  private lastChangeAt = 0;

  constructor(
    private readonly onOptimized: (payload: ClipboardOptimizedEvent) => void,
    private readonly onError: (payload: ClipboardErrorEvent) => void
  ) { }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  configure(enabled: boolean, settings: OptimiseSettings): void {
    this.enabled = enabled;
    this.settings = settings;
  }

  private async tick(): Promise<void> {
    if (!this.enabled || !this.settings || this.processing) {
      return;
    }

    const image = clipboard.readImage();
    if (image.isEmpty()) {
      return;
    }

    const pngBuffer = image.toPNG();
    if (pngBuffer.length === 0) {
      return;
    }

    const hash = hashBuffer(pngBuffer);
    if (this.processedHashes.has(hash)) {
      return;
    }

    const current = now();
    if (current - this.lastChangeAt < DEBOUNCE_MS) {
      return;
    }

    this.lastChangeAt = current;

    if (pngBuffer.length > MAX_IMAGE_BYTES) {
      this.processedHashes.set(hash, current);
      pruneMemory(this.processedHashes);
      this.onError({ message: 'Clipboard image skipped: larger than 50MB.' });
      return;
    }

    this.processing = true;

    try {
      const candidate = await optimizeClipboardPng(pngBuffer, this.settings.aggressivePng);
      if (!candidate) {
        this.processedHashes.set(hash, now());
        pruneMemory(this.processedHashes);
        return;
      }

      if (!this.settings.allowLargerOutput && candidate.bytes >= pngBuffer.length) {
        this.processedHashes.set(hash, now());
        pruneMemory(this.processedHashes);
        return;
      }

      const optimizedImage = nativeImage.createFromBuffer(candidate.buffer);
      clipboard.writeImage(optimizedImage);

      const optimizedHash = hashBuffer(candidate.buffer);
      const currentTime = now();
      this.processedHashes.set(hash, currentTime);
      this.processedHashes.set(optimizedHash, currentTime);
      pruneMemory(this.processedHashes);

      const savedBytes = Math.max(0, pngBuffer.length - candidate.bytes);
      const savedPercent = pngBuffer.length > 0 ? Math.round((savedBytes / pngBuffer.length) * 100) : 0;

      this.onOptimized({
        originalBytes: pngBuffer.length,
        optimizedBytes: candidate.bytes,
        savedBytes,
        savedPercent
      });
    } catch (error) {
      this.onError({
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.processing = false;
    }
  }
}
