import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generatedFiles } from '../src/build-skills.ts';
import { fillerMessage } from '../src/filler.ts';
import { AXI_BIN, HARNESS_ROOT } from '../src/paths.ts';
import { shellWrites } from '../src/scorers/common.ts';
import { sanitize, stripHeredocs, testSummary } from '../src/trace.ts';
import { prepareWorkspace, verifyPinnedTdd } from '../src/workspace.ts';

test('generated skills are up to date with their sources', () => {
  for (const [file, content] of Object.entries(generatedFiles())) {
    assert.equal(fs.readFileSync(file, 'utf8'), content, `${path.relative(HARNESS_ROOT, file)} is stale; run npm run build-skills`);
  }
});

test('pinned tdd-refactor files match their Git blob hashes', () => {
  assert.doesNotThrow(verifyPinnedTdd);
});

test('flat tdd-refactor keeps every workflow phase in statechart order and drops runtime signals', () => {
  const flat = fs.readFileSync(path.join(HARNESS_ROOT, 'fixtures/skills/flat/tdd-refactor/SKILL.md'), 'utf8');
  const order = ['RED_SPEC', 'GREEN_CODE', 'REFACTOR.CLEAN_CODE', 'REFACTOR.PERF_AUDIT', 'AUDIT_VERIFY', 'COMPLETED'].map((s) => flat.indexOf(`: ${s} (`));
  assert.ok(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1])), `phase order ${order}`);
  assert.doesNotMatch(flat, /\bemit\b|reactive_|\{\{/);
  assert.match(flat, /\.docs\/tdd-refactor-summary\.md/);
});

test('filler is deterministic per seed and differs across seeds', () => {
  assert.equal(fillerMessage(7, 0, 5000, false).text, fillerMessage(7, 0, 5000, false).text);
  assert.notEqual(fillerMessage(7, 0, 5000, false).text, fillerMessage(8, 0, 5000, false).text);
  const message = fillerMessage(7, 3, 20000, true);
  assert.ok(message.bytes >= 20000 && message.bytes < 22000, `bytes ${message.bytes}`);
  assert.match(message.text, /carry on with your current task/);
});

test('shell write detection finds real targets and ignores heredoc bodies', () => {
  assert.deepEqual(shellWrites("cat > .work/triage.md <<'EOF'\nsee src/cart.ts > here\nEOF"), ['.work/triage.md']);
  assert.deepEqual(shellWrites("sed -i 's/a/b/' src/auth.ts"), ['src/auth.ts']);
  assert.deepEqual(shellWrites('npm test 2>&1 | tee out.log'), ['out.log']);
  assert.deepEqual(shellWrites('git checkout -- src/cart.ts'), ['src/cart.ts']);
  assert.deepEqual(shellWrites('npm test > /dev/null 2>&1; cat src/auth.ts'), []);
  assert.deepEqual(shellWrites("sed -i 's|a * b|c|' src/cart.ts && git checkout -q -b fix/x"), ['src/cart.ts']);
  assert.deepEqual(shellWrites('git diff src/auth.ts'), []);
});

test('trace sanitizing removes workspace paths, temp paths, UUIDs and heredoc bodies', () => {
  const ws = '/x/y/ws';
  const out = sanitize(`cd ${ws} && cat > ${ws}/a.md <<'EOF'\nsecret body\nEOF\nreactive-skills-axi state s --job 01a18bf1-3cac-7129-ad18-01d904366617 > /tmp/q/r`, ws);
  assert.doesNotMatch(out, /\/x\/y|secret body|01a18bf1|\/tmp\//);
  assert.match(out, /<uuid>/);
  const commit = sanitize('git -c user.name="Some Person" -c user.email="someone@example.com" commit', ws);
  assert.doesNotMatch(commit, /Some Person|someone@/);
  assert.match(stripHeredocs("cat <<EOF\nabc\nEOF"), /\[4 bytes\]/);
});

test('test summaries are read from node test runner output', () => {
  assert.deepEqual(testSummary('EXIT=1\n# pass 5\n# fail 1\n'), { pass: 5, fail: 1 });
  assert.equal(testSummary('no summary here'), undefined);
});

test('ship-bugfix guards check evidence and name the next step', { skip: !fs.existsSync(AXI_BIN) && 'build AXI first' }, () => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'adherence-guard-'));
  try {
    const { pathPrefix } = prepareWorkspace(ws, 'workflow', 'reactive');
    const env = { ...process.env, PATH: `${pathPrefix}${path.delimiter}${process.env.PATH}`, NODE_NO_WARNINGS: '1' };
    const axi = (...args: string[]) => execFileSync('reactive-skills-axi', args, { cwd: ws, env, encoding: 'utf8' });
    axi('invoke', 'ship-bugfix');
    assert.match(axi('emit', 'ship-bugfix', 'FIX_VERIFIED'), /out of order: the run is in TRIAGE\. Next: write \.work\/triage\.md/);
    assert.match(axi('emit', 'ship-bugfix', 'TRIAGE_DONE'), /does not exist/);
    fs.mkdirSync(path.join(ws, '.work'));
    fs.writeFileSync(path.join(ws, '.work/triage.md'), '## Observed\n## Root cause\n## Affected file\n## Fix plan\n');
    assert.match(axi('emit', 'ship-bugfix', 'TRIAGE_DONE'), /current_state: FIX\.REPRO/);
    assert.match(axi('emit', 'ship-bugfix', 'REPRO_FAILING'), /has no new test/);
    fs.appendFileSync(path.join(ws, 'tests/cart.test.ts'), "test('noop', () => {});\n");
    assert.match(axi('emit', 'ship-bugfix', 'REPRO_FAILING'), /npm test passes/);
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
});
