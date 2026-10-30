// Project checks: `npm test`, `npm run lint` and `npm run typecheck` all run through this file.
// Each run appends one line to .harness/checks.jsonl so a reviewer can audit what was run and when.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const tracked = pkg.harness?.tracked ?? [];
const kind = process.argv[2];

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, ext);
    return entry.name.endsWith(ext) ? [full] : [];
  });
}

function runTests() {
  const files = listFiles(path.join(root, 'tests'), '.test.ts');
  const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, encoding: 'utf8' });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  return result.status ?? 1;
}

function runLint() {
  const problems = [];
  for (const file of listFiles(path.join(root, 'src'), '.ts')) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      const where = `${path.relative(root, file)}:${index + 1}`;
      if (/\s+$/.test(line)) problems.push(`${where} trailing whitespace`);
      if (line.length > 100) problems.push(`${where} line longer than 100 characters`);
      if (/\bvar\s/.test(line)) problems.push(`${where} use let or const instead of var`);
      if (/console\.log\(/.test(line)) problems.push(`${where} console.log in source`);
    });
  }
  for (const problem of problems) console.log(problem);
  console.log(problems.length === 0 ? 'lint: no problems' : `lint: ${problems.length} problem(s)`);
  return problems.length === 0 ? 0 : 1;
}

// Strips type annotations and parses the result; it catches syntax errors, not type errors.
function runTypecheck() {
  let failed = 0;
  for (const file of [...listFiles(path.join(root, 'src'), '.ts'), ...listFiles(path.join(root, 'tests'), '.ts')]) {
    try {
      const js = stripTypeScriptTypes(fs.readFileSync(file, 'utf8'));
      const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: js, encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr.split('\n').find((line) => line.includes('Error')) ?? 'syntax error');
    } catch (error) {
      failed += 1;
      console.log(`${path.relative(root, file)}: ${error.message}`);
    }
  }
  console.log(failed === 0 ? 'typecheck: ok' : `typecheck: ${failed} file(s) failed`);
  return failed === 0 ? 0 : 1;
}

const runners = { test: runTests, lint: runLint, typecheck: runTypecheck };
if (!runners[kind]) {
  console.error(`usage: node scripts/check.mjs <${Object.keys(runners).join('|')}>`);
  process.exit(2);
}
const exitCode = runners[kind]();
const hashes = Object.fromEntries(
  tracked.map((file) => {
    const full = path.join(root, file);
    const digest = fs.existsSync(full) ? createHash('sha256').update(fs.readFileSync(full)).digest('hex').slice(0, 16) : null;
    return [file, digest];
  })
);
fs.mkdirSync(path.join(root, '.harness'), { recursive: true });
fs.appendFileSync(
  path.join(root, '.harness', 'checks.jsonl'),
  JSON.stringify({ at: Date.now(), kind, exit_code: exitCode, source: process.env.HARNESS_CHECK_SOURCE ?? 'agent', hashes }) + '\n'
);
process.exit(exitCode);
