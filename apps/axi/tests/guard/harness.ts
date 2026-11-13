import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';

export const CLI = fileURLToPath(new URL('../../dist/cli/index.js', import.meta.url));
export const GUARD = fileURLToPath(new URL('../../hooks/reactive-skills-guard.sh', import.meta.url));

/** Host session variables a real harness exports; tests set them explicitly and never inherit them. */
const HOST_ENV = ['CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID', 'REACTIVE_JOB_ID', 'WORKSPACE_DIR'];

export function cleanEnv(home: string, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, NODE_NO_WARNINGS: '1' };
  for (const key of HOST_ENV) delete env[key];
  return { ...env, ...extra };
}

export interface Fixture {
  root: string;
  workspace: string;
  home: string;
  /** Run the AXI CLI in the workspace; `session` simulates the harness exporting its session id. */
  axi: (args: string[], options?: { session?: string; codexThread?: string; input?: string }) => SpawnSyncReturns<string>;
  /** Feed one hook payload to the guard script. */
  guard: (event: string, payload: Record<string, unknown>, host?: 'claude' | 'codex' | 'cursor') => SpawnSyncReturns<string>;
  runId: () => string;
  jobJson: () => Record<string, any>;
  ledgerTypes: () => string[];
  cleanup: () => void;
}

const SKILL_YAML = `schema_version: "2.1.0"
name: fixture
description: Guard fixture
initial_state: INTAKE
states:
  INTAKE:
    prompt_template: states/intake.md
    transitions:
      BRIEFED:
        target: BUILD
  BUILD:
    prompt_template: states/build.md
    transitions:
      BUILT:
        target: DONE
  DONE:
    prompt_template: states/done.md
`;

export function writeFixtureSkill(dir: string, name = 'fixture'): void {
  fs.mkdirSync(path.join(dir, 'states'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skill.yaml'), SKILL_YAML.replace('name: fixture', `name: ${name}`));
  fs.writeFileSync(path.join(dir, 'states/intake.md'), 'Record the brief.');
  fs.writeFileSync(path.join(dir, 'states/build.md'), 'Build it.');
  fs.writeFileSync(path.join(dir, 'states/done.md'), 'Delivered.');
}

export function createFixture(prefix = 'reactive-guard-'): Fixture {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  const workspace = path.join(root, 'ws');
  const home = path.join(root, 'home');
  fs.mkdirSync(home, { recursive: true });
  writeFixtureSkill(path.join(workspace, 'skills', 'fixture'));

  const axi: Fixture['axi'] = (args, options = {}) => spawnSync(process.execPath, [CLI, ...args], {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 30_000,
    input: options.input,
    env: cleanEnv(home, {
      ...(options.session ? { CLAUDE_CODE_SESSION_ID: options.session } : {}),
      ...(options.codexThread ? { CODEX_THREAD_ID: options.codexThread } : {}),
    }),
  });
  const guard: Fixture['guard'] = (event, payload, host = 'claude') => spawnSync('bash', [GUARD, event, '--host', host], {
    cwd: workspace,
    encoding: 'utf8',
    timeout: 15_000,
    input: JSON.stringify(payload),
    env: cleanEnv(home),
  });
  const skillDir = () => path.join(workspace, '.reactive', 'skills', 'fixture');
  const runId = () => fs.readFileSync(path.join(skillDir(), 'active_job'), 'utf8').trim();
  const jobJson = () => JSON.parse(fs.readFileSync(path.join(skillDir(), 'runs', runId(), 'job.json'), 'utf8'));
  const ledgerTypes = () => fs.readFileSync(path.join(skillDir(), 'events.jsonl'), 'utf8')
    .split('\n').filter(Boolean).map(line => JSON.parse(line).type as string);
  const cleanup = () => {
    const relative = path.relative(fs.realpathSync(os.tmpdir()), root);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Refusing cleanup outside the temporary directory');
    fs.rmSync(root, { recursive: true, force: true });
  };
  return { root, workspace, home, axi, guard, runId, jobJson, ledgerTypes, cleanup };
}

export function claudeWrite(fx: Fixture, session: string, file = 'site/index.html', tool = 'Write'): Record<string, unknown> {
  return {
    session_id: session,
    cwd: fx.workspace,
    hook_event_name: 'PreToolUse',
    tool_name: tool,
    tool_input: { file_path: path.isAbsolute(file) ? file : path.join(fx.workspace, file), content: 'x' },
  };
}

export function claudeStop(fx: Fixture, session: string, active = false): Record<string, unknown> {
  return { session_id: session, cwd: fx.workspace, hook_event_name: 'Stop', stop_hook_active: active };
}

export function codexPatch(fx: Fixture, session: string, file = 'site/index.html'): Record<string, unknown> {
  const target = path.isAbsolute(file) ? file : path.join(fx.workspace, file);
  return {
    session_id: session,
    cwd: fx.workspace,
    hook_event_name: 'PreToolUse',
    tool_name: 'apply_patch',
    tool_input: { command: `*** Begin Patch\n*** Update File: ${target}\n@@\n-a\n+b\n*** End Patch` },
  };
}

export function cursorWrite(fx: Fixture, conversation: string, file = 'site/index.html'): Record<string, unknown> {
  return {
    conversation_id: conversation,
    generation_id: 'g1',
    hook_event_name: 'preToolUse',
    cursor_version: '2.0.0',
    workspace_roots: [fx.workspace],
    tool_name: 'Write',
    tool_input: { file_path: path.join(fx.workspace, file) },
  };
}
