import fs from 'node:fs/promises';

export interface StabilityCheckOptions {
	intervalMs: number;
	stabilityThreshold: number; // consecutive unchanged checks
	timeoutMs: number;
}

export class StabilityChecker {
	constructor(private readonly options: StabilityCheckOptions = {
		intervalMs: 500,
		stabilityThreshold: 3,
		timeoutMs: 30000
	}) { }

	async waitUntilStable(filePath: string): Promise<boolean> {
		let lastSize = -1;
		let lastMtime = -1;
		let stableCount = 0;
		const startTime = Date.now();

		while (Date.now() - startTime < this.options.timeoutMs) {
			try {
				const stat = await fs.stat(filePath);

				if (stat.size === lastSize && stat.mtimeMs === lastMtime) {
					stableCount++;
				} else {
					stableCount = 0;
					lastSize = stat.size;
					lastMtime = stat.mtimeMs;
				}

				if (stableCount >= this.options.stabilityThreshold) {
					return true;
				}
			} catch (error) {
				// File might have disappeared
				return false;
			}

			await new Promise(resolve => setTimeout(resolve, this.options.intervalMs));
		}

		return false; // Timed out
	}
}
