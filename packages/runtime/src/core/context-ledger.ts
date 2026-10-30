import type { SignalEvent } from './types.js';

/** Context keys committed after a ledger sequence, plus the active path at that sequence. */
export interface LedgerContextChanges {
  keys: Set<string>;
  /** Active path at the anchor when a transition followed it; undefined when the state did not change. */
  anchorPath?: string[];
}

/**
 * Fold committed context patches after an anchor with the same rules as replay: pending signals
 * contribute only when a transition commits them, and unpatched historical transitions fall back to
 * their signal's declared keys. Returns null when the window cannot be folded safely (a reset, or an
 * unpatched transition whose signal precedes the window), so callers send the full view instead.
 *
 * # Performance & Risk Budget
 * - Tier: P1 (<25ms)
 * - Complexity: O(e + p), events after the anchor and their patch keys
 * - Cyclomatic Complexity (CC): target <= 12
 * - Branch Coverage: target >= 90%
 * - CRAP Score: target <= 15.0
 */
export function contextChangesSince(events: SignalEvent[], contextKeys: string[]): LedgerContextChanges | null {
  const keys = new Set<string>();
  const pending = new Map<string, Record<string, any>>();
  let anchorPath: string[] | undefined;
  const add = (updates: Record<string, unknown> | undefined) => {
    for (const key of Object.keys(updates ?? {})) keys.add(key);
  };
  for (const event of events) {
    const payload = event.payload ?? {};
    switch (event.type) {
      case 'SKILL_INITIALIZED':
        if (payload.active_path) return null;
        add(payload.contextUpdates);
        break;
      case 'SIGNAL_EMITTED':
        pending.set(event.id, payload);
        break;
      case 'STATE_TRANSITION': {
        if (!payload.to) {
          add(payload.contextUpdates);
          break;
        }
        if (!anchorPath && typeof payload.from === 'string') anchorPath = payload.from.split('.');
        if (payload.contextUpdates) {
          add(payload.contextUpdates);
          break;
        }
        const signal = pending.get(event.causation_id || event.causationId || '');
        if (!signal) return null;
        for (const key of contextKeys) if (signal[key] !== undefined) keys.add(key);
        add(signal.contextUpdates);
        break;
      }
      case 'STATE_ENTRY_HOOK':
        add(payload.action?.set_context ?? payload.contextUpdates);
        break;
      default:
        add(payload.contextUpdates);
    }
  }
  return { keys, anchorPath };
}
