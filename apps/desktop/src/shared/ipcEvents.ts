/**
 * Standardized IPC event names and payloads for Crunch refactor.
 */
export const IPC_EVENTS = {
	JOB_ADDED: 'job:added',
	JOB_UPDATED: 'job:updated',
	JOB_FINISHED: 'job:finished',
	QUEUE_STATS: 'queue:stats'
} as const;

export interface JobUpdatePayload {
	jobId: string;
	inputPath?: string;
	status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped';
	progress?: {
		percent: number;
		stage: string;
	};
	result?: {
		outputPath?: string;
		originalBytes: number;
		outputBytes: number;
		bytesSaved: number;
		error?: {
			code: string;
			message: string;
		};
	};
}
