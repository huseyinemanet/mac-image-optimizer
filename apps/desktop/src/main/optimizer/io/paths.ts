import fs from 'node:fs/promises';
import path from 'node:path';
import type { OutputMode } from '../../../shared/types';

export interface BackupRecord {
  originalPath: string;
  backupPath: string;
  removeOnRestore?: string;
}

export function tempFilePath(targetPath: string): string {
  const tempDir = path.join(path.dirname(targetPath), '.optimise-tmp');
  const ext = path.extname(targetPath);
  const baseName = path.basename(targetPath, ext);
  // macOS filename limit is 255 bytes; keep the name short to avoid ENAMETOOLONG
  const truncatedBase = baseName.length > 80 ? baseName.slice(0, 80) : baseName;
  const tempName = `${Date.now()}-${Math.random().toString(16).slice(2)}-${truncatedBase}${ext}.tmp`;
  return path.join(tempDir, tempName);
}

export function webpPathFor(filePath: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}.webp`);
}

export function outputPathForOriginal(filePath: string, commonRoot: string, outputMode: OutputMode): string {
  if (outputMode === 'replace') {
    return filePath;
  }

  const relative = path.relative(commonRoot, filePath);
  return path.join(commonRoot, 'Optimized', relative);
}

export function outputPathForWebp(filePath: string, commonRoot: string, outputMode: OutputMode): string {
  if (outputMode === 'replace') {
    return webpPathFor(filePath);
  }

  const relative = path.relative(commonRoot, filePath);
  const parsed = path.parse(relative);
  return path.join(commonRoot, 'Optimized', parsed.dir, `${parsed.name}.webp`);
}

export function createBackupFilePath(backupDir: string, originalPath: string): string {
  const safeName = originalPath.replaceAll(path.sep, '_').replaceAll(':', '_');
  return path.join(backupDir, `${safeName}-${path.basename(originalPath)}`);
}

export async function ensureBackup(
  backupDir: string,
  originalPath: string,
  cache: Map<string, string>,
  records: BackupRecord[]
): Promise<string> {
  const existing = cache.get(originalPath);
  if (existing) {
    return existing;
  }

  const backupPath = createBackupFilePath(backupDir, originalPath);
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.copyFile(originalPath, backupPath);

  cache.set(originalPath, backupPath);
  records.push({ originalPath, backupPath });
  return backupPath;
}
