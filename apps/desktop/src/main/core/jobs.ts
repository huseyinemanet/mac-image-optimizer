import { EventEmitter } from 'node:events';
import type { JobEvent, JobStatus, JobProgress, JobResult, ImageTask } from './types';

/**
 * Manages the lifecycle and state transitions of an image processing job.
 */
export class JobStateMachine extends EventEmitter {
	private _status: JobStatus = 'queued';
	private _progress: JobProgress = { percent: 0, stage: 'analyzing' };
	private _result?: JobResult;

	constructor(public readonly task: ImageTask) {
		super();
	}

	get status(): JobStatus {
		return this._status;
	}

	get progress(): JobProgress {
		return this._progress;
	}

	get result(): JobResult | undefined {
		return this._result;
	}

	/**
	 * Transitions to 'running' state.
	 */
	start(): void {
		if (this._status !== 'queued') {
			throw new Error(`Cannot start job in state: ${this._status}`);
		}
		this._status = 'running';
		this.emitEvent();
	}

	/**
	 * Updates progress during 'running' state.
	 */
	updateProgress(percent: number, stage: JobProgress['stage']): void {
		if (this._status !== 'running') {
			return;
		}
		this._progress = { percent, stage };
		this.emitEvent();
	}

	/**
	 * Completes the job with success.
	 */
	succeed(result: Omit<JobResult, 'status'>): void {
		if (this._status !== 'running') {
			return;
		}
		this._status = 'success';
		this._result = { ...result, status: 'success' };
		this.emitEvent();
	}

	/**
	 * Fails the job.
	 */
	fail(result: Omit<JobResult, 'status'>): void {
		if (this._status !== 'running' && this._status !== 'queued') {
			return;
		}
		this._status = 'failed';
		this._result = { ...result, status: 'failed' };
		this.emitEvent();
	}

	/**
	 * Cancels the job.
	 */
	cancel(): void {
		if (this._status === 'success' || this._status === 'failed' || this._status === 'skipped') {
			return;
		}
		this._status = 'cancelled';
		this.emitEvent();
	}

	/**
	 * Skips the job.
	 */
	skip(reason: string, originalBytes: number): void {
		if (this._status !== 'queued' && this._status !== 'running') {
			return;
		}
		this._status = 'skipped';
		this._result = {
			status: 'skipped',
			originalBytes,
			outputBytes: originalBytes,
			bytesSaved: 0,
			warnings: [reason],
			timings: { totalMs: 0, stages: {} }
		};
		this.emitEvent();
	}

	private emitEvent(): void {
		const event: JobEvent = {
			jobId: this.task.id,
			status: this._status,
			progress: this._status === 'running' ? this._progress : undefined,
			result: this._result
		};
		this.emit('change', event);
	}
}
