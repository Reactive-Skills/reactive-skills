import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const images = new URL('../src/features/mods/images/', import.meta.url);

describe('mods screenshot assets', () => {
  it.each(['status-line', 'flow', 'flow-plan'])('ships a sharp, bounded %s capture', (name) => {
    const path = new URL(`${name}.png`, images);
    const png = readFileSync(path);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(1680);
    expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(200);
    expect(statSync(path).size).toBeLessThan(250_000);
  });
});
