import sharp from 'sharp';
import { ssim } from 'ssim.js';

const MAX_COMPARE_SIZE = 512;

interface RawFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

async function decodeForCompare(input: Buffer, width?: number, height?: number): Promise<RawFrame> {
  const pipeline = sharp(input)
    .toColourspace('srgb')
    .ensureAlpha();

  if (width && height) {
    pipeline.resize(width, height, { fit: 'fill' });
  } else {
    pipeline.resize(MAX_COMPARE_SIZE, MAX_COMPARE_SIZE, { fit: 'inside', withoutEnlargement: true });
  }

  const raw = await pipeline.raw().toBuffer({ resolveWithObject: true });

  return {
    width: raw.info.width,
    height: raw.info.height,
    data: new Uint8ClampedArray(raw.data)
  };
}

export async function computeSsim(original: Buffer, candidate: Buffer): Promise<number> {
  const base = await decodeForCompare(original);
  const test = await decodeForCompare(candidate, base.width, base.height);

  const result = ssim(
    { data: base.data, width: base.width, height: base.height },
    { data: test.data, width: test.width, height: test.height }
  );

  return result.mssim;
}
