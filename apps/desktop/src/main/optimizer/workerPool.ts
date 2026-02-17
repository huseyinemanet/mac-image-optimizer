import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type { WorkerResponse, WorkerTask } from '../../shared/types';

interface QueuedJob {
  task: WorkerTask;
  resolve: (value: WorkerResponse) => void;
  reject: (error: Error) => void;
}

interface WorkerState {
  worker: Worker;
  busy: boolean;
  current?: QueuedJob;
}

export function getAutoConcurrency(): number {
  const cores = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  return Math.max(1, Math.min(4, cores - 1));
}

export class WorkerPool {
  private readonly workers: WorkerState[] = [];
  private readonly queue: QueuedJob[] = [];

  constructor(size: number) {
    const workerPath = path.join(__dirname, 'optimiseWorker.js');
    const total = Math.max(1, size);

    for (let i = 0; i < total; i += 1) {
      const worker = new Worker(workerPath);
      const state: WorkerState = { worker, busy: false };

      worker.on('message', (result: WorkerResponse) => {
        if (!state.current) {
          return;
        }

        const { resolve } = state.current;
        state.current = undefined;
        state.busy = false;
        resolve(result);
        this.pump();
      });

      worker.on('error', (error) => {
        if (state.current) {
          state.current.reject(error);
          state.current = undefined;
        }
        state.busy = false;
        this.pump();
      });

      this.workers.push(state);
    }
  }

  run(task: WorkerTask): Promise<WorkerResponse> {
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.pump();
    });
  }

  async close(): Promise<void> {
    await Promise.all(this.workers.map((state) => state.worker.terminate()));
  }

  private pump(): void {
    const freeWorker = this.workers.find((item) => !item.busy);
    if (!freeWorker) {
      return;
    }

    const next = this.queue.shift();
    if (!next) {
      return;
    }

    freeWorker.busy = true;
    freeWorker.current = next;
    freeWorker.worker.postMessage(next.task);
  }
}
