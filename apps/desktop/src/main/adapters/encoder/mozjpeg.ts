import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { encodeMozjpeg } from '../../optimizer/tools/mozjpeg';
import type { ImageEncoder, EncodeOptions, EncodeResult } from './types';

export class MozjpegEncoder implements ImageEncoder {
	async encode(input: string | Buffer, options: EncodeOptions): Promise<EncodeResult> {
		const tempInput = path.join(os.tmpdir(), `moz-in-${Date.now()}-${Math.random().toString(16).slice(2)}`);
		const tempOutput = path.join(os.tmpdir(), `moz-out-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`);

		try {
			if (Buffer.isBuffer(input)) {
				await fs.writeFile(tempInput, input);
			} else {
				await fs.copyFile(input, tempInput);
			}

			await encodeMozjpeg(tempInput, tempOutput, {
				quality: options.quality ?? 80,
				keepMetadata: options.keepMetadata ?? false
			});

			const buffer = await fs.readFile(tempOutput);

			return {
				buffer,
				format: 'jpeg',
				qualityLabel: `mozjpeg-q${options.quality ?? 80}`
			};
		} finally {
			await fs.rm(tempInput, { force: true }).catch(() => { });
			await fs.rm(tempOutput, { force: true }).catch(() => { });
		}
	}
}
