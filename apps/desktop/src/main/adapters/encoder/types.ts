import type { SupportedImageType } from '../../../shared/types';

export interface EncodeOptions {
	format: SupportedImageType;
	quality?: number;
	effort?: number; // 4-6 for WebP
	nearLossless?: boolean;
	keepMetadata?: boolean;
	minQuality?: number; // For pngquant
	maxQuality?: number; // For pngquant
}

export interface EncodeResult {
	buffer: Buffer;
	format: SupportedImageType;
	qualityLabel: string;
}

/**
 * Common interface for all image encoders.
 */
export interface ImageEncoder {
	encode(input: string | Buffer, options: EncodeOptions): Promise<EncodeResult>;
}
