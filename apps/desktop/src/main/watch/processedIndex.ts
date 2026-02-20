import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export interface FileFingerprint {
	size: number;
	mtime: number;
	hash: string;
}

interface ProcessedIndexData {
	version: number;
	// Key is absolute path, value is fingerprint
	index: Record<string, FileFingerprint>;
}

export class ProcessedIndexStore {
	private readonly indexPath: string;
	private index: Record<string, FileFingerprint> = {};
	private dirty = false;
	private saveTimer: NodeJS.Timeout | null = null;

	constructor(userDataPath: string) {
		this.indexPath = path.join(userDataPath, 'processed-index.json');
	}

	async init(): Promise<void> {
		try {
			const raw = await fs.readFile(this.indexPath, 'utf-8');
			const data = JSON.parse(raw) as ProcessedIndexData;
			this.index = data.index || {};
		} catch {
			this.index = {};
		}
	}

	hasBeenProcessed(filePath: string, fingerprint: FileFingerprint): boolean {
		const existing = this.index[filePath];
		if (!existing) return false;

		return (
			existing.size === fingerprint.size &&
			existing.mtime === fingerprint.mtime &&
			existing.hash === fingerprint.hash
		);
	}

	markProcessed(filePath: string, fingerprint: FileFingerprint): void {
		this.index[filePath] = fingerprint;
		this.dirty = true;
		this.scheduleSave();
	}

	remove(filePath: string): void {
		if (this.index[filePath]) {
			delete this.index[filePath];
			this.dirty = true;
			this.scheduleSave();
		}
	}

	async getFingerprint(filePath: string): Promise<FileFingerprint> {
		const stat = await fs.stat(filePath);
		const hash = await this.computeFastHash(filePath, stat.size);
		return {
			size: stat.size,
			mtime: stat.mtimeMs,
			hash
		};
	}

	private async computeFastHash(filePath: string, size: number): Promise<string> {
		// For large files, hash first 1MB and last 1MB + size
		const SAMPLE_SIZE = 1024 * 1024; // 1MB
		const hash = crypto.createHash('sha1');
		hash.update(String(size));

		let fd: fs.FileHandle | null = null;
		try {
			fd = await fs.open(filePath, 'r');

			if (size <= SAMPLE_SIZE * 2) {
				const buffer = await fs.readFile(filePath);
				hash.update(buffer);
			} else {
				const firstBuffer = Buffer.alloc(SAMPLE_SIZE);
				await fd.read(firstBuffer, 0, SAMPLE_SIZE, 0);
				hash.update(firstBuffer);

				const lastBuffer = Buffer.alloc(SAMPLE_SIZE);
				await fd.read(lastBuffer, 0, SAMPLE_SIZE, size - SAMPLE_SIZE);
				hash.update(lastBuffer);
			}
		} finally {
			await fd?.close();
		}

		return hash.digest('hex');
	}

	private scheduleSave(): void {
		if (this.saveTimer) return;

		this.saveTimer = setTimeout(async () => {
			await this.save();
			this.saveTimer = null;
		}, 2000); // Batch saves every 2s
	}

	async save(): Promise<void> {
		if (!this.dirty) return;

		const data: ProcessedIndexData = {
			version: 1,
			index: this.index
		};

		try {
			await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
			await fs.writeFile(this.indexPath, JSON.stringify(data, null, 2), 'utf-8');
			this.dirty = false;
		} catch (error) {
			console.error('Failed to save processed index:', error);
		}
	}
}
