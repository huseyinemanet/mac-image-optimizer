import { ensureParentDir, resolveToolPath, runTool } from './common';

interface MozjpegOptions {
  quality: number;
  keepMetadata: boolean;
}

export async function encodeMozjpeg(inputPath: string, outputPath: string, options: MozjpegOptions): Promise<void> {
  const cjpeg = await resolveToolPath('cjpeg');
  await ensureParentDir(outputPath);

  const args = [
    '-quality',
    String(options.quality),
    '-progressive',
    '-optimize',
    '-copy',
    options.keepMetadata ? 'all' : 'none',
    '-outfile',
    outputPath,
    inputPath
  ];

  await runTool(cjpeg, args);
}
