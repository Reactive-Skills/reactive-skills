// Drives one trial: spawns the agent under test headless, feeds the scripted conversation over stream-json,
// applies the pressure condition, and writes the raw stream (outside the repository) for trace derivation.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fillerMessage } from './filler.ts';
import { COMPACT_COMMAND, NUDGE_MESSAGE, skillLoadMessage, taskMessage } from './prompts.ts';
import type { Cell, Pressure } from './types.ts';
import { prepareWorkspace } from './workspace.ts';

export interface PilotConfig {
  model: string;
  effort: string;
  claude_code_version: string;
  tools: string[];
  seed: number;
  reps: number;
  max_budget_usd_per_run: number;
  max_wall_ms_per_run: number;
  filler_chunk_bytes: number;
  pressure: Record<Pressure, { before_tokens: number; during_tokens: number; compact: boolean }>;
  cells: Cell[];
}

export interface RawRun {
  dir: string;
  workspace: string;
  stream: string;
  sent: string;
}

/** Variables that would tie the child to this host session or its account, or override the pinned settings. */
const STRIPPED_ENV = [
  'CLAUDE_CODE_USER_EMAIL',
  'CLAUDE_CODE_ACCOUNT_UUID',
  'CLAUDE_CODE_ORGANIZATION_UUID',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_REMOTE_SESSION_ID',
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDECODE',
  'CLAUDE_EFFORT',
  'CLAUDE_AUTOCOMPACT_PCT_OVERRIDE',
  'CLAUDE_CODE_SYNC_SKILLS',
  'CLAUDE_CODE_SYNC_PLUGINS',
  'CLAUDE_ADDITIONAL_DIRECTORIES',
  'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD',
];

export function agentEnv(config: PilotConfig, pathPrefix: string | null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of STRIPPED_ENV) delete env[key];
  env.ANTHROPIC_SMALL_FAST_MODEL = config.model;
  env.ANTHROPIC_DEFAULT_HAIKU_MODEL = config.model;
  env.NODE_NO_WARNINGS = '1';
  // Commits the agent makes in its throwaway workspace use a fixture identity, never the operator's.
  Object.assign(env, { GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' });
  if (pathPrefix) env.PATH = `${pathPrefix}${path.delimiter}${env.PATH}`;
  return env;
}

export function agentArgs(config: PilotConfig, settingsFile: string): string[] {
  return [
    '-p',
    '--model', config.model,
    '--effort', config.effort,
    '--setting-sources', '',
    '--settings', settingsFile,
    '--strict-mcp-config',
    '--tools', ...config.tools,
    '--permission-mode', 'bypassPermissions',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
    '--session-id', randomUUID(),
    '--max-budget-usd', String(config.max_budget_usd_per_run),
  ];
}

const TEST_COMMAND = /\bnpm (run )?test\b|check\.mjs test|node --test/;

/** # Performance & Risk Budget
 * - Tier: P3 (one model-driven trial; bounded by max_wall_ms_per_run)
 * - Complexity: O(e) stream events
 * - Cyclomatic Complexity (CC): 18 (threshold <= 20) */
export async function runTrial(config: PilotConfig, cell: Cell, rep: number, rawRoot: string): Promise<RawRun> {
  const dir = path.join(rawRoot, cell.id, `rep${rep}`);
  const workspace = path.join(dir, 'ws');
  const { pathPrefix } = prepareWorkspace(workspace, cell.task, cell.arm);
  const settingsFile = path.join(dir, 'settings.json');
  fs.writeFileSync(settingsFile, '{}\n');
  const streamFile = path.join(dir, 'stream.jsonl');
  const sentFile = path.join(dir, 'sent.jsonl');
  const stream = fs.createWriteStream(streamFile);
  const sentLog = fs.createWriteStream(sentFile);
  const pressure = config.pressure[cell.pressure];
  const seed = config.seed + rep;

  const child = spawn('claude', agentArgs(config, settingsFile), {
    cwd: workspace,
    env: agentEnv(config, pathPrefix),
    stdio: ['pipe', 'pipe', 'ignore'],
  });

  type Phase = 'skill_load' | 'filler' | 'compact' | 'task' | 'nudge' | 'done';
  let phase: Phase = 'skill_load';
  let contextTokens = 0;
  let fillerIndex = 0;
  let bytesPerToken = 3.2;
  let duringSent = false;
  let lastFillerStart = { tokens: 0, bytes: 0 };

  const send = (role: string, text: string) => {
    sentLog.write(JSON.stringify({ t: Date.now(), role, bytes: Buffer.byteLength(text) }) + '\n');
    child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: text } }) + '\n');
  };
  const sendFiller = (role: 'filler' | 'filler_during', tokens: number) => {
    const bytes = Math.max(2000, Math.min(config.filler_chunk_bytes, Math.round(tokens * bytesPerToken)));
    const message = fillerMessage(seed, fillerIndex++, bytes, role === 'filler_during');
    lastFillerStart = { tokens: contextTokens, bytes: message.bytes };
    send(role, message.text);
  };
  const advance = () => {
    if (phase === 'skill_load' || phase === 'filler') {
      if (phase === 'filler' && lastFillerStart.bytes > 0 && contextTokens > lastFillerStart.tokens) {
        bytesPerToken = lastFillerStart.bytes / (contextTokens - lastFillerStart.tokens);
      }
      const remaining = pressure.before_tokens - contextTokens;
      if (remaining > 2000) {
        phase = 'filler';
        sendFiller('filler', remaining);
        return;
      }
      if (pressure.compact) {
        phase = 'compact';
        send('compact', COMPACT_COMMAND);
        return;
      }
    }
    if (phase === 'skill_load' || phase === 'filler' || phase === 'compact') {
      phase = 'task';
      send('task', taskMessage(cell.task, cell.arm));
      return;
    }
    if (phase === 'task') {
      phase = 'nudge';
      send('nudge', NUDGE_MESSAGE);
      return;
    }
    phase = 'done';
    child.stdin.end();
  };

  let buffer = '';
  let failure: string | undefined;
  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      stream.write(JSON.stringify({ t: Date.now(), line }) + '\n');
      let event: any;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'assistant' && event.message?.usage) {
        const u = event.message.usage;
        contextTokens = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
        const usesTests = (event.message.content ?? []).some(
          (block: any) => block.type === 'tool_use' && block.name === 'Bash' && TEST_COMMAND.test(String(block.input?.command ?? ''))
        );
        if (phase === 'task' && usesTests && !duringSent && pressure.during_tokens > 0) {
          duringSent = true;
          sendFiller('filler_during', pressure.during_tokens);
        }
      }
      if (event.type === 'result') {
        if (event.subtype && event.subtype !== 'success') failure = event.subtype;
        if (failure) {
          phase = 'done';
          child.stdin.end();
        } else {
          advance();
        }
      }
    }
  });

  const skillLoad = skillLoadMessage(cell.task, cell.arm);
  if (skillLoad) {
    send('skill_load', skillLoad);
  } else {
    phase = 'filler';
    advance();
  }

  const exit = await new Promise<string | undefined>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve('timeout');
    }, config.max_wall_ms_per_run);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? undefined : `exit ${code}`);
    });
  });
  await new Promise((resolve) => stream.end(resolve));
  await new Promise((resolve) => sentLog.end(resolve));
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ failure: failure ?? exit ?? null, phase }));
  return { dir, workspace, stream: streamFile, sent: sentFile };
}
