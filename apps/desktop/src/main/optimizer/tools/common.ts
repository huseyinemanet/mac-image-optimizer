import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { Logger } from '../../logger';

const log = new Logger('Tools');
const toolPathCache = new Map<string, string>();

export class ToolError extends Error {
  exitCode: number | undefined;
  constructor(message: string, exitCode?: number) {
    super(message);
    this.name = 'ToolError';
    this.exitCode = exitCode;
  }
}

function candidateBinDirs(): string[] {
  const fromCwd = path.join(process.cwd(), 'resources', 'bin');
  const fromAppPath = (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'bin') : undefined;
  const fromParent = path.join(process.cwd(), '..', '..', 'resources', 'bin');
  return [fromCwd, fromAppPath, fromParent].filter((d): d is string => d !== undefined);
}

export async function resolveToolPath(binary: string): Promise<string> {
  const cached = toolPathCache.get(binary);
  if (cached) return cached;

  const checked: string[] = [];
  for (const dir of candidateBinDirs()) {
    const full = path.join(dir, binary);
    checked.push(full);
    try {
      await fs.access(full);
      log.info(`Resolved tool ${binary} at ${full}`);
      toolPathCache.set(binary, full);
      return full;
    } catch {
      continue;
    }
  }

  log.error(`Failed to resolve tool ${binary}. Checked: ${checked.join(', ')}`);
  throw new Error(`Missing optimizer binary: ${binary}. Expected under resources/bin.`);
}

export async function runTool(binaryPath: string, args: string[]): Promise<void> {
  log.info(`Running tool: ${binaryPath} ${args.join(' ')}`);
  await new Promise<void>((resolve, reject) => {
    execFile(binaryPath, args, { maxBuffer: 1024 * 1024 * 8 }, (error: Error | null, stdout: string, stderr: string) => {
      if (stdout) log.debug(`Tool stdout: ${stdout.trim()}`);
      if (stderr) log.debug(`Tool stderr: ${stderr.trim()}`);

      if (error) {
        const detail = stderr?.trim();
        const exitCode = (error as any).code as number | undefined;
        log.error(`Tool error (exit ${exitCode}): ${error.message} - ${detail}`);
        reject(new ToolError(detail ? `${error.message}: ${detail}` : error.message, typeof exitCode === 'number' ? exitCode : undefined));
        return;
      }
      log.info(`Tool completed successfully: ${path.basename(binaryPath)}`);
      resolve();
    });
  });
}

export async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

