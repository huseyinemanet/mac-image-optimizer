import { ensureParentDir, resolveToolPath, runTool, ToolError } from './common';
import { Logger } from '../../logger';

const log = new Logger('Pngquant');

interface PngquantOptions {
  minQuality: number;
  maxQuality: number;
  keepMetadata: boolean;
}

export async function runPngquant(inputPath: string, outputPath: string, options: PngquantOptions): Promise<void> {
  const pngquant = await resolveToolPath('pngquant');
  await ensureParentDir(outputPath);

  const args = [
    '--force',
    '--output',
    outputPath,
    '--quality',
    `${options.minQuality}-${options.maxQuality}`,
    '--speed',
    '1',
    '--skip-if-larger'
  ];

  if (!options.keepMetadata) {
    args.push('--strip');
  }

  args.push(inputPath);

  try {
    await runTool(pngquant, args);
  } catch (error) {
    // pngquant exit code 99 = --skip-if-larger determined output is larger than input.
    // This is expected behaviour, not a real error.
    if (error instanceof ToolError && error.exitCode === 99) {
      log.info(`Pngquant skipped (output would be larger): ${inputPath}`);
      throw new Error('Pngquant skipped: output would be larger than input');
    }
    throw error;
  }
}
