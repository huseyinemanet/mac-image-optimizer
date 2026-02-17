import { ensureParentDir, resolveToolPath, runTool } from './common';

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

  await runTool(pngquant, args);
}
