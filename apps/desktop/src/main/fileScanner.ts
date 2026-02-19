import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { ImageListItem } from '../shared/types';
import { isSupportedImagePath } from './optimizer';

const IGNORE_DIRS = new Set(['node_modules', '.git', '.optimise-backup', '.optimise-tmp', 'Optimized', 'Originals Backup', '.optimise-logs']);
const IGNORE_FILES = new Set(['.DS_Store']);

async function walkDir(root: string, output: string[]): Promise<void> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }
      await walkDir(entryPath, output);
      continue;
    }

    if (entry.isFile()) {
      if (IGNORE_FILES.has(entry.name)) {
        continue;
      }
      if (isSupportedImagePath(entryPath)) {
        output.push(entryPath);
      }
    }
  }
}

export async function resolveInputPaths(rawPaths: string[]): Promise<string[]> {
  const collected: string[] = [];

  for (const inputPath of rawPaths) {
    try {
      const stat = await fs.stat(inputPath);
      if (stat.isDirectory()) {
        await walkDir(inputPath, collected);
      } else if (stat.isFile() && isSupportedImagePath(inputPath)) {
        collected.push(inputPath);
      }
    } catch {
      continue;
    }
  }

  return Array.from(new Set(collected));
}

export async function scanImageList(paths: string[]): Promise<ImageListItem[]> {
  const resolved = await resolveInputPaths(paths);

  const items = await Promise.all(
    resolved.map(async (imagePath) => {
      try {
        const [stat, metadata] = await Promise.all([fs.stat(imagePath), sharp(imagePath).metadata()]);

        return {
          path: imagePath,
          name: path.basename(imagePath),
          size: stat.size,
          ext: path.extname(imagePath).slice(1).toLowerCase(),
          width: metadata.width ?? 0,
          height: metadata.height ?? 0
        } satisfies ImageListItem;
      } catch {
        return null;
      }
    })
  );

  return items.filter((item): item is ImageListItem => item !== null);
}
