import { ensureParentDir, resolveToolPath, runTool } from './common';

interface CwebpOptions {
  quality: number;
  effort: number;
  nearLossless: boolean;
  keepMetadata: boolean;
}

export async function encodeCwebp(inputPath: string, outputPath: string, options: CwebpOptions): Promise<void> {
  const cwebp = await resolveToolPath('cwebp');
  await ensureParentDir(outputPath);

  const args = [
    '-m',
    String(options.effort),
    '-metadata',
    options.keepMetadata ? 'all' : 'none'
  ];

  if (options.nearLossless) {
    args.push('-near_lossless', String(options.quality), '-q', '100');
  } else {
    args.push('-q', String(options.quality));
  }

  args.push(inputPath, '-o', outputPath);

  await runTool(cwebp, args);
}
