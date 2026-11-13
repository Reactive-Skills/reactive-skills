import fs from 'node:fs';
import path from 'node:path';

/**
 * Delivery receipts: the runtime's own record that it handed a state view to an agent session.
 * A host guard reads them to decide whether a session acknowledged a run's current state, so
 * the acknowledgement comes from the runtime and never from the text of a command.
 *
 * One file per host session under `runs/<run>/delivery/`. Hosts that export a session id to tool
 * subprocesses (Claude Code `CLAUDE_CODE_SESSION_ID`, Codex `CODEX_THREAD_ID`) get an exact
 * binding; otherwise the receipt is written as `_anon.json` and a guard can only trust it within
 * a short freshness window, so two sessions in one workspace can satisfy each other's
 * acknowledgement there.
 */
export const DELIVERY_RECEIPT_DIR = 'delivery';
export const ANONYMOUS_RECEIPT = '_anon';
const HOST_SESSION_ENV = ['CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID'] as const;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export interface DeliveryReceipt {
  skill: string;
  run: string;
  state: string;
  view_seq: number;
  ledger_seq: number;
  transport: 'axi' | 'mcp';
  at: string;
  host_session: string | null;
}

/**
 * Session ids the host exported to this process, in a fixed order; unsafe values are dropped.
 * # Performance & Risk Budget
 * - Tier: P0 (<1ms)
 * - Complexity: O(1), two environment reads
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=4
 */
export function hostSessionIds(env: NodeJS.ProcessEnv = process.env): string[] {
  const ids: string[] = [];
  for (const key of HOST_SESSION_ENV) {
    const value = env[key]?.trim();
    if (value && SAFE_ID.test(value) && !ids.includes(value)) ids.push(value);
  }
  return ids;
}

/**
 * Atomically write one receipt per host session (or one anonymous receipt) under the run directory.
 * Never throws: a receipt is advisory input to a host guard and must not break a delivery.
 * # Performance & Risk Budget
 * - Tier: P0 (<5ms; one small atomic write per session id)
 * - Complexity: O(s), host session ids (at most 2)
 * - Cyclomatic Complexity (CC): target <=4
 * - Branch Coverage: target >=80%
 * - CRAP Score: target <=6
 */
export function writeDeliveryReceipt(runDir: string, receipt: Omit<DeliveryReceipt, 'host_session' | 'at'>, env: NodeJS.ProcessEnv = process.env): void {
  try {
    const dir = path.join(runDir, DELIVERY_RECEIPT_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const at = new Date().toISOString();
    const sessions = hostSessionIds(env);
    for (const session of sessions.length > 0 ? sessions : [null]) {
      const file = path.join(dir, `${session ?? ANONYMOUS_RECEIPT}.json`);
      const temp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temp, JSON.stringify({ ...receipt, at, host_session: session } satisfies DeliveryReceipt), 'utf8');
      fs.renameSync(temp, file);
    }
  } catch {
    // Advisory only.
  }
}

/**
 * Read the receipt a session (or `_anon`) holds for a run; null when absent or unreadable.
 * # Performance & Risk Budget
 * - Tier: P0 (<1ms)
 * - Complexity: O(b), receipt bytes
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=90%
 * - CRAP Score: target <=3
 */
export function readDeliveryReceipt(runDir: string, session: string): DeliveryReceipt | null {
  if (session !== ANONYMOUS_RECEIPT && !SAFE_ID.test(session)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(runDir, DELIVERY_RECEIPT_DIR, `${session}.json`), 'utf8')) as DeliveryReceipt;
  } catch {
    return null;
  }
}
