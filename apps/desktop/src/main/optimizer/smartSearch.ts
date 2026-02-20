import { ActionDecision, EffectiveSettings } from './types';
import { analyzeImage, ImageFeatures } from './analysis';
import { computeMetrics, MetricResult } from './metrics/ssim';
import { encodeMozjpeg } from './tools/mozjpeg';
import { encodeCwebp } from './tools/cwebp';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

interface SearchResult {
	quality: number;
	metrics: MetricResult;
	buffer: Buffer;
}

const TARGET_THRESHOLDS = {
	'visually-lossless': 0.999,
	'high': 0.995,
	'balanced': 0.99,
	'small': 0.98,
	'custom': 0.99 // Default for custom if not specified, usually we use qualityGuardrail
};

export async function findOptimalQuality(
	inputPath: string,
	originalBuffer: Buffer,
	features: ImageFeatures,
	settings: EffectiveSettings,
	format: 'jpeg' | 'webp'
): Promise<SearchResult | null> {
	const targetThreshold = settings.smartTarget === 'custom'
		? (settings.qualityGuardrail / 100)
		: TARGET_THRESHOLDS[settings.smartTarget];

	let min = 10;
	let max = 95; // Avoid 100 as it's often not worth the size
	let best: SearchResult | null = null;

	const iterations = settings.optimizationSpeed === 'fast' ? 4 : (settings.optimizationSpeed === 'balanced' ? 6 : 8);

	// Bias for photos vs graphics
	if (!features.isPhoto && format === 'jpeg') {
		min = 70; // Graphics need higher quality in JPEG to avoid artifacts
	}

	for (let i = 0; i < iterations; i++) {
		const q = Math.floor((min + max) / 2);
		const candidate = await encodeAndMeasure(inputPath, originalBuffer, q, format, settings);

		if (candidate && candidate.metrics.mssim >= targetThreshold && candidate.metrics.bandingRisk < 0.05) {
			best = candidate;
			max = q - 1; // Try lower quality
		} else {
			min = q + 1; // Need higher quality
		}

		if (min > max) break;
	}

	return best;
}

async function encodeAndMeasure(
	inputPath: string,
	originalBuffer: Buffer,
	quality: number,
	format: 'jpeg' | 'webp',
	settings: EffectiveSettings
): Promise<SearchResult | null> {
	const out = path.join(os.tmpdir(), `smart-${Date.now()}-${Math.random().toString(16).slice(2)}.${format}`);
	try {
		if (format === 'jpeg') {
			await encodeMozjpeg(inputPath, out, { quality, keepMetadata: settings.keepMetadata });
		} else {
			await encodeCwebp(inputPath, out, {
				quality,
				effort: settings.webpEffort,
				nearLossless: settings.webpNearLossless,
				keepMetadata: settings.keepMetadata
			});
		}

		const candidateBuffer = await fs.readFile(out);
		const metrics = await computeMetrics(originalBuffer, candidateBuffer);

		return {
			quality,
			metrics,
			buffer: candidateBuffer
		};
	} catch (e) {
		return null;
	} finally {
		try { await fs.unlink(out); } catch { }
	}
}
