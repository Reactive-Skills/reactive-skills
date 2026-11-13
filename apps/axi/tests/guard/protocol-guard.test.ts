import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { guardOffGrantPath } from '@reactive-skills/runtime';
import { claudeStop, claudeWrite, codexPatch, createFixture, cursorWrite, cleanEnv, GUARD, type Fixture } from './harness.js';

const ok = (result: { status: number | null; stderr: string; stdout: string }) => {
  expect(result.status, result.stderr + result.stdout).toBe(0);
  return result;
};

function guardLog(fx: Fixture): Array<Record<string, string>> {
  const file = path.join(fx.home, '.reactive-skills', 'guard', 'guard-log.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
}

describe('protocol guard: an active job blocks writes until the session resumes, parks or abandons it', () => {
  let fx: Fixture;
  beforeEach(() => {
    fx = createFixture();
    // A run left behind by an earlier session, at its first state.
    ok(fx.axi(['invoke', 'fixture'], { session: 'EARLIER' }));
  });
  afterEach(() => fx.cleanup());

  it('denies a write-tool edit with the exact resume, park and abandon commands', () => {
    const denied = fx.guard('pretool', claudeWrite(fx, 'S1'));
    expect(denied.status).toBe(2);
    expect(denied.stdout).toBe('');
    expect(denied.stderr).toContain(`fixture run ${fx.runId()} at INTAKE`);
    expect(denied.stderr).toContain(`reactive-skills-axi state fixture --job ${fx.runId()}`);
    expect(denied.stderr).toContain(`reactive-skills-axi park fixture --job ${fx.runId()} --session S1 --reason`);
    expect(denied.stderr).toContain(`reactive-skills-axi abandon fixture --job ${fx.runId()} --reason`);
    expect(guardLog(fx).some(entry => entry.event === 'deny-write' && entry.session === 'S1')).toBe(true);
  });

  it('allows the write once this session receives the current state from the runtime', () => {
    expect(fx.guard('pretool', claudeWrite(fx, 'S1')).status).toBe(2);
    ok(fx.axi(['state', 'fixture'], { session: 'S1' }));
    ok(fx.guard('pretool', claudeWrite(fx, 'S1')));
    ok(fx.guard('pretool', claudeWrite(fx, 'S1', 'src/app.ts', 'Edit')));
    // Another session in the same workspace has not acknowledged anything.
    expect(fx.guard('pretool', claudeWrite(fx, 'S2')).status).toBe(2);
  });

  it('does not accept command text that only names the runtime', () => {
    const spoof = spawnSync('bash', ['-c', 'echo reactive-skills-axi state fixture'], {
      cwd: fx.workspace, encoding: 'utf8', env: cleanEnv(fx.home, { CLAUDE_CODE_SESSION_ID: 'S1' }),
    });
    expect(spoof.status).toBe(0);
    expect(fx.guard('pretool', claudeWrite(fx, 'S1')).status).toBe(2);
  });

  it('denies again when the run moves to another state behind the session', () => {
    ok(fx.axi(['state', 'fixture'], { session: 'S1' }));
    ok(fx.guard('pretool', claudeWrite(fx, 'S1')));
    ok(fx.axi(['emit', 'fixture', 'BRIEFED'], { session: 'S2' }));
    const stale = fx.guard('pretool', claudeWrite(fx, 'S1'));
    expect(stale.status).toBe(2);
    expect(stale.stderr).toContain('at BUILD');
  });

  it('park clears the obligation for that session only and records the reason in the run ledger', () => {
    const parked = fx.axi(['park', 'fixture', '--session', 'S3', '--reason', 'unrelated docs fix']);
    ok(parked);
    expect(parked.stdout).toContain('status: parked');
    ok(fx.guard('pretool', claudeWrite(fx, 'S3')));
    expect(fx.guard('pretool', claudeWrite(fx, 'S4')).status).toBe(2);
    expect(fx.ledgerTypes()).toContain('JOB_PARKED');
    expect(fx.jobJson().status).toBe('active');
  });

  it('park requires a reason and a session', () => {
    expect(fx.axi(['park', 'fixture', '--session', 'S3']).stdout + fx.axi(['park', 'fixture', '--session', 'S3']).stderr).toContain('--reason');
    const noSession = fx.axi(['park', 'fixture', '--reason', 'x']);
    expect(noSession.stdout + noSession.stderr).toContain('--session');
  });

  it('abandon ends the run with a recorded reason, which clears the obligation for every session', () => {
    const runId = fx.runId();
    const abandoned = fx.axi(['abandon', 'fixture', '--reason', 'superseded by a new brief'], { session: 'S5' });
    ok(abandoned);
    expect(abandoned.stdout).toContain('status: abandoned');
    expect(fx.jobJson().status).not.toBe('active');
    expect(fx.runId()).toBe(runId);
    expect(fx.ledgerTypes()).toContain('JOB_ABANDONED');
    ok(fx.guard('pretool', claudeWrite(fx, 'S5')));
    ok(fx.guard('pretool', claudeWrite(fx, 'S6')));
  });

  it('blocks the first turn end, then allows the continuation and records it as ungoverned', () => {
    const first = fx.guard('stop', claudeStop(fx, 'S1'));
    expect(first.status).toBe(2);
    expect(first.stderr).toContain('fixture run');
    const second = ok(fx.guard('stop', claudeStop(fx, 'S1', true)));
    expect(JSON.parse(second.stdout).systemMessage).toContain('ungoverned');
    expect(guardLog(fx).some(entry => entry.event === 'ungoverned-turn')).toBe(true);
    ok(fx.axi(['state', 'fixture'], { session: 'S1' }));
    ok(fx.guard('stop', claudeStop(fx, 'S1')));
  });

  it('denies write-tool edits to hook configuration and guard state while engaged, even after acknowledging', () => {
    ok(fx.axi(['state', 'fixture'], { session: 'S1' }));
    for (const target of [
      path.join(fx.workspace, '.claude', 'settings.json'),
      path.join(fx.workspace, '.claude', 'settings.local.json'),
      path.join(fx.home, '.claude', 'settings.json'),
      path.join(fx.home, '.codex', 'hooks.json'),
      path.join(fx.workspace, '.codex', 'hooks.json'),
      path.join(fx.home, '.cursor', 'hooks.json'),
      path.join(fx.workspace, '.reactive', 'skills', 'fixture', 'active_job'),
      path.join(fx.workspace, '.reactive-governance', 'attestations', 'x', 'manifest.json'),
      path.join(fx.home, '.reactive-skills', 'guard', 'sessions', 'S1.json'),
    ]) {
      const denied = fx.guard('pretool', claudeWrite(fx, 'S1', target));
      expect(denied.status, target).toBe(2);
      expect(denied.stderr).toContain('protected');
    }
  });

  it('applies the same rules to Codex apply_patch payloads, including protected targets', () => {
    expect(fx.guard('pretool', codexPatch(fx, 'C1'), 'codex').status).toBe(2);
    ok(fx.axi(['state', 'fixture'], { codexThread: 'C1' }));
    ok(fx.guard('pretool', codexPatch(fx, 'C1'), 'codex'));
    expect(fx.guard('pretool', codexPatch(fx, 'C1', '.codex/hooks.json'), 'codex').status).toBe(2);
    expect(fx.guard('stop', { ...claudeStop(fx, 'C2') }, 'codex').status).toBe(2);
  });

  it('answers Cursor with its own deny object and stands the Claude-shaped entry down for Cursor payloads', () => {
    const denied = fx.guard('pretool', cursorWrite(fx, 'K1'), 'cursor');
    expect(denied.status).toBe(0);
    expect(JSON.parse(denied.stdout)).toMatchObject({ permission: 'deny' });
    const duplicate = fx.guard('pretool', cursorWrite(fx, 'K1'), 'claude');
    expect(duplicate.status).toBe(0);
    expect(duplicate.stdout).toBe('');
    // Cursor's stop cannot block: it gets one follow-up, then nothing.
    const followUp = ok(fx.guard('stop', { conversation_id: 'K1', workspace_roots: [fx.workspace], loop_count: 0, status: 'completed' }, 'cursor'));
    expect(JSON.parse(followUp.stdout).followup_message).toContain('fixture run');
    const after = ok(fx.guard('stop', { conversation_id: 'K1', workspace_roots: [fx.workspace], loop_count: 1, status: 'completed' }, 'cursor'));
    expect(after.stdout).toBe('');
  });

  it('turns the guard off for a session only from the human prompt, with a reason', () => {
    ok(fx.guard('prompt', { session_id: 'S7', cwd: fx.workspace, hook_event_name: 'UserPromptSubmit', prompt: '/reactive-guard off' }));
    expect(fx.guard('pretool', claudeWrite(fx, 'S7')).status).toBe(2);
    ok(fx.guard('prompt', { session_id: 'S7', cwd: fx.workspace, hook_event_name: 'UserPromptSubmit', prompt: '/reactive-guard off pairing on a hotfix' }));
    ok(fx.guard('pretool', claudeWrite(fx, 'S7')));
    expect(fx.guard('pretool', claudeWrite(fx, 'S8')).status).toBe(2);
    expect(guardLog(fx).some(entry => entry.event === 'guard-off' && entry.session === 'S7')).toBe(true);
    ok(fx.guard('prompt', { session_id: 'S7', cwd: fx.workspace, hook_event_name: 'UserPromptSubmit', prompt: '/reactive-guard on' }));
    expect(fx.guard('pretool', claudeWrite(fx, 'S7')).status).toBe(2);
  });

  it('honours a workspace grant at the path the runtime writes, and refuses to grant without a terminal', () => {
    const refused = fx.axi(['guard', 'off', '--reason', 'demo day']);
    expect(refused.status).not.toBe(0);
    expect(refused.stdout + refused.stderr).toContain('terminal');
    const grant = guardOffGrantPath(fx.workspace, fx.home);
    expect(grant.startsWith(path.join(fx.home, '.reactive-skills', 'grants'))).toBe(true);
    fs.mkdirSync(path.dirname(grant), { recursive: true });
    fs.writeFileSync(grant, JSON.stringify({ workspace: fx.workspace, grantedAt: new Date().toISOString(), channel: 'tty', reason: 'demo day' }));
    ok(fx.guard('pretool', claudeWrite(fx, 'S9')));
    ok(fx.guard('stop', claudeStop(fx, 'S9')));
  });

  it('lists active jobs at session start', () => {
    const started = ok(fx.guard('session-start', { session_id: 'S1', cwd: fx.workspace, hook_event_name: 'SessionStart', source: 'startup' }));
    expect(started.stdout).toContain(`fixture run ${fx.runId()} at INTAKE`);
  });

  it('emit refuses a stale view sequence', () => {
    const view = fx.axi(['state', 'fixture', '--output', 'compact-v1'], { session: 'S1' });
    const seq = JSON.parse(view.stdout).seq;
    expect(Number.isInteger(seq)).toBe(true);
    ok(fx.axi(['emit', 'fixture', 'BRIEFED'], { session: 'S2' }));
    const stale = fx.axi(['emit', 'fixture', 'BUILT', '--view-seq', String(seq)], { session: 'S1' });
    expect(stale.stdout + stale.stderr).toContain('STALE_VIEW');
    expect(fx.jobJson().currentState).toBe('BUILD');
  });
});

describe('protocol guard: skills loaded in a session and quiet workspaces', () => {
  let fx: Fixture;
  beforeEach(() => { fx = createFixture(); });
  afterEach(() => fx.cleanup());

  it('allows everything when the workspace has no reactive state and no skill was loaded', () => {
    ok(fx.guard('pretool', claudeWrite(fx, 'S1')));
    ok(fx.guard('stop', claudeStop(fx, 'S1')));
    ok(fx.guard('pretool', { session_id: 'S1', cwd: fx.workspace, tool_name: 'Read', tool_input: { file_path: 'x' } }));
  });

  it('a skill loaded through the Skill tool must be run, and cannot be parked', () => {
    const userSkill = path.join(fx.home, '.agents', 'skills', 'fixture');
    fs.mkdirSync(userSkill, { recursive: true });
    fs.writeFileSync(path.join(userSkill, 'SKILL.md'), '# fixture\n<!-- REACTIVE BOOTLOADER -->\nRun the runtime.\n');
    ok(fx.guard('pretool', { session_id: 'S1', cwd: fx.workspace, tool_name: 'Skill', tool_input: { skill: 'fixture' } }));
    const denied = fx.guard('pretool', claudeWrite(fx, 'S1'));
    expect(denied.status).toBe(2);
    expect(denied.stderr).toContain('skill fixture');
    ok(fx.axi(['invoke', 'fixture'], { session: 'S1' }));
    const parked = fx.axi(['park', 'fixture', '--session', 'S1', '--reason', 'not now']);
    expect(parked.stdout + parked.stderr).toContain('loaded in this session');
    ok(fx.guard('pretool', claudeWrite(fx, 'S1')));
  });

  it('ignores a skill without the reactive bootloader marker', () => {
    const plainSkill = path.join(fx.home, '.agents', 'skills', 'plain');
    fs.mkdirSync(plainSkill, { recursive: true });
    fs.writeFileSync(path.join(plainSkill, 'SKILL.md'), '# plain\nNo runtime.\n');
    ok(fx.guard('pretool', { session_id: 'S1', cwd: fx.workspace, tool_name: 'Skill', tool_input: { skill: 'plain' } }));
    ok(fx.guard('pretool', claudeWrite(fx, 'S1')));
  });

  it('fails open on an unreadable payload', () => {
    const broken = spawnSync('bash', [GUARD, 'pretool', '--host', 'claude'], { cwd: fx.workspace, encoding: 'utf8', input: 'not json', env: cleanEnv(fx.home) });
    expect(broken.status).toBe(0);
  });

  it('stays inside the per-call budget', () => {
    ok(fx.axi(['invoke', 'fixture'], { session: 'S1' }));
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const started = performance.now();
      fx.guard('pretool', claudeWrite(fx, 'S1'));
      samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95) - 1];
    // P1 budget (<25ms) is asserted in CI; shared local disks get a wider bound (see PERFORMANCE-STANDARDS.md).
    expect(p95).toBeLessThan(process.env.CI ? 25 : 80);
  });
});
