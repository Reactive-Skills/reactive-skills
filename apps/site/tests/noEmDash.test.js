import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const EM_DASH = String.fromCharCode(0x2014);
const SITE_ROOT = fileURLToPath(new URL('../', import.meta.url));

const SCANNED = [
  'src/app/page.js',
  'src/app/registry',
  'src/components/site',
  'src/features/blog',
  'src/features/landing',
  'src/features/registry',
  'src/features/telemetry',
  'src/infrastructure/content/landing',
];

const listFiles = (target) =>
  statSync(target).isFile() ? [target] : readdirSync(target).flatMap((name) => listFiles(join(target, name)));

describe('site UI copy', () => {
  it('contains no em dashes', () => {
    const offenders = SCANNED.map((path) => join(SITE_ROOT, path))
      .flatMap(listFiles)
      .filter((file) => /\.(js|jsx|mjs)$/.test(file))
      .filter((file) => readFileSync(file, 'utf8').includes(EM_DASH))
      .map((file) => relative(SITE_ROOT, file));
    expect(offenders).toEqual([]);
  });
});
