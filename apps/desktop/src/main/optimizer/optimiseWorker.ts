import { parentPort } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import type { WorkerTask, WorkerResponse, ActionResult } from '../../shared/types';
import { JobStateMachine } from '../core/jobs';
import { runTask } from '../core/pipeline';
import { toEffectiveSettings } from './types';
import type { ImageTask, JobResult } from '../core/types';

if (!parentPort) {
	throw new Error('Worker must run in worker_threads context');
}

function mapResultToAction(result: JobResult): ActionResult {
	return {
		status: result.status === 'success' ? 'success' : result.status === 'skipped' ? 'skipped' : 'failed',
		reason: result.error?.message,
		outputPath: result.outputPath,
		originalBytes: result.originalBytes,
		outputBytes: result.outputBytes,
		bytesSaved: result.bytesSaved,
		metadataAction: (result as any).metadataAction,
		iccAction: (result as any).iccAction,
		gpsAction: (result as any).gpsAction
	};
}

parentPort.on('message', async (task: WorkerTask) => {
	try {
		const effective = toEffectiveSettings(task.settings, task.mode);
		const job: ImageTask = {
			id: randomUUID(),
			inputPath: task.inputPath,
			settings: { ...effective, mode: task.mode },
			backupDir: task.backupDir,
			commonRoot: task.commonRoot
		};

		const state = new JobStateMachine(job);
		const result = await runTask(job, state);

		const actions: any = {};
		if (task.mode === 'convertWebp') {
			actions.webp = mapResultToAction(result);
		} else if (task.mode === 'responsive') {
			actions.responsive = result.responsive;
		} else {
			actions.optimised = mapResultToAction(result);
		}

		const backups = result.backupPath ? [{ originalPath: task.inputPath, backupPath: result.backupPath }] : [];

		const response: WorkerResponse = {
			ok: true,
			inputPath: task.inputPath,
			originalBytes: result.originalBytes,
			actions,
			backups,
			status: result.status === 'success' ? 'success' : result.status === 'skipped' ? 'skipped' : 'failed',
			message: result.error?.message
		};

		parentPort?.postMessage(response);
	} catch (error) {
		const response: WorkerResponse = {
			ok: false,
			inputPath: task.inputPath,
			message: error instanceof Error ? error.message : String(error)
		};
		parentPort?.postMessage(response);
	}
});
