import sharp from 'sharp';

export interface ImageFeatures {
	width: number;
	height: number;
	aspectRatio: number;
	hasAlpha: boolean;
	isGrayscale: boolean;
	edgeDensity: number; // Mean Sobel magnitude
	textureLevel: number; // Laplacian energy / local variance proxy
	flatRegionRatio: number; // Percent of pixels with low gradient
	isPhoto: boolean; // Heuristic classification
}

const ANALYSIS_SIZE = 1024;

export async function analyzeImage(buffer: Buffer): Promise<ImageFeatures> {
	const image = sharp(buffer);
	const metadata = await image.metadata();

	const width = metadata.width || 0;
	const height = metadata.height || 0;
	const hasAlpha = metadata.hasAlpha || false;

	// Downscale for faster analysis
	const downscaled = image
		.resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'inside', withoutEnlargement: true })
		.toColourspace('srgb');

	const { data, info } = await downscaled.raw().toBuffer({ resolveWithObject: true });
	const pixels = new Uint8ClampedArray(data);
	const channels = info.channels;
	const area = info.width * info.height;

	let totalSobel = 0;
	let totalLaplacian = 0;
	let flatPixels = 0;
	let isGrayscale = true;

	// Simple Sobel and Laplacian kernels on a single channel (Luminance)
	// For speed, we'll convert to luminance on the fly if needed, or just use the first channel if it's grayscale
	for (let i = 0; i < pixels.length; i += channels) {
		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];

		if (r !== g || g !== b) {
			isGrayscale = false;
		}
	}

	// To keep it simple and fast, we'll use sharp's built-in stats and a few custom passes if needed.
	// Actually, let's use a more robust way to get these features without manual pixel looping if possible,
	// but for edge density and texture, a custom pass is often better.

	// Edge density (Sobel)
	const edgeImage = await downscaled.clone().greyscale().convolve({
		width: 3,
		height: 3,
		kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1] // Sobel X (simplified)
	}).raw().toBuffer();

	const edgePixels = new Uint8ClampedArray(edgeImage);
	for (let i = 0; i < edgePixels.length; i++) {
		totalSobel += edgePixels[i];
		if (edgePixels[i] < 10) {
			flatPixels++;
		}
	}

	// Texture Level (Laplacian)
	const laplaceImage = await downscaled.clone().greyscale().convolve({
		width: 3,
		height: 3,
		kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
	}).raw().toBuffer();

	const laplacePixels = new Uint8ClampedArray(laplaceImage);
	for (let i = 0; i < laplacePixels.length; i++) {
		totalLaplacian += Math.abs(laplacePixels[i]);
	}

	const edgeDensity = totalSobel / area;
	const textureLevel = totalLaplacian / area;
	const flatRegionRatio = flatPixels / area;

	// Classification heuristic
	// Photos typically have high texture level and lower flat region ratio.
	// Graphics/UI have very sharp edges (high edge density) but often large flat regions.
	const isPhoto = textureLevel > 5 && flatRegionRatio < 0.8;

	return {
		width,
		height,
		aspectRatio: width / height,
		hasAlpha,
		isGrayscale,
		edgeDensity,
		textureLevel,
		flatRegionRatio,
		isPhoto
	};
}
