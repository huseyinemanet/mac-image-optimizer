import { ensureParentDir, resolveToolPath, runTool } from './common';

interface OxipngOptions {
  keepMetadata: boolean;
}

export async function runOxipng(inputPath: string, outputPath: string, options: OxipngOptions): Promise<void> {
  const oxipng = await resolveToolPath('oxipng');
  await ensureParentDir(outputPath);

  const args = ['-o', '4', '--out', outputPath];

  if (!options.keepMetadata) {
    args.push('--strip', 'all');
  }

  args.push(inputPath);

  await runTool(oxipng, args);
}
