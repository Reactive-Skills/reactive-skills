import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Directories where engine output lands when a test omits `workspaceDir`. */
export const OUTPUT_BASES = [repoRoot, path.join(repoRoot, 'packages', 'runtime'), path.join(repoRoot, 'apps', 'axi')];
const OUTPUT_DIRS = ['.docs', '.reactive'];
const MAX_DEPTH = 4;

function collectDirs(dir, depth, found) {
  if (!fs.existsSync(dir)) return;
  found.add(dir);
  if (depth >= MAX_DEPTH) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) collectDirs(path.join(dir, entry.name), depth + 1, found);
  }
}

/** Record every directory under `.docs/` and `.reactive/` in the output bases. */
export function snapshotTestOutput(bases = OUTPUT_BASES) {
  const found = new Set();
  for (const base of bases) {
    for (const name of OUTPUT_DIRS) collectDirs(path.join(base, name), 1, found);
  }
  return found;
}

/** Throw when a test run created directories under `.docs/` or `.reactive/` outside a temp workspace. */
export function assertNoNewTestOutput(before, bases = OUTPUT_BASES) {
  const created = [...snapshotTestOutput(bases)].filter((dir) => !before.has(dir)).sort();
  if (created.length === 0) return;
  const shown = created.slice(0, 10).map((dir) => `  ${path.relative(repoRoot, dir) || '.'}`);
  const more = created.length > 10 ? [`  ...and ${created.length - 10} more`] : [];
  throw new Error(
    [
      `Tests wrote ${created.length} director${created.length === 1 ? 'y' : 'ies'} into the repository:`,
      ...shown,
      ...more,
      'Pass a temporary workspaceDir to every FSMEngine or MCP server a test creates.',
    ].join('\n')
  );
}
