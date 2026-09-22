'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Terminal, 
  Layers, 
  ShieldCheck, 
  AlertCircle, 
  Check, 
  Cpu, 
  GitBranch, 
  Activity, 
  Clock 
} from 'lucide-react';
import { CopyButton } from '@/components/common/CopyButton';
import { cn } from '@/lib/utils';

export function Hero() {
  // Dual-Plane Command Selector
  const [cmdMode, setCmdMode] = useState('axi');

  // Interactive Workbench Console Tabs (Options 1, 2, 3 Unified)
  const [workbenchTab, setWorkbenchTab] = useState('statechart'); // 'statechart' | 'slicer' | 'terminal'

  // Statechart Simulation State
  const [stateIndex, setStateIndex] = useState(1);
  const [guardStatus, setGuardStatus] = useState('PASS');
  const [isEvaluating, setIsEvaluating] = useState(false);

  const states = [
    { num: '01', name: 'SLICE', file: 'states/01_slice.md', tokens: 240, desc: 'Isolate slice boundaries and establish contract before writing code.' },
    { num: '02', name: 'VERIFY', file: 'states/02_verify.md', tokens: 284, desc: 'Execute unit test suite against slice. Enforce exit_code == 0 with code guard.' },
    { num: '03', name: 'REVIEW', file: 'states/03_review.md', tokens: 310, desc: 'Five-axis code review: AST bounds, complexity delta, and spec conformance.' },
    { num: '04', name: 'COMMIT', file: 'states/04_commit.md', tokens: 195, desc: 'Append atomic Git commit and record cryptographic hash to immutable event ledger.' },
  ];

  const [logs, setLogs] = useState([
    { id: 'EVT_091', time: '14:02:22', type: 'GUARD_EVALUATED', detail: 'exit_code === 0 -> PASS' },
    { id: 'EVT_090', time: '14:02:19', type: 'PROMPT_SLICED', detail: 'states/02_verify.md mounted (284 tokens)' },
    { id: 'EVT_089', time: '14:02:18', type: 'STATE_ENTERED', detail: '02_verify active in execution session' },
  ]);

  const handleEmitSignal = useCallback((signal) => {
    setIsEvaluating(true);
    setTimeout(() => {
      setStateIndex((prev) => {
        const next = (prev + 1) % 4;
        const now = new Date().toTimeString().split(' ')[0];
        const newLog = {
          id: `EVT_${Math.floor(100 + Math.random() * 900)}`,
          time: now,
          type: 'SIGNAL_EMITTED',
          detail: `${signal} -> Transitioning to ${states[next].name}`,
        };
        setLogs((cur) => [newLog, ...cur.slice(0, 5)]);
        return next;
      });
      setIsEvaluating(false);
    }, 200);
  }, [states]);

  const handleGuardFailure = useCallback(() => {
    setGuardStatus('REJECTED');
    const now = new Date().toTimeString().split(' ')[0];
    const newLog = {
      id: `ALERT_${Math.floor(100 + Math.random() * 900)}`,
      time: now,
      type: 'GUARD_BLOCKED',
      detail: 'test_suite.exit_code === 1. Transition aborted. State preserved.',
    };
    setLogs((cur) => [newLog, ...cur.slice(0, 5)]);

    setTimeout(() => {
      setGuardStatus('PASS');
    }, 3200);
  }, []);

  const activeCommand = cmdMode === 'axi' 
    ? 'npx -y @reactive-skills/axi state incremental-implementation' 
    : 'npx -y @reactive-skills/axi mcp';

  return (
    <section className="relative overflow-hidden border-b border-phino-border bg-phino-canvas">
      {/* Phino Proportional Grid & Ambient Glows */}
      <div className="phino-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="phino-radial pointer-events-none absolute inset-0" aria-hidden="true" />
      
      <div className="container relative py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8 xl:gap-12">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN: Authority, Architectural Value & Dual Onboarding (7 cols)    */}
          {/* ========================================================================= */}
          <div className="space-y-6 lg:col-span-6 xl:col-span-7">
            
            {/* Architectural Eyebrow Pill */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-phino-signal/30 bg-phino-signal-soft/60 px-3.5 py-1 text-xs font-mono text-phino-signal-text">
              <span className="h-2 w-2 animate-pulse-soft rounded-full bg-phino-signal" aria-hidden="true" />
              <span className="font-semibold uppercase tracking-wider">Event-Driven Agent Runtime</span>
              <span className="text-phino-border-strong select-none">/</span>
              <span className="text-phino-text-muted">State-Isolated Execution</span>
            </div>

            {/* Monumental Headline (Direction A) */}
            <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-phino-text sm:text-5xl xl:text-6xl">
              Prompts are suggestions. <br />
              <span className="bg-gradient-to-r from-phino-signal-text via-teal-300 to-emerald-300 bg-clip-text text-transparent">
                State machines are guarantees.
              </span>
            </h1>

            {/* Value Narrative (A + C Blend) */}
            <p className="max-w-2xl text-base leading-relaxed text-phino-text-muted sm:text-lg">
              Coding agents drift when fed monolithic prompt manuals. Reactive Skills gives non-deterministic models an operating system: mounting only the active state&apos;s isolated prompt slice, enforcing transitions with verifiable code guards, and committing every run to an immutable event ledger.
            </p>

            {/* Dual Quickstart Command Switcher (AXI vs MCP) */}
            <div className="max-w-xl rounded-xl border border-phino-border bg-phino-surface p-3 sm:p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5" role="tablist" aria-label="Command modality">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={cmdMode === 'axi'}
                    onClick={() => setCmdMode('axi')}
                    className={cn(
                      'rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors',
                      cmdMode === 'axi'
                        ? 'border border-phino-signal/40 bg-phino-signal-soft text-phino-signal-text font-semibold'
                        : 'text-phino-text-muted hover:text-phino-text'
                    )}
                  >
                    axi CLI (Zero Token Overhead)
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={cmdMode === 'mcp'}
                    onClick={() => setCmdMode('mcp')}
                    className={cn(
                      'rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors',
                      cmdMode === 'mcp'
                        ? 'border border-phino-signal/40 bg-phino-signal-soft text-phino-signal-text font-semibold'
                        : 'text-phino-text-muted hover:text-phino-text'
                    )}
                  >
                    MCP Server (IDE Bridge)
                  </button>
                </div>
                <span className="hidden font-mono text-[11px] uppercase tracking-wider text-phino-text-subtle sm:inline">
                  {cmdMode === 'axi' ? 'shell interface' : 'json-rpc 2.0'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-phino-border-strong bg-phino-code-bg px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto font-mono text-xs sm:text-sm">
                  <span className="select-none text-phino-signal" aria-hidden="true">$</span>
                  <code className="whitespace-nowrap text-phino-code-text">{activeCommand}</code>
                </div>
                <CopyButton
                  value={activeCommand}
                  size="sm"
                  className="shrink-0 border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"
                />
              </div>
            </div>

            {/* Hard Telemetry Metrics Ribbon */}
            <div className="grid max-w-xl grid-cols-3 gap-3 pt-1">
              <div className="rounded-lg border border-phino-border bg-phino-surface-raised/80 p-3">
                <div className="font-display text-2xl font-bold tracking-tight text-phino-signal-text">~78%</div>
                <div className="mt-0.5 text-xs text-phino-text-subtle font-medium">Context Window Saved</div>
              </div>
              <div className="rounded-lg border border-phino-border bg-phino-surface-raised/80 p-3">
                <div className="font-display text-2xl font-bold tracking-tight text-phino-guard-text">0%</div>
                <div className="mt-0.5 text-xs text-phino-text-subtle font-medium">Self-Policing Drift</div>
              </div>
              <div className="rounded-lg border border-phino-border bg-phino-surface-raised/80 p-3">
                <div className="font-display text-2xl font-bold tracking-tight text-phino-state-text">100%</div>
                <div className="mt-0.5 text-xs text-phino-text-subtle font-medium">Append-Only Audit Trail</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/docs/quickstart"
                className="inline-flex items-center gap-2 rounded-lg bg-phino-text px-5 py-2.5 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
              >
                Get Started with axi <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/registry"
                className="inline-flex items-center gap-1.5 rounded-lg border border-phino-border-strong bg-phino-surface-raised px-5 py-2.5 text-sm font-medium text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
              >
                Browse Skill Catalog
              </Link>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: Interactive Runtime Workbench Console (5 cols)             */}
          {/* Combines Option 1 (Statechart), Option 2 (Slicer), Option 3 (Cockpit)     */}
          {/* ========================================================================= */}
          <div className="lg:col-span-6 xl:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-phino-border-strong bg-phino-surface shadow-2xl">
              
              {/* Console Window Top Titlebar */}
              <div className="flex items-center justify-between border-b border-phino-border bg-phino-surface-raised px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500/80" aria-hidden="true" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" aria-hidden="true" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" aria-hidden="true" />
                  <span className="ml-2 font-mono text-xs font-semibold text-phino-text">
                    runtime-session://local &bull; incremental-implementation
                  </span>
                </div>
                <div className="flex items-center gap-1.5 rounded bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                  <span>ACTIVE_SESSION</span>
                </div>
              </div>

              {/* Console View Mode Switcher (Option 1, Option 2, Option 3) */}
              <div className="flex border-b border-phino-border bg-phino-code-bg p-1.5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setWorkbenchTab('statechart')}
                  className={cn(
                    'flex-1 rounded-md py-1.5 text-center font-medium transition-colors flex items-center justify-center gap-1.5',
                    workbenchTab === 'statechart'
                      ? 'bg-phino-surface-raised border border-phino-signal/40 text-phino-signal-text font-semibold shadow-sm'
                      : 'text-phino-text-muted hover:text-phino-text'
                  )}
                >
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Statechart FSM</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkbenchTab('slicer')}
                  className={cn(
                    'flex-1 rounded-md py-1.5 text-center font-medium transition-colors flex items-center justify-center gap-1.5',
                    workbenchTab === 'slicer'
                      ? 'bg-phino-surface-raised border border-phino-signal/40 text-phino-signal-text font-semibold shadow-sm'
                      : 'text-phino-text-muted hover:text-phino-text'
                  )}
                >
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Slicer Diff</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkbenchTab('terminal')}
                  className={cn(
                    'flex-1 rounded-md py-1.5 text-center font-medium transition-colors flex items-center justify-center gap-1.5',
                    workbenchTab === 'terminal'
                      ? 'bg-phino-surface-raised border border-phino-signal/40 text-phino-signal-text font-semibold shadow-sm'
                      : 'text-phino-text-muted hover:text-phino-text'
                  )}
                >
                  <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>AXI Shell</span>
                </button>
              </div>

              {/* TAB CONTENT 1: LIVE STATECHART (Option 1) */}
              {workbenchTab === 'statechart' && (
                <div>
                  {/* Visual State Pipeline Stepper */}
                  <div className="border-b border-phino-border bg-phino-surface-raised/40 p-3.5 sm:p-4">
                    <div className="mb-2 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-phino-text-subtle">
                      <span>Hierarchical States (HSM)</span>
                      <span className="font-semibold text-phino-signal-text">
                        State {stateIndex + 1} of 4
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
                      {states.map((s, idx) => (
                        <div
                          key={s.num}
                          className={cn(
                            'rounded p-2 text-center transition-all duration-200 border',
                            idx === stateIndex
                              ? 'border-teal-500 bg-teal-50 text-teal-950 shadow-sm font-bold dark:border-teal-400 dark:bg-teal-950/60 dark:text-teal-200 dark:shadow-[0_0_12px_rgba(45,212,191,0.15)]'
                              : idx < stateIndex
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : 'border-slate-200 bg-slate-100/70 text-slate-600 font-medium dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500 opacity-80'
                          )}
                        >
                          <span className={cn(
                            'block text-[10px]',
                            idx === stateIndex
                              ? 'text-teal-700 dark:text-teal-400 font-semibold'
                              : idx < stateIndex
                              ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                              : 'text-slate-400 dark:text-slate-600'
                          )}>{s.num}</span>
                          <span className="truncate block">{s.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active Prompt Slice & Verifiable Guard */}
                  <div className="p-4 space-y-3.5">
                    
                    {/* Prompt Slice */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between font-mono text-xs text-phino-text-muted">
                        <span className="flex items-center gap-1.5">
                          <Cpu className="h-3.5 w-3.5 text-phino-state" aria-hidden="true" />
                          <span>Mounted State Slice (Context Injected)</span>
                        </span>
                        <span className="rounded bg-phino-state-soft px-1.5 py-0.5 text-phino-state-text text-[11px] font-semibold">
                          {states[stateIndex].tokens} tokens &bull; 8.9k avoided
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-700/50 bg-[#0c0e13] p-3 font-mono text-xs leading-relaxed text-slate-200">
                        <span className="mb-1 block font-bold text-teal-400">
                          # {states[stateIndex].file}
                        </span>
                        <p className="text-slate-400">{states[stateIndex].desc}</p>
                      </div>
                    </div>

                    {/* Deterministic Guard Expression */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between font-mono text-xs text-phino-text-muted">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-phino-guard" aria-hidden="true" />
                          <span>Deterministic Code Guard</span>
                        </span>
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 text-[11px] font-bold tracking-wide transition-colors',
                            guardStatus === 'PASS'
                              ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-400'
                              : 'bg-red-950/80 border border-red-500/50 text-red-300 animate-pulse'
                          )}
                        >
                          GUARD_{guardStatus}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-[#0c0e13] px-3 py-2 font-mono text-xs text-amber-300">
                        <code className="text-[11px] sm:text-xs text-amber-300">
                          assert test_suite.exit_code === 0 &amp;&amp; diff &lt; 150
                        </code>
                        <span>{guardStatus === 'PASS' ? '✓' : '✗'}</span>
                      </div>
                    </div>

                    {/* Interactive Action Triggers */}
                    <div className="border-t border-phino-border pt-3">
                      <div className="mb-2 flex items-center justify-between font-mono text-xs text-phino-text-muted">
                        <span>Interactive Simulator:</span>
                        <span className="text-[11px] text-teal-700 dark:text-phino-signal-text font-medium">Click to emit signal</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                        <button
                          type="button"
                          disabled={isEvaluating}
                          onClick={() => handleEmitSignal('TESTS_PASSED')}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-teal-600/30 bg-teal-600 px-3 py-2 font-semibold text-white shadow-sm transition-all hover:bg-teal-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-teal-400/40 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300 dark:shadow-[0_0_16px_rgba(45,212,191,0.25)]"
                        >
                          <span>Emit: [TESTS_PASSED]</span>
                          <span aria-hidden="true">&rarr;</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleGuardFailure}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-medium text-red-700 transition-all hover:bg-red-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                        >
                          Simulate Guard Failure (exit 1)
                        </button>
                      </div>
                    </div>

                    {/* Append-Only Event Ledger */}
                    <div className="pt-1 font-mono text-xs">
                      <div className="mb-1.5 flex items-center justify-between text-[11px] text-phino-text-subtle uppercase tracking-wider">
                        <span>Event Stream (.reactive/events.jsonl)</span>
                        <span>append-only</span>
                      </div>
                      <div className="h-28 overflow-y-auto rounded-lg border border-slate-700/50 bg-[#0c0e13] p-2.5 space-y-1.5 text-[11px]">
                        {logs.map((log, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-slate-300">
                            <span className="text-slate-500 shrink-0">{log.time}</span>
                            <span className="font-semibold text-teal-400 shrink-0">[{log.id}]</span>
                            <span className="text-slate-200 font-medium shrink-0">{log.type}</span>
                            <span className="truncate text-slate-400">&bull; {log.detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* TAB CONTENT 2: PROMPT SLICER DIFF (Option 2) */}
              {workbenchTab === 'slicer' && (
                <div className="p-4 space-y-4 font-mono text-xs">
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 space-y-2 dark:border-red-500/30 dark:bg-red-950/20">
                    <div className="flex items-center justify-between border-b border-red-200 pb-2 dark:border-red-500/20">
                      <span className="font-bold text-red-700 dark:text-red-400 uppercase tracking-wide text-[11px]">
                        Passive Prompts (Static Markdown)
                      </span>
                      <span className="rounded bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 font-semibold text-[11px]">
                        8,900 tokens dump
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-red-800 dark:text-red-300 text-[11px]">
                      <li className="flex items-center gap-2">
                        <span aria-hidden="true" className="font-bold text-red-500 dark:text-red-400">✕</span>
                        <span>All phases dump simultaneously into LLM context</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span aria-hidden="true" className="font-bold text-red-500 dark:text-red-400">✕</span>
                        <span>Model self-polices: claims completion without proof</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span aria-hidden="true" className="font-bold text-red-500 dark:text-red-400">✕</span>
                        <span>Zero rollback history; endless hallucinations</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-teal-200 bg-teal-50 p-3.5 space-y-2 dark:border-teal-500/30 dark:bg-teal-950/20">
                    <div className="flex items-center justify-between border-b border-teal-200 pb-2 dark:border-teal-500/20">
                      <span className="font-bold text-teal-800 dark:text-teal-400 uppercase tracking-wide text-[11px]">
                        Reactive Skills Runtime
                      </span>
                      <span className="rounded bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 px-2 py-0.5 font-semibold text-[11px]">
                        284 tokens active slice
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-teal-800 dark:text-teal-300 text-[11px]">
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                        <span>Only current state prompt mounted (~78% token savings)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                        <span>Transitions verified by code guards (exit_code === 0)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                        <span>Immutable append-only ledger for instant state recovery</span>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 dark:border-phino-border dark:bg-phino-code-bg p-3 text-center text-slate-700 dark:text-phino-text-muted text-[11px]">
                    <span className="text-teal-700 dark:text-teal-400 font-semibold">Net Result:</span> Deterministic execution, zero agent drift, and massive API cost reduction.
                  </div>
                </div>
              )}

              {/* TAB CONTENT 3: AXI COCKPIT (Option 3) */}
              {workbenchTab === 'terminal' && (
                <div className="p-4 font-mono text-xs">
                  <div className="space-y-2 rounded-lg border border-slate-700/50 bg-[#0c0e13] p-3.5 text-[11px] leading-relaxed">
                    <p className="text-slate-500 font-normal"># 1. Query active state and instructions</p>
                    <p className="text-slate-100 font-semibold flex items-center gap-1.5">
                      <span className="text-teal-400 select-none font-bold">$ </span>
                      <span>axi state incremental-implementation</span>
                    </p>
                    <p className="text-emerald-400 pl-4 font-medium">
                      &rarr; State: 02_verify | Guards: [test_suite] | Active slice: 284 tokens
                    </p>
                    
                    <p className="text-slate-500 font-normal pt-2"># 2. Run unit tests and verify slice</p>
                    <p className="text-slate-100 font-semibold flex items-center gap-1.5">
                      <span className="text-teal-400 select-none font-bold">$ </span>
                      <span>pnpm test:slice</span>
                    </p>
                    <p className="text-slate-400 pl-4">
                      ✓ 12 passed, 0 failed (latency: 180ms)
                    </p>

                    <p className="text-slate-500 font-normal pt-2"># 3. Emit verified signal to transition state</p>
                    <p className="text-slate-100 font-semibold flex items-center gap-1.5">
                      <span className="text-teal-400 select-none font-bold">$ </span>
                      <span>axi emit incremental-implementation test.verified</span>
                    </p>
                    <p className="text-teal-300 pl-4 font-medium">
                      ✓ Guard verified &rarr; State advanced to 03_review (Event #092 signed)
                    </p>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-phino-text-subtle px-1">
                    <span>CLI Shell Latency: &lt; 18ms</span>
                    <span className="text-teal-700 dark:text-phino-signal-text font-semibold">Token Overhead: 0</span>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
