import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { Logger } from '../logger';
import type { OptimiseSettings, ResponsiveResult, WorkerTask } from '../../shared/types';
import {
  getJpegQualities,
  getOutputFormatForPath,
  getPngQualityRanges,
  getSsimThreshold,
  getWebpQualities,
  shouldCreateWebp,
  shouldOptimizeOriginal,
  shouldSkipIfLarger
} from './candidates';
import { computeSsim } from './metrics/ssim';
import { encodeCwebp } from './tools/cwebp';
import { encodeMozjpeg } from './tools/mozjpeg';
import { runOxipng } from './tools/oxipng';
import { runPngquant } from './tools/pngquant';
import { ensureBackup, outputPathForOriginal, outputPathForWebp, tempFilePath, type BackupRecord } from './io/paths';
import { resolveOutputPathFromTemplate } from './io/filenameTemplate';
import { applyExportPreset } from './exportPreset';
import { toEffectiveSettings, type ActionDecision, type CandidateResult, type EffectiveSettings, type PipelineFileResult } from './types';
import { analyzeImage, type ImageFeatures } from './analysis';
import { findOptimalQuality } from './smartSearch';
import { buildDerivativePlan, generateHtmlSnippet, generateManifest, renderDerivative } from './responsive';

const log = new Logger('Pipeline');

interface CandidateFile {
  path: string;
  format: 'jpeg' | 'png' | 'webp';
  label: string;
  needsSsim: boolean;
}

async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.rm(filePath, { force: true });
  } catch {
    // best-effort cleanup
  }
}

async function readCandidate(filePath: string, format: 'jpeg' | 'png' | 'webp', label: string): Promise<CandidateResult> {
  const [stat, buffer] = await Promise.all([fs.stat(filePath), fs.readFile(filePath)]);
  return {
    buffer,
    bytes: stat.size,
    qualityLabel: label,
    format
  };
}

async function evaluateCandidate(
  candidate: CandidateFile,
  originalBuffer: Buffer,
  ssimThreshold: number
): Promise<CandidateResult | null> {
  const result = await readCandidate(candidate.path, candidate.format, candidate.label);
  if (!candidate.needsSsim) {
    return result;
  }

  const similarity = await computeSsim(originalBuffer, result.buffer);
  if (similarity < ssimThreshold) {
    return null;
  }

  return {
    ...result,
    ssim: similarity
  };
}

async function validateOutput(pathToValidate: string, expected: 'jpeg' | 'png' | 'webp'): Promise<void> {
  const meta = await sharp(pathToValidate).metadata();
  if (meta.format !== expected) {
    throw new Error(`Output validation failed for ${pathToValidate}`);
  }
}

async function writeValidatedAtomic(targetPath: string, sourceBuffer: Buffer, expected: 'jpeg' | 'png' | 'webp'): Promise<void> {
  const tmpPath = tempFilePath(targetPath);
  await fs.mkdir(path.dirname(tmpPath), { recursive: true });
  await fs.writeFile(tmpPath, sourceBuffer);
  await validateOutput(tmpPath, expected);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.rename(tmpPath, targetPath);
}

async function pickBest(candidates: CandidateResult[]): Promise<CandidateResult | null> {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((a, b) => a.bytes - b.bytes)[0];
}

async function buildJpegCandidates(
  inputPath: string,
  originalBuffer: Buffer,
  features: ImageFeatures,
  settings: EffectiveSettings
): Promise<CandidateResult[]> {
  if (settings.smartCompressionMode) {
    const result = await findOptimalQuality(inputPath, originalBuffer, features, settings, 'jpeg');
    if (result) {
      return [
        {
          buffer: result.buffer,
          bytes: result.buffer.length,
          qualityLabel: `smart-q${result.quality}`,
          format: 'jpeg',
          ssim: result.metrics.mssim
        }
      ];
    }
    return [];
  }

  const threshold = getSsimThreshold(settings);
  const candidates: CandidateResult[] = [];

  for (const quality of getJpegQualities(settings)) {
    log.debug(`Attempting Mozjpeg for ${inputPath} at quality ${quality}`);
    const out = path.join(os.tmpdir(), `mo-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`);
    try {
      await encodeMozjpeg(inputPath, out, { quality, keepMetadata: settings.keepMetadata });
      const accepted = await evaluateCandidate(
        { path: out, format: 'jpeg', label: `q${quality}`, needsSsim: true },
        originalBuffer,
        threshold
      );
      if (accepted) {
        candidates.push(accepted);
      }
    } catch (error) {
      // If it's a missing binary error, we want to know
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Missing optimizer binary')) {
        throw error; // Re-throw to be caught by the action caller
      }
      // ignore other failed candidates (e.g. timeout) and continue
    } finally {
      await cleanupFile(out);
    }
  }

  return candidates;
}

