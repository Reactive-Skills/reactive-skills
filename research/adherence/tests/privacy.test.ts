// Committed results and fixtures must hold only public fixture content: no personal data, host paths or session IDs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { HARNESS_ROOT } from '../src/paths.ts';

const SCANNED = ['results', 'fixtures', 'config', 'README.md'];
const FORBIDDEN: [string, RegExp][] = [
  ['email address', /[\w.+-]+@(?!example\.invalid\b)[\w-]+\.[\w.]+/],
  ['home path', /\/home\/|\/Users\/|\/root\//],
  ['temp path', /\/tmp\/|\/private\/var\//],
  ['UUID', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i],
  ['session reference', /session_[0-9A-Za-z]{10,}|claude\.ai\/code\/session/],
  ['git identity', /user\.(name|email)(=|\s+)(?!\\?["']?(<name>|<email>|fixture))/],
  ['credential', /sk-ant-|x-api-key|ANTHROPIC_API_KEY=\S/],
];

function files(rel: string): string[] {
  const full = path.join(HARNESS_ROOT, rel);
  if (!fs.existsSync(full)) return [];
  if (rel === path.join('results', 'smoke')) return []; // local smoke runs are git-ignored
  if (fs.statSync(full).isFile()) return [full];
  return fs.readdirSync(full).flatMap((name) => files(path.join(rel, name)));
}

test('committed results, fixtures and docs contain no private or host-specific data', () => {
  const problems: string[] = [];
  for (const file of SCANNED.flatMap(files)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const [label, pattern] of FORBIDDEN) {
      const match = text.match(pattern);
      if (match) problems.push(`${path.relative(HARNESS_ROOT, file)}: ${label} (${match[0].slice(0, 40)})`);
    }
  }
  assert.deepEqual(problems, []);
});
