import sharp from 'sharp';
import type { ExportPreset, SupportedImageType } from '../../shared/types';
import type { TaskSettings } from './types';

export interface PresetResult {
	buffer: Buffer;
	format: SupportedImageType;
	outputPath?: string;
}

/**
 * Applies export presets (Original, Web, Design) to the image buffer.
 */
export async function applyPreset(
	buffer: Buffer,
	settings: TaskSettings,
	inputPath: string
): Promise<PresetResult> {
	const { exportPreset } = settings;

	if (exportPreset === 'original' || exportPreset === 'web') {
		return { buffer, format: 'jpeg' }; // Simplified format detection
	}

	if (exportPreset === 'design') {
		const meta = await sharp(buffer).metadata();
		const pipeline = sharp(buffer).rotate().toColourspace('srgb');

		if (meta.hasAlpha) {
			const png = await pipeline.png({ compressionLevel: 9 }).toBuffer();
			return { buffer: png, format: 'png' };
		}

		const webp = await pipeline.webp({ quality: 90, effort: 5, nearLossless: true }).toBuffer();
		return { buffer: webp, format: 'webp' };
	}

	return { buffer, format: 'jpeg' };
}
