export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);

  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatElapsed(elapsedMs: number): string {
  const seconds = Math.max(0, Math.round(elapsedMs / 1000));
  return `00:${String(seconds).padStart(2, '0')}`;
}

export function formatPercent(beforeBytes: number, afterBytes: number): number {
  if (beforeBytes <= 0 || afterBytes < 0 || afterBytes > beforeBytes) {
    return 0;
  }
  return Math.round(((beforeBytes - afterBytes) / beforeBytes) * 100);
}

export function formatSizeCell(file: {
  status: string;
  beforeBytes: number;
  afterBytes?: number;
}): string {
  const before = formatBytes(file.beforeBytes);
  const hasAfter = typeof file.afterBytes === 'number' && file.afterBytes >= 0;
  const showArrow = hasAfter && file.status !== 'Skipped' && file.status !== 'Failed' && file.status !== 'Cancelled';

  if (!showArrow) {
    return before;
  }

  return `${before} → ${formatBytes(file.afterBytes!)}`;
}
