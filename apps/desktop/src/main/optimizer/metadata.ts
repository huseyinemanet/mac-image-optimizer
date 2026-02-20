import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import type { EffectiveSettings, ActionDecision } from './types';

export interface MetadataReport {
	metadataAction?: 'Removed' | 'Kept' | 'Partial';
	iccAction?: 'Converted to sRGB' | 'Kept' | 'Stripped';
	gpsAction?: 'Removed' | 'Not present';
}

export interface PreparedImage {
	buffer: Buffer;
	path: string;
	report: MetadataReport;
	cleanup: () => Promise<void>;
}

export async function prepareImageMetadata(
	inputPath: string,
	originalBuffer: Buffer,
	settings: EffectiveSettings
): Promise<PreparedImage> {
	const noop = {
		buffer: originalBuffer,
		path: inputPath,
		report: {},
		cleanup: async () => { }
	};

	const metaConf = settings.metadataCleanup;
	// If disabled or legacy keepMetadata is true (and metadata config isn't explicitly overriding it in a complex way), bypass.
	if (!metaConf?.enabled) {
		if (settings.keepMetadata) {
			return { ...noop, report: { metadataAction: 'Kept', iccAction: 'Kept' } };
		}
		return noop;
	}

	const pipeline = sharp(originalBuffer);
	const info = await pipeline.metadata();

	const report: MetadataReport = {
		metadataAction: 'Kept',
		iccAction: 'Kept',
		gpsAction: 'Not present'
	};

	// We'll track what we're doing
	let needsProcessing = false;

	// 1. Auto-orient
	// If EXIF says it's rotated, we must bake it in BEFORE we strip EXIF
	if (info.orientation && info.orientation !== 1) {
		pipeline.rotate();
		needsProcessing = true;
	}

	// 2. ICC Profile Handling
	if (metaConf.iccHandling === 'srgb') {
		pipeline.toColourspace('srgb');
		report.iccAction = 'Converted to sRGB';
		needsProcessing = true;
	} else if (metaConf.iccHandling === 'strip') {
		// Stripping ICC usually happens if we don't explicitly keep it, 
		// but sharp might still enforce sRGB. We'll simply let sharp strip it by not passing it in withMetadata.
		report.iccAction = 'Stripped';
		needsProcessing = true;
	} else {
		report.iccAction = 'Kept';
	}

	// 3. Metadata stripping
	const stripAll = metaConf.preset === 'web-safe' || metaConf.preset === 'max-compression';
	const keepBasic = metaConf.preset === 'keep-camera-info' || metaConf.preset === 'keep-copyright';

	// Sharp's `withMetadata` takes options. If we omit `withMetadata`, ALL metadata (EXIF, ICC, XMP) is stripped.
	if (stripAll || (metaConf.stripExif && metaConf.stripXmp && metaConf.stripIptc && metaConf.iccHandling !== 'keep')) {
		// Just don't call withMetadata! Sharp strips everything by default.
		report.metadataAction = 'Removed';
		if (info.exif && info.exif.includes(Buffer.from('GPS'))) {
			report.gpsAction = 'Removed';
		}
		needsProcessing = true;
	} else {
		// We want to keep *some* metadata (like ICC, or EXIF)
		report.metadataAction = 'Partial';
		const withMetaOpts: sharp.WriteableMetadata = {};

		// In sharp 0.33+, we can pass booleans. If older, we might just pass the object and hope for the best.
		if (metaConf.iccHandling === 'keep') {
			(withMetaOpts as any).icc = true;
		}
		if (!metaConf.stripExif) {
			(withMetaOpts as any).exif = true;
		}
		if (!metaConf.stripXmp) {
			(withMetaOpts as any).xmp = true;
		}

		// Best-effort passing to Sharp
		// @ts-ignore - sharp typings might not be fully up to date with 0.33 feature set in older @types/sharp
		pipeline.withMetadata(withMetaOpts);
		needsProcessing = true;

		if (info.exif && info.exif.includes(Buffer.from('GPS')) && metaConf.gpsClean) {
			report.gpsAction = 'Removed';
			// Without exiftool, sharp cannot easily strip JUST the GPS bytes from the EXIF buffer in a safe way if EXIF is kept.
			// We will fallback to stripping all EXIF if GPS clean is mandated and we can't do it selectively.
			if (!metaConf.stripExif) {
				// Fallback: strip all EXIF to fulfill GPS clean
				// @ts-ignore
				pipeline.withMetadata({ ...withMetaOpts, exif: false });
				report.metadataAction = 'Removed';
			}
		}
	}

	if (!needsProcessing) {
		return noop;
	}

	// Output format matches input or falls back to WebP
	let format: keyof sharp.FormatEnum = 'webp';
	if (info.format === 'jpeg' || info.format === 'jpg') format = 'jpeg';
	if (info.format === 'png') format = 'png';
	if (info.format === 'tiff') format = 'tiff';
	if (info.format === 'heif' || info.format === 'avif') format = 'avif';

	// Perform the sharp transformation
	pipeline.toFormat(format as keyof sharp.FormatEnum, { quality: 100 }); // keep highest quality for temporary intermediate

	const newBuffer = await pipeline.toBuffer();

	// Save to a temporary file because our CLIs (pngquant, mozjpeg) need a valid file path
	const tmpPath = path.join(os.tmpdir(), `crunch-meta-${Date.now()}-${Math.random().toString(36).substring(2)}.${format}`);
	await fs.writeFile(tmpPath, newBuffer);

	return {
		buffer: newBuffer,
		path: tmpPath,
		report,
		cleanup: async () => {
			try { await fs.unlink(tmpPath); } catch { }
		}
	};
}
