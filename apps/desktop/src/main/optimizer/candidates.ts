import type { SupportedImageType } from '../../shared/types';
import {
  JPEG_AUTO_QUALITIES,
  SSIM_THRESHOLD_AGGRESSIVE,
  SSIM_THRESHOLD_NORMAL,
  WEBP_AUTO_QUALITIES,
  type EffectiveSettings
} from './types';

export function getSsimThreshold(settings: EffectiveSettings): number {
  if (!settings.qualityGuardrailSsim) {
    return 0; // Bypass: everything is accepted
  }
  return settings.aggressivePng ? SSIM_THRESHOLD_AGGRESSIVE : SSIM_THRESHOLD_NORMAL;
}

export function getJpegQualities(settings: EffectiveSettings): number[] {
  if (settings.jpegQualityMode === 'fixed') {
    return [settings.jpegQuality];
  }
  return [...JPEG_AUTO_QUALITIES];
}

export function getWebpQualities(settings: EffectiveSettings): number[] {
  if (settings.webpQualityMode === 'fixed') {
    return [settings.webpQuality];
  }
  return [...WEBP_AUTO_QUALITIES];
}

export function getPngQualityRanges(settings: EffectiveSettings): Array<{ min: number; max: number; label: string }> {
  if (settings.aggressivePng) {
    return [
      { min: 80, max: 95, label: '80-95' },
      { min: 75, max: 90, label: '75-90' },
      { min: 70, max: 85, label: '70-85' }
    ];
  }

  return [{ min: 80, max: 95, label: '80-95' }];
}

export function shouldCreateWebp(mode: EffectiveSettings['runMode']): boolean {
  return mode === 'convertWebp' || mode === 'optimizeAndWebp';
}

export function shouldOptimizeOriginal(mode: EffectiveSettings['runMode']): boolean {
  return mode === 'optimize' || mode === 'optimizeAndWebp';
}

export function isSupportedImageType(ext: string): ext is SupportedImageType {
  return ext === 'jpeg' || ext === 'png' || ext === 'webp';
}

export function shouldSkipIfLarger(originalBytes: number, candidateBytes: number, settings: EffectiveSettings): boolean {
  return !settings.allowLargerOutput && candidateBytes >= originalBytes;
}

export function getOutputFormatForPath(inputPath: string): SupportedImageType | null {
  const lower = inputPath.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'jpeg';
  }
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) {
    return 'jpeg';
  }
  if (lower.endsWith('.png')) {
    return 'png';
  }
  if (lower.endsWith('.webp')) {
    return 'webp';
  }
  return null;
}
