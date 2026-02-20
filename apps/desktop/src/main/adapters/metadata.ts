import sharp from 'sharp';
import type { MetadataCleanupSettings } from '../../shared/types';

export interface MetadataReport {
	metadataAction?: 'Removed' | 'Kept' | 'Partial';
	iccAction?: 'Converted to sRGB' | 'Kept' | 'Stripped';
	gpsAction?: 'Removed' | 'Not present';
}

/**
 * Handles metadata stripping and color space normalization.
 */
export async function processMetadata(
	buffer: Buffer,
	settings: MetadataCleanupSettings,
	legacyKeepMetadata: boolean
): Promise<{ buffer: Buffer; report: MetadataReport }> {
	if (!settings?.enabled) {
		return {
			buffer,
			report: legacyKeepMetadata ? { metadataAction: 'Kept', iccAction: 'Kept' } : {}
		};
	}

	const pipeline = sharp(buffer);
	const info = await pipeline.metadata();
	const report: MetadataReport = {
		metadataAction: 'Kept',
		iccAction: 'Kept',
		gpsAction: info.exif?.includes(Buffer.from('GPS')) ? 'Removed' : 'Not present'
	};

	// 1. Color space normalization
	if (settings.iccHandling === 'srgb') {
		pipeline.toColourspace('srgb');
		report.iccAction = 'Converted to sRGB';
	} else if (settings.iccHandling === 'strip') {
		report.iccAction = 'Stripped';
	}

	// 2. Metadata stripping based on preset
	const stripAll = settings.preset === 'web-safe' || settings.preset === 'max-compression';

	if (stripAll || (settings.stripExif && settings.stripXmp && settings.stripIptc)) {
		// Sharp strips everything by default if withMetadata() is NOT called.
		report.metadataAction = 'Removed';
		if (info.exif?.includes(Buffer.from('GPS'))) {
			report.gpsAction = 'Removed';
		}
	} else {
		report.metadataAction = 'Partial';
		const withMetaOpts: any = {};
		if (settings.iccHandling === 'keep') withMetaOpts.icc = true;
		if (!settings.stripExif) withMetaOpts.exif = true;
		if (!settings.stripXmp) withMetaOpts.xmp = true;

		pipeline.withMetadata(withMetaOpts);
	}

	const processedBuffer = await pipeline.toBuffer();

	return {
		buffer: processedBuffer,
		report
	};
}
