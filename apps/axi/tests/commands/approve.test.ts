import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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
      SUBMIT_ALT:
        target: DONE
        judgment:
          type: predicate
          criterion: "Is the alternative delivery acceptable?"
  DONE:
    description: "Done"
  REPAIR:
    description: "Repair"
`;

/** TOON quotes Windows paths and escapes their backslashes. */
const plain = (text: string) => text.replaceAll('\\\\', '\\').replaceAll('"', '');

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

  let originalHome: { HOME?: string; USERPROFILE?: string };

  beforeEach(() => {
    originalCwd = process.cwd();
    originalKey = process.env.TYPESAFE_API_KEY;
    delete process.env.TYPESAFE_API_KEY;
    JudgmentEngine.reset();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-axi-approve-'));
    originalHome = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
    process.env.HOME = process.env.USERPROFILE = path.join(tmpDir, 'home');
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
    for (const [name, value] of Object.entries(originalHome)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
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

    await expect(approveCommand(['approval-skill', '--job', 'review-run'], io, { generateCode: () => 'ABCD' }))
      .rejects.toThrow('approve needs an interactive terminal');
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

  it('asks again on a wrong code and approves once the code matches (criterion 7, DoD H6)', async () => {
    await refuseSubmit();
    const io = terminal(['WXYZ', 'abcd']);

    const output = await approveCommand(['approval-skill', '--job', 'review-run'], io, { generateCode: () => 'ABCD' });

    expect(io.written()).toContain('did not match');
    expect(output).toContain('current_state: DONE');
  });

  it('cancels without deciding when input ends after a wrong code (DoD H6)', async () => {
    await refuseSubmit();

    await expect(approveCommand(['approval-skill', '--job', 'review-run'], terminal(['WXYZ']), { generateCode: () => 'ABCD' }))
      .rejects.toThrow('Cancelled');
    await withEngine((engine) => {
      expect(engine.getEventStore().query({ type: 'APPROVAL_DECIDED' })).toHaveLength(0);
    });
  });

  it('applies nothing when the run moves while the prompt is open (review N1)', async () => {
    await refuseSubmit();
    const input = Object.assign(new PassThrough(), { isTTY: true });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    let written = '';
    output.on('data', (chunk) => (written += chunk.toString()));

    const pending = approveCommand(['approval-skill', '--job', 'review-run'], { input, output }, { generateCode: () => 'ABCD' });
    await vi.waitFor(() => expect(written).toContain('Type ABCD to approve'));
    grantSelfReport(tmpDir, 'interactive_terminal');
    await withEngine((engine) => engine.handleSignal('SUBMIT_ALT', { exit_code: 0 }));
    input.end('ABCD\n');

    await expect(pending).rejects.toThrow('The run changed while you were deciding');
    await withEngine((engine) => {
      expect(engine.getEventStore().query({ type: 'APPROVAL_DECIDED' })).toHaveLength(0);
      expect(engine.getCurrentState()).toBe('DONE');
    });
  });

  it('cancels after five wrong answers without deciding (DoD H6)', async () => {
    await refuseSubmit();
    const io = terminal(['A', 'B', 'C', 'D', 'E', 'ABCD']);

    await expect(approveCommand(['approval-skill', '--job', 'review-run'], io, { generateCode: () => 'ABCD' }))
      .rejects.toThrow('Cancelled');
    expect(io.written().match(/did not match/g)).toHaveLength(5);
    await withEngine((engine) => {
      expect(engine.getEventStore().query({ type: 'APPROVAL_DECIDED' })).toHaveLength(0);
    });
  });

  it('rejects the pending gate only when the user types reject (criterion 7, DoD H6)', async () => {
    await refuseSubmit();
    const io = terminal(['WXYZ', 'Reject']);

    const output = await approveCommand(['approval-skill', '--job', 'review-run'], io, { generateCode: () => 'ABCD' });

    expect(output).toContain('current_state: REPAIR');
    await withEngine((engine) => {
      expect(engine.getCurrentState()).toBe('REPAIR');
      expect(engine.getEventStore().query({ type: 'APPROVAL_DECIDED' })[0].payload.decision).toBe('reject');
    });
  });

  it('reports nothing to decide when no gate is waiting', async () => {
    await withEngine(() => undefined);

    const output = await approveCommand(['approval-skill', '--job', 'review-run'], terminal([]), { generateCode: () => 'ABCD' });

    expect(output).toContain('decided: "0"');
    expect(output).toContain('current_state: REVIEW');
    expect(plain(output)).toContain(`workspace: ${tmpDir}`);
  });

  it('fails without creating a run when the run is not in this workspace', async () => {
    await refuseSubmit();
    const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-axi-approve-elsewhere-'));
    process.chdir(elsewhere);
    try {
      await expect(approveCommand([skillDir, '--job', 'review-run'], terminal(['ABCD']), { generateCode: () => 'ABCD' }))
        .rejects.toThrow(`No run of approval-skill named 'review-run' in ${elsewhere}`);
      expect(fs.existsSync(path.join(elsewhere, '.reactive'))).toBe(false);
    } finally {
      process.chdir(tmpDir);
      fs.rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it('names the workspace before asking to enable self-reported decisions', async () => {
    const io = terminal(['ABCD']);

    const output = await approveCommand(['approval-skill', '--allow-self-reported'], io, { generateCode: () => 'ABCD' });

    expect(io.written()).toContain(`Workspace: ${tmpDir}`);
    expect(plain(output)).toContain(`workspace: ${tmpDir}`);
  });

  it('grants self-reported decisions only when the typed code matches (criterion 14)', async () => {
    const wrong = await approveCommand(['approval-skill', '--allow-self-reported'], terminal(['NOPE']), { generateCode: () => 'ABCD' });
    expect(wrong).toContain('self_reported: unchanged');
    expect(hasSelfReportGrant(tmpDir)).toBe(false);

    await expect(approveCommand(['approval-skill', '--allow-self-reported'], terminal(['ABCD'], false), { generateCode: () => 'ABCD' }))
      .rejects.toThrow('approve needs an interactive terminal');
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

  it('exits non-zero through the compiled CLI when piped, and changes nothing (criterion 5)', async () => {
    await refuseSubmit();
    const cli = fileURLToPath(new URL('../../dist/cli/index.js', import.meta.url));
    const env = { ...process.env };
    delete env.TYPESAFE_API_KEY;
    delete env.WORKSPACE_DIR;

    for (const args of [['--job', 'review-run'], ['--allow-self-reported']]) {
      const result = spawnSync(process.execPath, [cli, 'approve', 'approval-skill', ...args], {
        cwd: tmpDir, input: 'ABCD\n', encoding: 'utf8', timeout: 15_000, env,
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('approve needs an interactive terminal');
    }
    expect(hasSelfReportGrant(tmpDir)).toBe(false);
    await withEngine((engine) => {
      expect(engine.getEventStore().query({ type: 'APPROVAL_DECIDED' })).toHaveLength(0);
    });
  });

  it('stops prompting for gates the first decision moved past (review m3)', async () => {
    await refuseSubmit();
    await withEngine((engine) => engine.handleSignal('SUBMIT_ALT', { summary: 'alt' }));
    const io = terminal(['ABCD', 'ABCD']);

    const output = await approveCommand(['approval-skill', '--job', 'review-run'], io, { generateCode: () => 'ABCD' });

    expect(io.written().match(/Pending gate:/g)).toHaveLength(1);
    expect(output).toContain('decided: "1"');
    expect(output).toContain('current_state: DONE');
  });

  it('cancels without deciding when input ends at the prompt (review m4)', async () => {
    await refuseSubmit();

    await expect(approveCommand(['approval-skill', '--job', 'review-run'], terminal([]), { generateCode: () => 'ABCD' }))
      .rejects.toThrow('Cancelled');
    await expect(approveCommand(['approval-skill', '--allow-self-reported'], terminal([]), { generateCode: () => 'ABCD' }))
      .rejects.toThrow('Cancelled');

    expect(hasSelfReportGrant(tmpDir)).toBe(false);
    await withEngine((engine) => {
      expect(engine.getEventStore().query({ type: 'APPROVAL_DECIDED' })).toHaveLength(0);
    });
  });

  it('shows the start and end of long evidence with size and hash, and strips characters that could fake or hide text (review m6, N7)', async () => {
    const hidden = [0x202e, 0x9b, 0x200b, 0xfeff, 0x2028].map((code) => String.fromCharCode(code));
    const tag = String.fromCodePoint(0xe0041);
    await withEngine((engine) => engine.handleSignal('SUBMIT', { note: `looks fine${hidden.join('')}${tag}`, filler: 'x'.repeat(900), tail: 'IMPORTANT TAIL' }));
    const io = terminal(['ABCD']);

    await approveCommand(['approval-skill', '--job', 'review-run'], io, { generateCode: () => 'ABCD' });

    const written = io.written();
    expect(written).toMatch(/characters hidden; rerun with --full to see all\) \.\.\. .*IMPORTANT TAIL.* \[\d+ bytes, sha256 [0-9a-f]{16}\]/);
    for (const char of [...hidden, tag]) expect(written).not.toContain(char);
  });

  it('does not count blank lines as wrong answers (review N11)', async () => {
    await refuseSubmit();

    const output = await approveCommand(['approval-skill', '--job', 'review-run'], terminal(['', '', '', '', '', '', 'ABCD']), { generateCode: () => 'ABCD' });

    expect(output).toContain('current_state: DONE');
  });

  it('flags a cancel at a later gate after an earlier decision was applied (review N12)', async () => {
    await withEngine((engine) => engine.handleSignal('SUBMIT_ALT', { summary: 'alt' }));
    await refuseSubmit();

    const output = await approveCommand(['approval-skill', '--job', 'review-run'], terminal(['reject']), { generateCode: () => 'ABCD' });

    expect(output).toContain('REVIEW / SUBMIT_ALT: reject, refused');
    expect(output).toContain('cancelled: "true"');
  });

  it('prints the whole evidence with --full', async () => {
    await withEngine((engine) => engine.handleSignal('SUBMIT', { filler: 'x'.repeat(900), middle: 'MIDDLE MARKER', more: 'y'.repeat(900) }));
    const io = terminal(['ABCD']);

    await approveCommand(['approval-skill', '--job', 'review-run', '--full'], io, { generateCode: () => 'ABCD' });

    expect(io.written()).toContain('MIDDLE MARKER');
    expect(io.written()).not.toContain('characters hidden');
  });

  it('lists each decision with its outcome and reports where the grant is stored (review N5, N6)', async () => {
    await refuseSubmit();

    const decided = await approveCommand(['approval-skill', '--job', 'review-run'], terminal(['reject']), { generateCode: () => 'ABCD' });
    const granted = await approveCommand(['approval-skill', '--allow-self-reported'], terminal(['ABCD']), { generateCode: () => 'ABCD' });

    expect(decided).toContain('REVIEW / SUBMIT: reject, moved to REPAIR');
    expect(decided).not.toContain('[object Object]');
    expect(plain(granted)).toContain(`grant: ${path.join(tmpDir, 'home', '.reactive-skills', 'grants')}`);
  });

  it('generates codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) expect(generateApprovalCode()).toMatch(/^[ACDEFGHJKMNPQRTUVWXY34679]{4}$/);
  });
});
