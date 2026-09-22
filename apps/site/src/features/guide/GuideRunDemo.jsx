'use client';

import { useState } from 'react';
import { Check, CircleAlert, RotateCcw, ShieldCheck } from 'lucide-react';

const INITIAL_EVENTS = [
  { id: 'EVT_002', type: 'PROMPT_MOUNTED', detail: 'states/verify.md' },
  { id: 'EVT_001', type: 'STATE_ENTERED', detail: 'VERIFY' },
];

function event(id, type, detail) {
  return { id, type, detail };
}

export function GuideRunDemo() {
  const [state, setState] = useState('VERIFY');
  const [guard, setGuard] = useState('READY');
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [message, setMessage] = useState('Run the check. The guard decides whether the workflow advances.');

  const runFailingCheck = () => {
    setState('VERIFY');
    setGuard('BLOCKED');
    setMessage('State preserved. Fix the failing check, then emit the signal again.');
    setEvents((current) => [
      event(`EVT_${String(current.length + 1).padStart(3, '0')}`, 'GUARD_REJECTED', 'exit_code == 0, received 1'),
      ...current,
    ]);
  };

  const runPassingCheck = () => {
    setState('COMPLETE');
    setGuard('PASSED');
    setMessage('Evidence passed. The workflow advanced and recorded the transition.');
    setEvents((current) => [
      event(`EVT_${String(current.length + 1).padStart(3, '0')}`, 'STATE_TRANSITION', 'VERIFY -> COMPLETE'),
      ...current,
    ]);
  };

  const reset = () => {
    setState('VERIFY');
    setGuard('READY');
    setMessage('Run the check. The guard decides whether the workflow advances.');
    setEvents(INITIAL_EVENTS);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-phino-border-strong bg-phino-code-bg text-phino-code-text shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/45">Live run</p>
          <p className="mt-1 font-display text-sm font-semibold text-white">Refactor workflow</p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 font-mono text-[11px] text-white/60 transition-colors hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Reset
        </button>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-wider text-white/45">
              <span>Current state</span>
              <span className={state === 'COMPLETE' ? 'text-emerald-300' : 'text-teal-300'}>{state}</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-400/15 text-teal-300">
                {state === 'COMPLETE' ? <Check className="h-4 w-4" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              </span>
              <div>
                <p className="font-mono text-sm text-white">states/verify.md</p>
                <p className="mt-1 text-xs text-white/50">Only active instructions are mounted.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-wider text-white/45">
              <span>Guard</span>
              <span className={guard === 'BLOCKED' ? 'text-amber-300' : guard === 'PASSED' ? 'text-emerald-300' : 'text-white/60'}>{guard}</span>
            </div>
            <code className="mt-3 block rounded-lg bg-black/25 px-3 py-2 font-mono text-xs text-amber-200">exit_code == 0</code>
          </div>

          <p className="min-h-10 text-sm leading-relaxed text-white/65" aria-live="polite">{message}</p>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={runFailingCheck}
              className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              Simulate failure
            </button>
            <button
              type="button"
              onClick={runPassingCheck}
              className="rounded-lg bg-teal-400 px-3 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              Emit passing result
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-wider text-white/45">
            <span>Append-only event ledger</span>
            <span className="text-emerald-300">live</span>
          </div>
          <div className="mt-3 space-y-2" aria-label="Run events">
            {events.map((item) => (
              <div key={item.id} className="flex gap-2 text-[11px] leading-relaxed">
                <span className="shrink-0 text-white/35">{item.id}</span>
                <span className="font-semibold text-teal-300">{item.type}</span>
                <span className="min-w-0 truncate text-white/55">{item.detail}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-white/60">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
            <span>A rejected guard does not erase work or invent a new state. It leaves a recovery point.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