async function buildPngCandidates(inputPath: string, originalBuffer: Buffer, settings: EffectiveSettings): Promise<CandidateResult[]> {
  const threshold = getSsimThreshold(settings);
  const candidates: CandidateResult[] = [];

  const losslessOut = path.join(os.tmpdir(), `ox-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
  try {
    log.debug(`Attempting Oxipng lossless for ${inputPath}`);
    await runOxipng(inputPath, losslessOut, { keepMetadata: settings.keepMetadata });
    const result = await evaluateCandidate(
      { path: losslessOut, format: 'png', label: 'oxipng-lossless', needsSsim: false },
      originalBuffer,
      threshold
    );
    if (result) {
      candidates.push(result);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Missing optimizer binary')) {
      throw error;
    }
  } finally {
    await cleanupFile(losslessOut);
  }

  for (const range of getPngQualityRanges(settings)) {
    const quantOut = path.join(os.tmpdir(), `pq-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
    const finalOut = path.join(os.tmpdir(), `pqox-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);

    try {
      log.debug(`Attempting Pngquant for ${inputPath} at range ${range.label}`);
      await runPngquant(inputPath, quantOut, {
        minQuality: range.min,
        maxQuality: range.max,
        keepMetadata: settings.keepMetadata
      });
      await runOxipng(quantOut, finalOut, { keepMetadata: settings.keepMetadata });
      const result = await evaluateCandidate(
        { path: finalOut, format: 'png', label: `pngquant-${range.label}`, needsSsim: true },
        originalBuffer,
        threshold
      );
      if (result) {
        candidates.push(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Missing optimizer binary')) {
        throw error;
      }
      // ignore a bad pngquant candidate
    } finally {
      await cleanupFile(quantOut);
      await cleanupFile(finalOut);
    }
  }

  return candidates;
}

async function buildWebpCandidates(
  inputPath: string,
  originalBuffer: Buffer,
  features: ImageFeatures,
  settings: EffectiveSettings
): Promise<CandidateResult[]> {
  if (settings.smartCompressionMode) {
    const result = await findOptimalQuality(inputPath, originalBuffer, features, settings, 'webp');
    if (result) {
      return [
        {
          buffer: result.buffer,
          bytes: result.buffer.length,
          qualityLabel: `smart-q${result.quality}`,
          format: 'webp',
          ssim: result.metrics.mssim
        }
      ];
    }
    return [];
  }

  const threshold = getSsimThreshold(settings);
  const candidates: CandidateResult[] = [];

  for (const quality of getWebpQualities(settings)) {
    log.debug(`Attempting Cwebp for ${inputPath} at quality ${quality}`);
    const out = path.join(os.tmpdir(), `wp-${Date.now()}-${Math.random().toString(16).slice(2)}.webp`);
    try {
      await encodeCwebp(inputPath, out, {
        quality,
        effort: settings.webpEffort,
        nearLossless: settings.webpNearLossless,
        keepMetadata: settings.keepMetadata
      });
      const result = await evaluateCandidate(
        { path: out, format: 'webp', label: `q${quality}`, needsSsim: true },
        originalBuffer,
        threshold
      );
      if (result) {
        candidates.push(result);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Missing optimizer binary')) {
        throw error;
      }
      // ignore failed candidate
    } finally {
      await cleanupFile(out);
    }
  }

  return candidates;
}

function skipDecision(originalBytes: number, reason: string): ActionDecision {
  log.info(`Skip decision: ${reason}`);
  return {
    status: 'skipped',
    reason,
    originalBytes,
    outputBytes: originalBytes,
    bytesSaved: 0
  };
}

async function runOptimizeAction(
  inputPath: string,
  originalBuffer: Buffer,
  features: ImageFeatures,
  settings: EffectiveSettings,
  commonRoot: string,
  backupDir: string | undefined,
  backupCache: Map<string, string>,
  backupRecords: BackupRecord[]
): Promise<ActionDecision> {
  const type = getOutputFormatForPath(inputPath);
  if (!type) {
    return skipDecision(originalBuffer.length, 'Skipped (unsupported)');
  }

  let candidates: CandidateResult[] = [];
  try {
    candidates =
      type === 'jpeg'
        ? await buildJpegCandidates(inputPath, originalBuffer, features, settings)
        : type === 'png'
          ? await buildPngCandidates(inputPath, originalBuffer, settings)
          : settings.reencodeExistingWebp
            ? await buildWebpCandidates(inputPath, originalBuffer, features, settings)
            : [];
  } catch (error) {
    return skipDecision(originalBuffer.length, error instanceof Error ? error.message : String(error));
  }

  if (type === 'webp' && !settings.reencodeExistingWebp) {
    return skipDecision(originalBuffer.length, 'Skipped existing WebP');
  }

  const best = await pickBest(candidates);
  if (!best) {
    return skipDecision(originalBuffer.length, 'No candidate met quality threshold');
  }

  const outputPath = outputPathForOriginal(inputPath, commonRoot, settings.outputMode);
  const finalOutputPath =
    settings.outputMode === 'subfolder' && (inputPath.toLowerCase().endsWith('.tif') || inputPath.toLowerCase().endsWith('.tiff'))
      ? outputPath.replace(/\.(tif|tiff)$/i, '.jpg')
      : outputPath;
  const applied = await applyExportPreset({
    inputPath,
    targetPath: finalOutputPath,
    buffer: best.buffer,
    format: type,
    settings
  });

  if (shouldSkipIfLarger(originalBuffer.length, applied.buffer.length, settings)) {
    return skipDecision(originalBuffer.length, 'Skipped (larger)');
  }

  const finalNamedPath = await resolveOutputPathFromTemplate({
    inputPath,
    targetPath: applied.targetPath,
    outputBuffer: applied.buffer,
    format: applied.format,
    template: settings.namingPattern,
    applyTemplate: settings.outputMode === 'subfolder'
  });

  if (settings.outputMode === 'replace') {
    if (!backupDir) {
      throw new Error('Backup directory required for replace mode');
    }
    await ensureBackup(backupDir, inputPath, backupCache, backupRecords);
  }

  await writeValidatedAtomic(finalNamedPath, applied.buffer, applied.format);

  return {
    status: 'success',
    outputPath: finalNamedPath,
    originalBytes: originalBuffer.length,
    outputBytes: applied.buffer.length,
    bytesSaved: Math.max(0, originalBuffer.length - applied.buffer.length)
  };
}

async function runWebpAction(
  inputPath: string,
  originalBuffer: Buffer,
  features: ImageFeatures,
  settings: EffectiveSettings,
  commonRoot: string,
  backupDir: string | undefined,
  backupCache: Map<string, string>,
  backupRecords: BackupRecord[]
): Promise<ActionDecision> {
  const type = getOutputFormatForPath(inputPath);
  if (!type) {
    return skipDecision(originalBuffer.length, 'Skipped (unsupported)');
  }

  if (type === 'webp' && !settings.reencodeExistingWebp) {
    return skipDecision(originalBuffer.length, 'Skipped existing WebP');
  }

  let candidates: CandidateResult[] = [];
  try {
    candidates = await buildWebpCandidates(inputPath, originalBuffer, features, settings);
  } catch (error) {
    return skipDecision(originalBuffer.length, error instanceof Error ? error.message : String(error));
  }
  const best = await pickBest(candidates);

  if (!best) {
    return skipDecision(originalBuffer.length, 'No WebP candidate met quality threshold');
  }

  let outputPath = outputPathForWebp(inputPath, commonRoot, settings.outputMode);
  const dangerousReplace =
    settings.outputMode === 'replace' && settings.replaceWithWebp && settings.confirmDangerousWebpReplace;

  if (dangerousReplace) {
    if (!backupDir) {
      throw new Error('Backup directory required for dangerous replace mode');
    }

    await ensureBackup(backupDir, inputPath, backupCache, backupRecords);
    outputPath = outputPathForWebp(inputPath, commonRoot, 'replace');
  }

  const applied = await applyExportPreset({
    inputPath,
    targetPath: outputPath,
    buffer: best.buffer,
    format: 'webp',
    settings
  });

  if (shouldSkipIfLarger(originalBuffer.length, applied.buffer.length, settings)) {
    return skipDecision(originalBuffer.length, 'Skipped (larger)');
  }

  const finalNamedPath = await resolveOutputPathFromTemplate({
    inputPath,
    targetPath: applied.targetPath,
    outputBuffer: applied.buffer,
    format: applied.format,
    template: settings.namingPattern,
    applyTemplate: settings.outputMode === 'subfolder'
  });

  await writeValidatedAtomic(finalNamedPath, applied.buffer, applied.format);

  if (dangerousReplace && settings.deleteOriginalAfterWebp) {
    const record = backupRecords.find((item) => item.originalPath === inputPath);
    if (record) {
      record.removeOnRestore = finalNamedPath;
    }
    await fs.rm(inputPath, { force: true });
  }

  return {
    status: 'success',
    outputPath: finalNamedPath,
    originalBytes: originalBuffer.length,
    outputBytes: applied.buffer.length,
    bytesSaved: Math.max(0, originalBuffer.length - applied.buffer.length)
  };
}

async function runResponsiveAction(
  inputPath: string,
  features: ImageFeatures,
  settings: EffectiveSettings,
  commonRoot: string,
): Promise<ResponsiveResult> {
  const config = settings.responsiveSettings;
  const plans = await buildDerivativePlan(inputPath, config, features.width);

  const outputFolder = path.join(path.dirname(inputPath), 'Responsive', path.basename(inputPath, path.extname(inputPath)));
  await fs.mkdir(outputFolder, { recursive: true });

  const derivatives = [];
  for (const plan of plans) {
    const deriv = await renderDerivative(inputPath, plan, settings as unknown as OptimiseSettings, outputFolder);
    derivatives.push(deriv);
  }

  const { img, picture } = generateHtmlSnippet(inputPath, derivatives, config, features.width, features.height);
  const manifest = generateManifest(inputPath, derivatives, features.width, features.height);

  return {
    status: 'success',
    inputPath,
    originalWidth: features.width,
    originalHeight: features.height,
    derivatives,
    htmlImg: img,
    htmlPicture: picture,
    manifest
  };
}

export async function processFile(task: WorkerTask): Promise<PipelineFileResult> {
  log.info(`Processing file: ${task.inputPath} (Mode: ${task.mode})`);
  const settings = toEffectiveSettings(task.settings, task.mode);
  const originalBuffer = await fs.readFile(task.inputPath);

  const features = await analyzeImage(originalBuffer);

  const backups: BackupRecord[] = [];
  const backupCache = new Map<string, string>();
  const actions: PipelineFileResult['actions'] = {};

  const commonRoot = task.commonRoot ?? path.dirname(task.inputPath);

  if (shouldOptimizeOriginal(settings.runMode)) {
    actions.optimised = await runOptimizeAction(
      task.inputPath,
      originalBuffer,
      features,
      settings,
      commonRoot,
      task.backupDir,
      backupCache,
      backups
    );
  }

  if (shouldCreateWebp(settings.runMode)) {
    actions.webp = await runWebpAction(
      task.inputPath,
      originalBuffer,
      features,
      settings,
      commonRoot,
      task.backupDir,
      backupCache,
      backups
    );
  }

  if (task.mode === 'responsive') {
    actions.responsive = await runResponsiveAction(
      task.inputPath,
      features,
      settings,
      commonRoot
    );
  }

  const hasSuccess = Object.values(actions).some((action) => action?.status === 'success');

  log.info(`Finished processing ${task.inputPath}. Status: ${hasSuccess ? 'success' : 'skipped'}`);

  return {
    inputPath: task.inputPath,
    originalBytes: originalBuffer.length,
    actions,
    backups,
    status: hasSuccess ? 'success' : 'skipped'
  };
}
