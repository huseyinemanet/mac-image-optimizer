import path from 'node:path';
import sharp from 'sharp';
import type { SupportedImageType } from '../../shared/types';
import type { EffectiveSettings } from './types';

export interface ExportPresetInput {
  inputPath: string;
  targetPath: string;
  buffer: Buffer;
  format: SupportedImageType;
  settings: EffectiveSettings;
}

export interface ExportPresetOutput {
  targetPath: string;
  buffer: Buffer;
  format: SupportedImageType;
}

interface RetinaInfo {
  isRetina: boolean;
  scale: 1 | 2;
}

function detectRetina(inputPath: string, width?: number, height?: number): RetinaInfo {
  const byName = /@2x(\.[^.]+)?$/i.test(path.basename(inputPath));
  const bySize = typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0 && width % 2 === 0 && height % 2 === 0;
  const isRetina = byName || bySize;
  return { isRetina, scale: isRetina ? 2 : 1 };
}

function toDesignTargetPath(targetPath: string): string {
  const normalized = targetPath.replaceAll('\\', '/');
  const marker = '/Optimized/';

  if (!normalized.includes(marker)) {
    return targetPath;
  }

  return targetPath.replace(`${path.sep}Optimized${path.sep}`, `${path.sep}Optimized${path.sep}design${path.sep}`);
}

async function encodeDesignPngOrWebp(inputPath: string, originalBuffer: Buffer): Promise<{ buffer: Buffer; format: SupportedImageType }> {
  const meta = await sharp(originalBuffer).metadata();
  const _retina = detectRetina(inputPath, meta.width, meta.height);

  const pipeline = sharp(originalBuffer)
    .rotate()
    .toColourspace('srgb');

  if (meta.hasAlpha) {
    const png = await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10, palette: false }).toBuffer();
    return { buffer: png, format: 'png' };
  }

  // Avoid UI edge artifacts by keeping high quality and disabling heavy chroma loss.
  const webp = await pipeline.webp({ quality: 90, effort: 5, smartSubsample: true, nearLossless: true }).toBuffer();
  return { buffer: webp, format: 'webp' };
}

function withFormatExt(targetPath: string, format: SupportedImageType): string {
  const parsed = path.parse(targetPath);
  if (format === 'jpeg') {
    return path.join(parsed.dir, `${parsed.name}.jpg`);
  }
  if (format === 'png') {
    return path.join(parsed.dir, `${parsed.name}.png`);
  }
  return path.join(parsed.dir, `${parsed.name}.webp`);
}

export async function applyExportPreset(input: ExportPresetInput): Promise<ExportPresetOutput> {
  const { inputPath, targetPath, buffer, format, settings } = input;

  if (settings.exportPreset === 'original') {
    return { targetPath, buffer, format };
  }

  if (settings.exportPreset === 'web') {
    return { targetPath, buffer, format };
  }

  let nextTargetPath = targetPath;
  if (settings.outputMode === 'subfolder') {
    nextTargetPath = toDesignTargetPath(nextTargetPath);
  }

  const ext = path.extname(inputPath).toLowerCase();
  const isPngInput = ext === '.png';

  if (isPngInput && settings.outputMode === 'subfolder') {
    const design = await encodeDesignPngOrWebp(inputPath, buffer);
    return {
      targetPath: withFormatExt(nextTargetPath, design.format),
      buffer: design.buffer,
      format: design.format
    };
  }

  // Normalize orientation and force sRGB without writing DPI metadata.
  const normalized = await sharp(buffer).rotate().toColourspace('srgb').toBuffer();
  return {
    targetPath: withFormatExt(nextTargetPath, format),
    buffer: normalized,
    format
  };
}
