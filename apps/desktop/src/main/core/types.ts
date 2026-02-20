import type { SupportedImageType, ExportPreset, RunMode, ResponsiveSettings, MetadataCleanupSettings, OutputMode, ResponsiveResult } from '../../shared/types';

/**
 * Represents a single image processing job.
 */
export interface ImageTask {
	id: string;
	inputPath: string;
	settings: TaskSettings;
	commonRoot?: string;
	backupDir?: string;
}

export interface TaskSettings {
	mode: RunMode;
	outputMode: OutputMode;
	exportPreset: ExportPreset;
	namingPattern: string;
	keepMetadata: boolean;
	allowLargerOutput: boolean;
	aggressivePng: boolean;
	reencodeExistingWebp: boolean;
	replaceWithWebp: boolean;
	confirmDangerousWebpReplace: boolean;
	deleteOriginalAfterWebp: boolean;
	jpegQualityMode: 'auto' | 'fixed';
	jpegQuality: number;
	webpQualityMode: 'auto' | 'fixed';
	webpQuality: number;
	webpNearLossless: boolean;
	webpEffort: number;
	qualityGuardrailSsim: boolean;
	smartCompressionMode: boolean;
	smartTarget: 'visually-lossless' | 'high' | 'balanced' | 'small' | 'custom';
	qualityGuardrail: number;
	optimizationSpeed: 'fast' | 'balanced' | 'thorough';
	responsiveSettings: ResponsiveSettings;
	metadataCleanup: MetadataCleanupSettings;
}

/**
 * Job State Machine states.
 */
export type JobStatus =
	| 'queued'
	| 'running'
	| 'success'
	| 'failed'
	| 'cancelled'
	| 'skipped';

/**
 * Progress details for a running job.
 */
export interface JobProgress {
	percent: number; // 0-100
	stage: 'analyzing' | 'decoding' | 'transforming' | 'encoding' | 'writing' | 'verifying' | 'cleaning';
}

/**
 * Result of a completed job.
 */
export interface JobResult {
	status: JobStatus;
	outputPath?: string;
	backupPath?: string;
	responsive?: ResponsiveResult;
	originalBytes: number;
	outputBytes: number;
	bytesSaved: number;
	error?: JobError;
	timings: {
		totalMs: number;
		stages: Record<string, number>;
	};
	warnings: string[];
}

/**
 * Standardized error object for job failures.
 */
export interface JobError {
	code: 'E_DECODE' | 'E_ENCODE' | 'E_WRITE' | 'E_PERMISSION' | 'E_LOCKED' | 'E_UNSUPPORTED' | 'E_UNKNOWN';
	message: string;
	retryable: boolean;
	debug?: {
		stack?: string;
		context?: any;
	};
}

/**
 * Event emitted when a job state changes.
 */
export interface JobEvent {
	jobId: string;
	status: JobStatus;
	progress?: JobProgress;
	result?: JobResult;
}
