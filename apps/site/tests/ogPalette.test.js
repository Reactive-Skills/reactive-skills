import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OG_PALETTE } from '@/lib/og/palette';

const CSS = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

// OKLCH -> sRGB hex (Ottosson), the same conversion a browser applies to the token.
const toHex = ([L, C, H]) => {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return `#${[
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
    .map((v) => Math.min(1, Math.max(0, v)))
    .map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
    .map((v) => Math.round(v * 255).toString(16).padStart(2, '0'))
    .join('')}`;
};

const token = (name) => {
  const match = CSS.match(new RegExp(`--phino-${name}:\\s*oklch\\(([^)]+)\\)`));
  return toHex(match[1].split(/\s+/).map(Number));
};

describe('share image', () => {
  it.each([
    ['hero', 'hero'],
    ['ink', 'hero-ink'],
    ['muted', 'hero-muted'],
    ['lime', 'lime'],
  ])('paints %s with the --phino-%s token', (key, name) => {
    expect(OG_PALETTE[key]).toBe(token(name));
  });
});
