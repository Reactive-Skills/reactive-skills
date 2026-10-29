import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const run = promisify(execFile);

function declaredFiles(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(declaredFiles);
  return [];
}

describe('Published package entrypoints', () => {
  it.each(['packages/runtime', 'apps/axi'])('packs every declared entry file for %s', async (relativeRoot) => {
    const packageRoot = path.join(repositoryRoot, relativeRoot);
    const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-skills-package-entries-'));
    try {
      const { stdout } = await run('pnpm', ['pack', '--pack-destination', destination, '--json'], {
        cwd: packageRoot,
        timeout: 30_000,
      });
      const packed = JSON.parse(stdout) as { filename: string; files: Array<{ path: string }> };
      expect(fs.existsSync(packed.filename)).toBe(true);
      const files = packed.files.map(file => file.path);
      const entries = [manifest.main, manifest.types, manifest.typings, manifest.module, manifest.exports, manifest.bin]
        .flatMap(declaredFiles);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(files, `${manifest.name}: declared entry ${entry} is absent from the packed tarball`)
          .toContain(entry.replace(/^\.\//, ''));
      }
    } finally {
      fs.rmSync(destination, { recursive: true, force: true });
    }
  }, 60_000);
});
