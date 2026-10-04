import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { FSMEngine, JudgmentEngine, hasSelfReportGrant, grantSelfReport } from '@reactive-skills/runtime';
import { approveCommand, generateApprovalCode, type ApproveIO } from '../../src/commands/approve.js';

// Spec 0019 criteria 5 to 8 and 14: only a person at an interactive terminal decides a waiting gate or grants self-report.

const skillYaml = `
schema_version: "2.0.0"
name: approval-skill
description: "Approve command fixture"
initial_state: REVIEW
states:
  REVIEW:
    description: "Review"
    transitions:
      SUBMIT:
        target: DONE
        judgment:
          type: predicate
          criterion: "Does the delivered output satisfy the approved assertion?"
          fallback_target: REPAIR
  DONE:
    description: "Done"
  REPAIR:
    description: "Repair"
`;

function terminal(lines: string[], isTTY = true): ApproveIO & { written: () => string } {
  const input = Object.assign(new PassThrough(), { isTTY });
  const output = Object.assign(new PassThrough(), { isTTY });
  let written = '';
  output.on('data', (chunk) => (written += chunk.toString()));
  input.end(lines.map((line) => `${line}\n`).join(''));
  return { input, output, written: () => written };
}

describe('approveCommand (#22 part 2)', () => {
  let originalCwd: string;
  let originalKey: string | undefined;
  let tmpDir: string;
  let skillDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    originalKey = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    JudgmentEngine.reset();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-axi-approve-'));
    skillDir = path.join(tmpDir, 'skills', 'approval-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), skillYaml);
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    JudgmentEngine.reset();
    if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = originalKey;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Windows may still hold engine files open.
    }
  });

  const withEngine = async <T>(fn: (engine: FSMEngine) => Promise<T> | T): Promise<T> => {
    const engine = new FSMEngine({ skillDir, workspaceDir: tmpDir, jobId: 'review-run', eventContext: { run_id: 'review-run' } });
    try {
      return await fn(engine);
    } finally {
      engine.close();
    }
  };

  const refuseSubmit = () =>
    withEngine(async (engine) => {
      const result = await engine.handleSignal('SUBMIT', { summary: 'done' });
      expect(result.transitioned).toBe(false);
      expect(result.refusalReason).toContain('reactive-skills-axi approve approval-skill --job review-run');
      return engine.getPendingApprovals();
    });

  it('refuses and changes nothing without an interactive terminal (criterion 5)', async () => {
    await refuseSubmit();
    const io = terminal(['ABCD'], false);

    const output = await approveCommand(['approval-skill', '--job', 'review-run'], io, { generateCode: () => 'ABCD' });

    expect(output).toContain('approve needs an interactive terminal');
    await withEngine((engine) => {
      expect(engine.getCurrentState()).toBe('REVIEW');
      expect(engine.getPendingApprovals()).toHaveLength(1);
      expect(engine.getEventStore().query({ type: 'APPROVAL_DECIDED' })).toHaveLength(0);
    });
  });

  it('approves the pending gate when the typed code matches, ignoring case (criteria 6 to 8)', async () => {
    await refuseSubmit();
    const io = terminal(['abcd']);

    const output = await approveCommand(['approval-skill', '--job', 'review-run'], io, { generateCode: () => 'ABCD' });

    expect(io.written()).toContain('Pending gate: REVIEW / SUBMIT -> DONE');
    expect(io.written()).toContain('Agent evidence: {"summary":"done"}');
    expect(output).toContain('current_state: DONE');
    await withEngine((engine) => {
      expect(engine.getCurrentState()).toBe('DONE');
      const decided = engine.getEventStore().query({ type: 'APPROVAL_DECIDED' });
      expect(decided).toHaveLength(1);
      expect(decided[0].payload).toMatchObject({ decision: 'approve', channel: 'interactive_terminal' });
    });
  });

  it('rejects the pending gate when the typed code does not match (criterion 7)', async () => {
    await refuseSubmit();
    const io = terminal(['WXYZ']);

    const output = await approveCommand(['approval-skill', '--job', 'review-run'], io, { generateCode: () => 'ABCD' });

    expect(output).toContain('current_state: REPAIR');
    await withEngine((engine) => {
      expect(engine.getCurrentState()).toBe('REPAIR');
      expect(engine.getEventStore().query({ type: 'APPROVAL_DECIDED' })[0].payload.decision).toBe('reject');
    });
  });

  it('reports nothing to decide when no gate is waiting', async () => {
    const output = await approveCommand(['approval-skill', '--job', 'review-run'], terminal([]), { generateCode: () => 'ABCD' });

    expect(output).toContain('decided: "0"');
    expect(output).toContain('current_state: REVIEW');
  });

  it('grants self-reported decisions only when the typed code matches (criterion 14)', async () => {
    const wrong = await approveCommand(['approval-skill', '--allow-self-reported'], terminal(['NOPE']), { generateCode: () => 'ABCD' });
    expect(wrong).toContain('self_reported: unchanged');
    expect(hasSelfReportGrant(tmpDir)).toBe(false);

    const piped = await approveCommand(['approval-skill', '--allow-self-reported'], terminal(['ABCD'], false), { generateCode: () => 'ABCD' });
    expect(piped).toContain('approve needs an interactive terminal');
    expect(hasSelfReportGrant(tmpDir)).toBe(false);

    const right = await approveCommand(['approval-skill', '--allow-self-reported'], terminal(['ABCD']), { generateCode: () => 'ABCD' });
    expect(right).toContain('self_reported: enabled');
    expect(hasSelfReportGrant(tmpDir)).toBe(true);
  });

  it('revokes self-reported decisions without a code (criterion 14)', async () => {
    grantSelfReport(tmpDir, 'interactive_terminal');

    const output = await approveCommand(['approval-skill', '--revoke-self-reported'], terminal([], false));

    expect(output).toContain('self_reported: disabled');
    expect(hasSelfReportGrant(tmpDir)).toBe(false);
  });

  it('generates codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) expect(generateApprovalCode()).toMatch(/^[ACDEFGHJKMNPQRTUVWXY34679]{4}$/);
  });
});
