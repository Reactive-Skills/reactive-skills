import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertNoNewTestOutput, snapshotTestOutput } from '../../../scripts/test-output-guard.mjs';

// #28: the Vitest teardown guard must catch leaked projection and ledger output, without
// failing a run because an agent advanced a skill in the same checkout meanwhile.
describe('test output guard', () => {
  let base: string;

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'rsa-output-guard-'));
    fs.mkdirSync(path.join(base, '.docs', 'jobs'), { recursive: true });
    fs.mkdirSync(path.join(base, '.reactive', 'skills', 'jsm-workflow', 'runs'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('passes when nothing new appears', () => {
    const before = snapshotTestOutput([base]);
    expect(() => assertNoNewTestOutput(before, [base])).not.toThrow();
  });

  it('fails on a leaked projection folder and names it', () => {
    const before = snapshotTestOutput([base]);
    fs.mkdirSync(path.join(base, '.docs', 'jobs', '01a1064c-leak'));
    expect(() => assertNoNewTestOutput(before, [base])).toThrow(/jobs[\\/]01a1064c-leak/);
  });

  it('fails on a leaked run folder at the top of .reactive', () => {
    const before = snapshotTestOutput([base]);
    fs.mkdirSync(path.join(base, '.reactive', '01a1064e-leak', 'artifacts'), { recursive: true });
    expect(() => assertNoNewTestOutput(before, [base])).toThrow(/Tests wrote 2 directories/);
  });

  it('ignores a new run inside an existing skill store, which a concurrent agent may create', () => {
    const before = snapshotTestOutput([base]);
    fs.mkdirSync(path.join(base, '.reactive', 'skills', 'jsm-workflow', 'runs', '01a10645-run', 'logs'), { recursive: true });
    fs.mkdirSync(path.join(base, '.reactive', 'skills', 'jsm-workflow', 'jobs', 'r2-gate-integrity'), { recursive: true });
    expect(() => assertNoNewTestOutput(before, [base])).not.toThrow();
  });

  it('still catches a new skill store, three levels down', () => {
    const before = snapshotTestOutput([base]);
    fs.mkdirSync(path.join(base, '.reactive', 'skills', 'test-fsm'), { recursive: true });
    expect(() => assertNoNewTestOutput(before, [base])).toThrow(/skills[\\/]test-fsm/);
  });
});
