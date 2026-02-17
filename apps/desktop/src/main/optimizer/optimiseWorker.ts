import { parentPort } from 'node:worker_threads';
import type { WorkerResponse, WorkerTask } from '../../shared/types';
import { processFile } from './pipeline';

if (!parentPort) {
  throw new Error('Worker must run in worker_threads context');
}

async function runTask(task: WorkerTask): Promise<WorkerResponse> {
  const result = await processFile(task);

  return {
    ok: true,
    inputPath: result.inputPath,
    originalBytes: result.originalBytes,
    actions: result.actions,
    backups: result.backups,
    status: result.status,
    message: result.message
  };
}

parentPort.on('message', async (task: WorkerTask) => {
  try {
    const response = await runTask(task);
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
