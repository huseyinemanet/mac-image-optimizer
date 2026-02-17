import { describe, expect, it } from 'vitest';
import { getWebpQualityAttempts, resolveWebpOutputPath, shouldSkipForLargerOutput } from './optimiser';

describe('resolveWebpOutputPath', () => {
  it('maps to Optimized subfolder in subfolder mode', () => {
    const output = resolveWebpOutputPath('/tmp/photos/cat.png', 'subfolder', false, false);
    expect(output).toBe('/tmp/photos/Optimized/cat.webp');
  });

  it('maps next to original in replace mode', () => {
    const output = resolveWebpOutputPath('/tmp/photos/dog.jpg', 'replace', false, false);
    expect(output).toBe('/tmp/photos/dog.webp');
  });
});

describe('getWebpQualityAttempts', () => {
  it('increments quality in +5 steps and caps values', () => {
    expect(getWebpQualityAttempts(80, true)).toEqual([80, 85, 90]);
    expect(getWebpQualityAttempts(94, false)).toEqual([94, 95]);
  });
});

describe('shouldSkipForLargerOutput', () => {
  it('skips when candidate is larger and larger outputs are not allowed', () => {
    expect(shouldSkipForLargerOutput(1000, 1200, false)).toBe(true);
  });

  it('does not skip when larger outputs are allowed', () => {
    expect(shouldSkipForLargerOutput(1000, 1200, true)).toBe(false);
  });
});
