import path from 'node:path';
import type { OutputMode } from '../../shared/types';

export { processFile } from './pipeline';
export { getJpegQualities, getWebpQualities, getPngQualityRanges, shouldSkipIfLarger } from './candidates';

export function isSupportedImagePath(inputPath: string): boolean {
  const ext = path.extname(inputPath).toLowerCase();
  return ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp';
}

export function shouldSkipForLargerOutput(originalBytes: number, outputBytes: number, allowLargerOutput: boolean): boolean {
  return !allowLargerOutput && outputBytes >= originalBytes;
}

export function getWebpQualityAttempts(baseQuality: number, nearLossless: boolean): number[] {
  const cap = nearLossless ? 100 : 95;
  const output: number[] = [];
  let current = baseQuality;

  for (let i = 0; i < 3; i += 1) {
    const value = Math.max(1, Math.min(cap, current));
    if (!output.includes(value)) {
      output.push(value);
    }
    current += 5;
  }

  return output;
}

export function resolveWebpOutputPath(
  inputPath: string,
  outputMode: OutputMode,
  _replaceWithWebp: boolean,
  _confirmDangerousWebpReplace: boolean
): string {
  const parsed = path.parse(inputPath);

  if (outputMode === 'subfolder') {
    return path.join(parsed.dir, 'Optimized', `${parsed.name}.webp`);
  }

  return path.join(parsed.dir, `${parsed.name}.webp`);
}

