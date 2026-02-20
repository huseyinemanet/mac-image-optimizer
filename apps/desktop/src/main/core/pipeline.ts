import fs from 'node:fs/promises';
import path from 'node:path';
import { Logger } from '../logger';
import { JobStateMachine } from './jobs';
import type { ImageTask, JobResult } from './types';
import { atomicWrite } from '../adapters/fs';
import { outputPathForOriginal, outputPathForWebp } from '../optimizer/io/paths';
import { buildDerivativePlan, renderDerivative, generateHtmlSnippet, generateManifest } from '../optimizer/responsive';
import { SharpEncoder, MozjpegEncoder, CwebpEncoder, type ImageEncoder } from '../adapters/encoder';
import { processMetadata } from '../adapters/metadata';
import { applyPreset } from './presets';

const log = new Logger('CorePipeline');

/**
 * Orchestrates the execution of an ImageTask.
 */
export async function runTask(task: ImageTask, state: JobStateMachine): Promise<JobResult> {
	const start = Date.now();
	const stages: Record<string, number> = {};
	const warnings: string[] = [];

	try {
		state.start();

		// 1. Read original
		state.updateProgress(10, 'decoding');
		const originalBuffer = await fs.readFile(task.inputPath);
		const originalBytes = originalBuffer.length;
		stages['read'] = Date.now() - start;

		// 2. Metadata handling
		state.updateProgress(20, 'analyzing');
		const { buffer: preppedBuffer, report: metaReport } = await processMetadata(
			originalBuffer,
			task.settings.metadataCleanup,
			task.settings.keepMetadata
		);
		stages['metadata'] = Date.now() - (start + (stages['read'] || 0));

		// Responsive branch: generate derivatives and snippets
		if (task.settings.mode === 'responsive') {
			state.updateProgress(40, 'transforming');
			const imageMeta = await (await import('sharp')).default(preppedBuffer).metadata();
			const originalWidth = imageMeta.width ?? 0;
			const originalHeight = imageMeta.height ?? 0;
			const baseDir = path.dirname(
				outputPathForOriginal(task.inputPath, task.commonRoot ?? path.dirname(task.inputPath), task.settings.outputMode)
			);
			const plan = await buildDerivativePlan(task.inputPath, task.settings.responsiveSettings, originalWidth);
			const derivatives = [] as Awaited<ReturnType<typeof renderDerivative>>[];
			for (const item of plan) {
				const derivative = await renderDerivative(task.inputPath, item, task.settings, baseDir);
				derivatives.push(derivative);
			}
			const snippets = generateHtmlSnippet(task.inputPath, derivatives, task.settings.responsiveSettings, originalWidth, originalHeight);
			const manifest = generateManifest(task.inputPath, derivatives, originalWidth, originalHeight);
			const totalOutputBytes = derivatives.reduce((sum, d) => sum + d.size, 0);
			const result: JobResult = {
				status: 'success',
				outputPath: baseDir,
				originalBytes: preppedBuffer.length,
				outputBytes: totalOutputBytes,
				bytesSaved: 0,
				timings: { totalMs: Date.now() - start, stages },
				warnings,
				responsive: {
					status: 'success',
					inputPath: task.inputPath,
					originalWidth,
					originalHeight,
					derivatives,
					htmlImg: snippets.img,
					htmlPicture: snippets.picture,
					manifest
				}
			};
			state.succeed(result);
			return result;
		}

		// 3. Apply Presets
		state.updateProgress(40, 'transforming');
		const presetResult = await applyPreset(preppedBuffer, task.settings, task.inputPath);
		stages['preset'] = Date.now() - (start + (stages['read'] || 0) + (stages['metadata'] || 0));

		// 4. Select Encoder & Encode
		state.updateProgress(60, 'encoding');
		const encoder = selectEncoder(task);
		const encodeStart = Date.now();

		const targetFormat = task.settings.mode === 'convertWebp' ? 'webp' : presetResult.format;

		const encodeResult = await encoder.encode(presetResult.buffer, {
			format: targetFormat,
			quality: targetFormat === 'webp' ? task.settings.webpQuality : task.settings.jpegQuality,
			keepMetadata: task.settings.keepMetadata,
			effort: task.settings.webpEffort,
			nearLossless: task.settings.webpNearLossless
		});
		stages['encode'] = Date.now() - encodeStart;

		// 5. Determine Output Path respecting outputMode and webp mode
		const targetPath = targetFormat === 'webp'
			? outputPathForWebp(task.inputPath, task.commonRoot ?? path.dirname(task.inputPath), task.settings.outputMode)
			: outputPathForOriginal(task.inputPath, task.commonRoot ?? path.dirname(task.inputPath), task.settings.outputMode);

		// 6. Write Output
		state.updateProgress(80, 'writing');
		const writeStart = Date.now();

		const writeResult = await atomicWrite(targetPath, encodeResult.buffer, {
			backupDir: task.backupDir,
			expectedFormat: encodeResult.format
		});

		if (!writeResult.success) {
			throw new Error(`Write failed: ${writeResult.error}`);
		}
		stages['write'] = Date.now() - writeStart;

		// 7. Verify & Finalize
		state.updateProgress(95, 'verifying');
		const totalMs = Date.now() - start;

		const result: JobResult = {
			status: 'success',
			outputPath: writeResult.path,
                backupPath: writeResult.backupPath,
			originalBytes,
			outputBytes: encodeResult.buffer.length,
			bytesSaved: Math.max(0, originalBytes - encodeResult.buffer.length),
			timings: { totalMs, stages },
			warnings
		};

		state.succeed({ ...result, ...metaReport });
		return result;

	} catch (error) {
		const totalMs = Date.now() - start;
		const message = error instanceof Error ? error.message : String(error);

		const result: JobResult = {
			status: 'failed',
			originalBytes: 0,
			outputBytes: 0,
			bytesSaved: 0,
			error: {
				code: 'E_UNKNOWN',
				message,
				retryable: true
			},
			timings: { totalMs, stages },
			warnings
		};

		state.fail(result);
		return result;
	}
}

function selectEncoder(task: ImageTask): ImageEncoder {
	const mode = task.settings.mode;
	if (mode === 'convertWebp') {
		return new CwebpEncoder();
	}
	return new MozjpegEncoder();
}
