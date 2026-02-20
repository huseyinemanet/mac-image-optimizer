import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { encodeCwebp } from '../../optimizer/tools/cwebp';
import type { ImageEncoder, EncodeOptions, EncodeResult } from './types';

export class CwebpEncoder implements ImageEncoder {
	async encode(input: string | Buffer, options: EncodeOptions): Promise<EncodeResult> {
		const tempInput = path.join(os.tmpdir(), `webp-in-${Date.now()}-${Math.random().toString(16).slice(2)}`);
		const tempOutput = path.join(os.tmpdir(), `webp-out-${Date.now()}-${Math.random().toString(16).slice(2)}.webp`);

		try {
			if (Buffer.isBuffer(input)) {
				await fs.writeFile(tempInput, input);
			} else {
				await fs.copyFile(input, tempInput);
			}

			await encodeCwebp(tempInput, tempOutput, {
				quality: options.quality ?? 80,
				effort: options.effort ?? 5,
				nearLossless: options.nearLossless ?? false,
				keepMetadata: options.keepMetadata ?? false
			});

			const buffer = await fs.readFile(tempOutput);

			return {
				buffer,
				format: 'webp',
				qualityLabel: `cwebp-q${options.quality ?? 80}`
			};
		} finally {
			await fs.rm(tempInput, { force: true }).catch(() => { });
			await fs.rm(tempOutput, { force: true }).catch(() => { });
		}
	}
}
