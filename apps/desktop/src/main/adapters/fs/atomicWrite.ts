import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { Logger } from '../../logger';

const log = new Logger('FSAdapter');

export interface WriteOptions {
	backupDir?: string;
	expectedFormat?: 'jpeg' | 'png' | 'webp';
	skipValidation?: boolean;
}

export interface WriteResult {
	success: boolean;
	path: string;
	backupPath?: string;
	error?: string;
}

/**
 * Safely writes a buffer to a target path using an atomic rename operation.
 * Supports automatic backup and validation.
 */
export async function atomicWrite(
	targetPath: string,
	buffer: Buffer,
	options: WriteOptions = {}
): Promise<WriteResult> {
	const tmpPath = `${targetPath}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
	let backupPath: string | undefined;

	try {
		// 1. Ensure target directory exists
		await fs.mkdir(path.dirname(targetPath), { recursive: true });

		// 2. Write to .tmp file
		await fs.writeFile(tmpPath, buffer);

		// 3. Quick-verify the written file
		if (!options.skipValidation) {
			const stats = await fs.stat(tmpPath);
			if (stats.size === 0) {
				throw new Error('Verification failed: written file is empty');
			}

			if (options.expectedFormat) {
				const meta = await sharp(tmpPath).metadata();
				if (meta.format !== options.expectedFormat) {
					throw new Error(`Verification failed: expected ${options.expectedFormat}, got ${meta.format}`);
				}
			}
		}

		// 4. Handle backup if original exists and backupDir is provided
		const exists = await fs.access(targetPath).then(() => true).catch(() => false);
		if (exists && options.backupDir) {
			const safeName = targetPath.replaceAll(path.sep, '_').replaceAll(':', '_');
			backupPath = path.join(options.backupDir, `${safeName}-${path.basename(targetPath)}.bak`);
			await fs.mkdir(path.dirname(backupPath), { recursive: true });
			await fs.copyFile(targetPath, backupPath);
			log.debug(`Backup created: ${backupPath}`);
		}

		// 5. Atomic rename .tmp to target
		await fs.rename(tmpPath, targetPath);

		return {
			success: true,
			path: targetPath,
			backupPath
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		log.error(`Atomic write failed for ${targetPath}: ${message}`);

		// Cleanup tmp file on failure
		try {
			await fs.rm(tmpPath, { force: true });
		} catch {
			// ignore
		}

		return {
			success: false,
			path: targetPath,
			error: message
		};
	}
}
