import sharp from 'sharp';
import { ssim } from 'ssim.js';

const MAX_COMPARE_SIZE = 1024; // Increased for better accuracy in smart mode

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

export interface MetricResult {
  mssim: number;
  edgeSsim: number;
  bandingRisk: number;
}

export async function computeMetrics(original: Buffer, candidate: Buffer): Promise<MetricResult> {
  const base = await decodeForCompare(original);
  const test = await decodeForCompare(candidate, base.width, base.height);

  const res = ssim(
    { data: base.data, width: base.width, height: base.height },
    { data: test.data, width: test.width, height: test.height }
  );

  // Simple edge-masked SSIM:
  // We can compute a mask from the original image (Sobel) and weight the SSIM map.
  // However, ssim.js doesn't easily expose the map without some extra work.
  // For now, let's implement a simple banding risk check.

  const bandingRisk = await computeBandingRisk(base, test);

  return {
    mssim: res.mssim,
    edgeSsim: res.mssim, // Placeholder for now, refine if needed
    bandingRisk
  };
}

async function computeBandingRisk(base: RawFrame, test: RawFrame): Promise<number> {
  // Banding risk heuristic: 
  // Compare histogram differences in low-gradient (flat) regions.
  // If the candidate has significantly fewer unique colors in a flat region, it's a banding risk.

  let risk = 0;
  const pixels = base.data;
  const testPixels = test.data;
  const width = base.width;
  const height = base.height;

  // Sample a few blocks to keep it fast
  const blockSize = 32;
  const samples = 10;

  for (let s = 0; s < samples; s++) {
    const x = Math.floor(Math.random() * (width - blockSize));
    const y = Math.floor(Math.random() * (height - blockSize));

    let isFlat = true;
    const colors = new Set();
    const testColors = new Set();

    for (let i = 0; i < blockSize; i++) {
      for (let j = 0; j < blockSize; j++) {
        const idx = ((y + i) * width + (x + j)) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        const tr = testPixels[idx];
        const tg = testPixels[idx + 1];
        const tb = testPixels[idx + 2];

        colors.add(`${r},${g},${b}`);
        testColors.add(`${tr},${tg},${tb}`);

        // Check if flat region (very simple neighbor check)
        if (j > 0) {
          const prevIdx = idx - 4;
          if (Math.abs(r - pixels[prevIdx]) > 5) isFlat = false;
        }
      }
    }

    if (isFlat && colors.size > testColors.size * 1.5) {
      risk += (colors.size - testColors.size) / colors.size;
    }
  }

  return risk / samples;
}

// Re-export original computeSsim for compatibility
export async function computeSsim(original: Buffer, candidate: Buffer): Promise<number> {
  const result = await computeMetrics(original, candidate);
  return result.mssim;
}
