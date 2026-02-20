import sharp from 'sharp';
import type { ImageEncoder, EncodeOptions, EncodeResult } from './types';

export class SharpEncoder implements ImageEncoder {
	async encode(input: string | Buffer, options: EncodeOptions): Promise<EncodeResult> {
		let pipeline = sharp(input);

		if (options.keepMetadata) {
			pipeline = pipeline.withMetadata();
		}

		switch (options.format) {
			case 'jpeg':
				pipeline = pipeline.jpeg({
					quality: options.quality ?? 80,
					mozjpeg: true,
					progressive: true
				});
				break;
			case 'webp':
				pipeline = pipeline.webp({
					quality: options.quality ?? 80,
					effort: options.effort ?? 5,
					nearLossless: options.nearLossless ?? false,
					smartSubsample: true
				});
				break;
			case 'png':
				pipeline = pipeline.png({
					compressionLevel: 9,
					palette: true
				});
				break;
		}

		const buffer = await pipeline.toBuffer();

		return {
			buffer,
			format: options.format,
			qualityLabel: `sharp-${options.quality ?? 'default'}`
		};
	}
}
