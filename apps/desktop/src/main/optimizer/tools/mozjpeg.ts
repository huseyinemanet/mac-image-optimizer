import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import sharp from 'sharp';
import { ensureParentDir, resolveToolPath, runTool } from './common';

interface MozjpegOptions {
  quality: number;
  keepMetadata: boolean;
}

export async function encodeMozjpeg(inputPath: string, outputPath: string, options: MozjpegOptions): Promise<void> {
  const cjpeg = await resolveToolPath('cjpeg');
  await ensureParentDir(outputPath);

  // cjpeg only accepts raw formats (BMP, PPM, Targa), not JPEG.
  // Decompress the input to a temporary PPM (P6) first using sharp.
  const tmpPpm = path.join(os.tmpdir(), `mo-${Date.now()}-${Math.random().toString(36).slice(2)}.ppm`);

  try {
    const img = sharp(inputPath);
    const meta = await img.metadata();
    const rawPixels = await img.removeAlpha().raw().toBuffer();

    // Write binary PPM (P6) file
    const header = `P6\n${meta.width} ${meta.height}\n255\n`;
    const headerBuf = Buffer.from(header);
    const ppmBuf = Buffer.concat([headerBuf, rawPixels]);
    await fs.writeFile(tmpPpm, ppmBuf);

    const args = [
      '-quality',
      String(options.quality),
      '-progressive',
      '-optimize',
      '-outfile',
      outputPath,
      tmpPpm
    ];

    await runTool(cjpeg, args);
  } finally {
    // Clean up temp PPM
    await fs.unlink(tmpPpm).catch(() => { });
  }
}


