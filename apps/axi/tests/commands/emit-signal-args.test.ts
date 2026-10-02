import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { emitCommand } from '../../src/commands/emit.js';

// DOD_AMENDMENT_REQUIRED is long enough to resemble an event ID, which is how
// `emit <skill> <signal> --payload @file` once emitted a signal named `--payload`.
const SIGNAL = 'DOD_AMENDMENT_REQUIRED';

describe('emit signal and payload arguments', () => {
  let tmpDir: string;
  let originalCwd: string;
  let jobCounter = 0;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-axi-emit-args-'));
    process.chdir(tmpDir);

    const skillDir = path.join(tmpDir, 'skills', 'args-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'skill.yaml'),
      `schema_version: "2.1.0"
name: "args-skill"
description: "Emit argument parsing fixture"
initial_state: "ARCHITECT"
states:
  ARCHITECT:
    prompt_template: states/architect.md
    transitions:
      ${SIGNAL}:
        target: "DOD_AMENDMENT"
        guard: "payload.contextUpdates && payload.contextUpdates.decision === 'D15'"
  DOD_AMENDMENT:
    prompt_template: states/dod_amendment.md
`
    );
    fs.writeFileSync(path.join(skillDir, 'states', 'architect.md'), '# Architect');
    fs.writeFileSync(path.join(skillDir, 'states', 'dod_amendment.md'), '# DoD amendment');
    fs.writeFileSync(path.join(tmpDir, 'payload.json'), JSON.stringify({ contextUpdates: { decision: 'D15' } }));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    const target = fs.realpathSync(tmpDir);
    expect(path.dirname(target)).toBe(fs.realpathSync(os.tmpdir()));
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
  });

  const nextJob = () => `args-job-${++jobCounter}`;
  const payloadJson = JSON.stringify({ contextUpdates: { decision: 'D15' } });

  it.each([
    ['--payload with a file', [SIGNAL, '--payload', '@payload.json']],
    ['--payload with JSON', [SIGNAL, '--payload', payloadJson]],
    ['--payload= with a file', [SIGNAL, '--payload=@payload.json']],
    ['--payload before the signal', ['--payload', '@payload.json', SIGNAL]],
    ['a positional file', [SIGNAL, '@payload.json']],
    ['positional JSON', [SIGNAL, payloadJson]],
  ])('emits a long signal with %s', async (_name, signalArgs) => {
    const output = await emitCommand(['args-skill', ...signalArgs, '--job', nextJob()]);

    expect(output).not.toContain('error:');
    expect(output).toContain(`signal: ${SIGNAL}`);
    expect(output).toContain('transitioned: "true"');
    expect(output).toContain('current_state: DOD_AMENDMENT');
  });

  it('still accepts an explicit causation event ID before a long signal', async () => {
    const output = await emitCommand([
      'args-skill', '01a06e96-8414-7c46-bf87-dd09d5547385', SIGNAL, '--payload', '@payload.json', '--job', nextJob(),
    ]);

    expect(output).toContain(`signal: ${SIGNAL}`);
    expect(output).toContain('current_state: DOD_AMENDMENT');
  });

  it('rejects an unknown flag instead of emitting it as a signal', async () => {
    const output = await emitCommand(['args-skill', SIGNAL, '--paylod', '@payload.json', '--job', nextJob()]);

    expect(output).toContain('error:');
    expect(output).toContain('--paylod');
    expect(fs.existsSync(path.join(tmpDir, '.reactive'))).toBe(false);
  });

  it('rejects a payload given both positionally and with --payload', async () => {
    const output = await emitCommand(['args-skill', SIGNAL, payloadJson, '--payload', '@payload.json', '--job', nextJob()]);

    expect(output).toContain('error:');
    expect(output).toContain('VALIDATION_ERROR');
  });
});
