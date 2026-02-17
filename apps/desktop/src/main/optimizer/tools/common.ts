import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';

function binName(base: string): string {
  return process.platform === 'win32' ? `${base}.exe` : base;
}

function candidateBinDirs(): string[] {
  const fromCwd = path.join(process.cwd(), 'resources', 'bin');
  const fromAppPath = path.join(process.resourcesPath, 'bin');
  const fromParent = path.join(process.cwd(), '..', '..', 'resources', 'bin');
  return [fromCwd, fromAppPath, fromParent];
}

export async function resolveToolPath(binary: string): Promise<string> {
  const binaryName = binName(binary);
  for (const dir of candidateBinDirs()) {
    const full = path.join(dir, binaryName);
    try {
      await fs.access(full);
      return full;
    } catch {
      continue;
    }
  }

  throw new Error(`Missing optimizer binary: ${binaryName}. Expected under resources/bin.`);
}

export async function runTool(binaryPath: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(binaryPath, args, { windowsHide: true, maxBuffer: 1024 * 1024 * 8 }, (error, _stdout, stderr) => {
      if (error) {
        const detail = stderr?.trim();
        reject(new Error(detail ? `${error.message}: ${detail}` : error.message));
        return;
      }
      resolve();
    });
  });
}

export async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}
