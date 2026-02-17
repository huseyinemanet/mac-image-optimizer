import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import type { SupportedImageType } from '../../../shared/types';

interface TemplateInput {
  inputPath: string;
  targetPath: string;
  outputBuffer: Buffer;
  format: SupportedImageType;
  template: string;
  applyTemplate: boolean;
}

function extensionFor(format: SupportedImageType): string {
  if (format === 'jpeg') {
    return 'jpg';
  }
  return format;
}

function detectScale(inputPath: string, width?: number, height?: number): string {
  if (/@2x(\.[^.]+)?$/i.test(path.basename(inputPath))) {
    return '2x';
  }
  if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0 && width % 2 === 0 && height % 2 === 0) {
    return '2x';
  }
  return '1x';
}

function sanitizeFileName(input: string): string {
  const cleaned = input
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned : 'image';
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureCollisionFree(basePath: string): Promise<string> {
  const parsed = path.parse(basePath);
  let candidate = basePath;
  let index = 2;

  while (await pathExists(candidate)) {
    candidate = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }

  return candidate;
}

export async function resolveOutputPathFromTemplate(input: TemplateInput): Promise<string> {
  if (!input.applyTemplate) {
    return input.targetPath;
  }

  const pattern = (input.template || '{name}').trim() || '{name}';
  const meta = await sharp(input.outputBuffer).metadata();
  const ext = extensionFor(input.format);
  const hash = crypto.createHash('sha1').update(input.outputBuffer).digest('hex').slice(0, 8);
  const parsedInput = path.parse(input.inputPath);

  const variables: Record<string, string> = {
    name: parsedInput.name,
    ext,
    width: String(meta.width ?? 0),
    height: String(meta.height ?? 0),
    scale: detectScale(input.inputPath, meta.width, meta.height),
    format: ext,
    hash
  };

  const rendered = pattern.replace(/\{(name|ext|width|height|scale|format|hash)\}/g, (_match, key: string) => variables[key] ?? '');
  const cleanedName = sanitizeFileName(rendered).replace(/\.(jpg|jpeg|png|webp|tif|tiff)$/i, '');

  const nextPath = path.join(path.dirname(input.targetPath), `${cleanedName}.${ext}`);
  return ensureCollisionFree(nextPath);
}
