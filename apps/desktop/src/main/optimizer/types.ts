import type { ExportPreset, OptimiseSettings, OutputMode, RunMode, SupportedImageType } from '../../shared/types';

export const JPEG_AUTO_QUALITIES = [88, 84, 80, 76, 72] as const;
export const WEBP_AUTO_QUALITIES = [82, 78, 74, 70] as const;

export const SSIM_THRESHOLD_NORMAL = 0.995;
export const SSIM_THRESHOLD_AGGRESSIVE = 0.99;

export interface EffectiveSettings {
  outputMode: OutputMode;
  exportPreset: ExportPreset;
  namingPattern: string;
  runMode: RunMode;
  keepMetadata: boolean;
  allowLargerOutput: boolean;
  aggressivePng: boolean;
  reencodeExistingWebp: boolean;
  replaceWithWebp: boolean;
  confirmDangerousWebpReplace: boolean;
  deleteOriginalAfterWebp: boolean;
  jpegQualityMode: 'auto' | 'fixed';
  jpegQuality: number;
  webpQualityMode: 'auto' | 'fixed';
  webpQuality: number;
  webpNearLossless: boolean;
  webpEffort: number;
  qualityGuardrailSsim: boolean;
}

export interface CandidateResult {
  buffer: Buffer;
  bytes: number;
  qualityLabel: string;
  format: SupportedImageType;
  ssim?: number;
}

export interface ActionDecision {
  status: 'success' | 'skipped' | 'failed';
  outputPath?: string;
  originalBytes: number;
  outputBytes: number;
  bytesSaved: number;
  reason?: string;
}

export interface PipelineFileResult {
  inputPath: string;
  originalBytes: number;
  actions: {
    optimised?: ActionDecision;
    webp?: ActionDecision;
  };
  backups: Array<{ originalPath: string; backupPath: string; removeOnRestore?: string }>;
  status: 'success' | 'skipped';
  message?: string;
}

export function toEffectiveSettings(settings: OptimiseSettings, runMode: RunMode): EffectiveSettings {
  const jpegQuality = Number.isFinite(settings.jpegQuality) ? Math.max(1, Math.min(100, settings.jpegQuality)) : 82;
  const webpQuality = Number.isFinite(settings.webpQuality) ? Math.max(1, Math.min(100, settings.webpQuality)) : 80;

  return {
    outputMode: settings.outputMode,
    exportPreset: settings.exportPreset ?? 'web',
    namingPattern: settings.namingPattern ?? '{name}',
    runMode,
    keepMetadata: settings.keepMetadata,
    allowLargerOutput: settings.allowLargerOutput,
    aggressivePng: settings.aggressivePng,
    reencodeExistingWebp: settings.reencodeExistingWebp,
    replaceWithWebp: settings.replaceWithWebp,
    confirmDangerousWebpReplace: settings.confirmDangerousWebpReplace,
    deleteOriginalAfterWebp: settings.deleteOriginalAfterWebp,
    jpegQualityMode: settings.jpegQualityMode ?? 'auto',
    jpegQuality,
    webpQualityMode: settings.webpQualityMode ?? 'auto',
    webpQuality,
    webpNearLossless: settings.webpNearLossless,
    webpEffort: Math.max(4, Math.min(6, settings.webpEffort || 5)),
    qualityGuardrailSsim: settings.qualityGuardrailSsim
  };
}
