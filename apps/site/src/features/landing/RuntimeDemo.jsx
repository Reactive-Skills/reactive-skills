'use client';

import { useState } from 'react';
import { ArrowRight, Check, RotateCcw, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// An illustrative skill: the names show the shape of a run, not a published workflow.
// Each event is the one that brought the run into that state.
const STATES = [
  { name: 'EXPLORE', prompt: 'Inspect the workspace. Identify constraints and define scope.', signal: 'scope.ready', event: 'run started', deliverable: 'scope.md' },
  { name: 'PLAN', prompt: 'Build an execution plan from the approved scope.', signal: 'plan.approved', event: 'scope defined', deliverable: 'plan.md' },
  { name: 'EXECUTE', prompt: 'Implement the approved plan. Record each completed task.', signal: 'work.completed', event: 'plan approved', deliverable: 'changes.md' },
  { name: 'VERIFY', prompt: 'Validate the deliverables against the original constraints.', signal: 'verification.passed', event: 'work completed', deliverable: 'verification.md' },
  { name: 'DONE', prompt: 'Run complete. The event history and deliverables remain available.', signal: null, event: 'verification passed', deliverable: 'summary.md' },
];

const LAST = STATES.length - 1;

/**
 * Interactive example run: each click emits the active state's signal and appends one event.
 *
 * # Performance & Risk Budget
 * - Tier: P2 (client interaction; one state update per click)
 * - Complexity: O(n) render in the n = 5 example states
 * - Cyclomatic Complexity (CC): target <=6
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=12
 */
export function RuntimeDemo() {
  const [active, setActive] = useState(0);
  const state = STATES[active];

  return (
    <div className="overflow-hidden rounded-lg border border-phino-border bg-phino-surface-sunken">
      <div className="flex items-center justify-between border-b border-phino-border px-5 py-4 font-mono text-xs">
        <span className="flex items-center gap-2 text-phino-text">
          <span className="size-1.5 rounded-full bg-phino-signal" aria-hidden="true" /> release-audit
        </span>
        <span className="text-phino-text-subtle">INTERACTIVE EXAMPLE</span>
      </div>

      <ol className="grid grid-cols-5 border-b border-phino-border" aria-label="Example states">
        {STATES.map((s, i) => (
          <li
            key={s.name}
            aria-current={i === active ? 'step' : undefined}
            className={cn(
              'runtime-step min-w-0 border-r border-phino-border px-1 py-6 text-center last:border-r-0 sm:px-4',
              i === active ? 'bg-phino-signal-soft text-phino-signal-text' : i < active ? 'text-phino-event-text' : 'text-phino-text-subtle',
            )}
          >
            <span className="mb-3 block font-mono text-[10px]">{i < active ? 'COMMITTED' : i === active ? 'ACTIVE' : 'PENDING'}</span>
            <span className="block truncate font-mono text-[9px] font-medium sm:text-sm">{s.name}</span>
          </li>
        ))}
      </ol>

      <div className="grid lg:grid-cols-[1.2fr_1fr]">
        <div className="border-b border-phino-border p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <p className="font-mono text-xs text-phino-text-subtle">CURRENT PROMPT SLICE</p>
          <p className="mt-5 min-h-20 max-w-lg font-display text-xl leading-relaxed text-phino-text">{state.prompt}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setActive(Math.min(active + 1, LAST))}
              disabled={active === LAST}
              className="inline-flex h-11 items-center gap-2 rounded-sm bg-phino-signal px-4 font-mono text-xs font-medium text-phino-signal-on transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {active === LAST ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" /> Run complete
                </>
              ) : (
                <>
                  Next example step <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActive(0)}
              aria-label="Reset example"
              title="Reset example"
              className="inline-flex h-10 w-10 items-center justify-center rounded-sm text-phino-text-muted transition-colors hover:bg-phino-surface-raised hover:text-phino-text"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-4 flex items-center gap-2 font-mono text-[11px] text-phino-text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-phino-guard-text" aria-hidden="true" /> Example guard: prerequisites satisfied
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between font-mono text-xs text-phino-text-subtle">
            <span>APPEND-ONLY EVENT LOG</span>
            <span>{String(active + 1).padStart(2, '0')} EVENTS</span>
          </div>
          <ol aria-live="polite" className="mt-5 min-h-24 space-y-3">
            {STATES.slice(0, active + 1).map((s, i) => (
              <li key={s.name} className="flex gap-4 font-mono text-[11px] sm:text-xs">
                <span className="text-phino-text-subtle">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-phino-event-text">{s.event}</span>
                <span className="ml-auto text-phino-text-muted">{s.name.toLowerCase()}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex items-center justify-between border-t border-phino-border pt-5 font-mono text-xs">
            <span className="text-phino-text-subtle">LIVE DELIVERABLE</span>
            <span className="text-phino-signal-text">{state.deliverable}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
