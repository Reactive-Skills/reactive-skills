import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

const block = (selector) => CSS.slice(CSS.indexOf(selector), CSS.indexOf('\n  }', CSS.indexOf(selector)));
const tokens = (selector) =>
  Object.fromEntries([...block(selector).matchAll(/--phino-([a-z-]+):\s*oklch\(([^)]+)\)/g)].map(([, name, v]) => [name, v.split(/\s+/).map(Number)]));

// OKLCH -> linear sRGB (Ottosson), then WCAG relative luminance.
const luminance = ([L, C, H]) => {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};
const contrast = (x, y) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

describe.each([
  ['light', ':where(:root)'],
  ['dark', ':where(.dark)'],
])('%s theme tokens', (_theme, selector) => {
  const t = tokens(selector);

  it.each(['text', 'text-muted', 'text-subtle', 'signal-text', 'guard-text', 'event-text', 'danger-text'])(
    '%s keeps 4.5:1 on canvas, surface and raised surface',
    (fg) => {
      for (const bg of ['canvas', 'surface', 'surface-raised']) {
        expect(contrast(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('keeps 4.5:1 for text on the signal button', () => {
    expect(contrast(t['signal-on'], t.signal)).toBeGreaterThanOrEqual(4.5);
  });
});
