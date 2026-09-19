'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Check,
  ArrowDown,
  ShieldCheck,
  ShieldAlert,
  Radio,
  Layers,
  CornerDownRight,
  AlertOctagon,
  Workflow,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hierarchicalStateMachine, stateMachine as linearStateMachineDefault } from '@/infrastructure/content/stateMachine';

export function StateMachine({ machine }) {
  // Mode: 'hsm' (Hierarchical Statechart) | 'linear' (Flat Pipeline)
  const [mode, setMode] = useState('hsm');

  // Linear nodes fallback
  const linearNodes = machine?.nodes && machine.nodes.length > 0 ? machine.nodes : linearStateMachineDefault.nodes;

  // Active step index
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [guardStatus, setGuardStatus] = useState('pass'); // 'pass' | 'fail' | 'bubbled'
  const [bubbleAlert, setBubbleAlert] = useState(null);

  // Live immutable event ledger
  const [history, setHistory] = useState([
    {
      seq: 1,
      type: 'SKILL_INITIALIZED',
      from: 'BOOT',
      to: 'RED_SPEC',
      signal: 'BOOT_RUNTIME',
      guard: 'pass',
      note: 'Runtime initialized; mounted hierarchical skill tdd-refactor.yaml.',
    },
  ]);

  const timer = useRef(null);
  const hsmSteps = hierarchicalStateMachine.steps;
  const compositeStates = hierarchicalStateMachine.compositeStates;
  const compositeRefactor = compositeStates[0];

  const currentHsm = hsmSteps[active] || hsmSteps[0];
  const currentLinear = linearNodes[active] || linearNodes[0];

  const current = mode === 'hsm' ? currentHsm : currentLinear;
  const totalSteps = mode === 'hsm' ? hsmSteps.length : linearNodes.length;
  const atEnd = active >= totalSteps - 1;

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // Reset when switching modes
  const switchMode = (newMode) => {
    if (newMode === mode) return;
    setPlaying(false);
    clearTimer();
    setMode(newMode);
    setActive(0);
    setGuardStatus('pass');
    setBubbleAlert(null);
    if (newMode === 'hsm') {
      setHistory([
        {
          seq: 1,
          type: 'SKILL_INITIALIZED',
          from: 'BOOT',
          to: 'RED_SPEC',
          signal: 'BOOT_RUNTIME',
          guard: 'pass',
          note: 'Runtime initialized; mounted hierarchical skill tdd-refactor.yaml.',
        },
      ]);
    } else {
      setHistory([
        {
          seq: 1,
          type: 'SKILL_INITIALIZED',
          from: 'INIT',
          to: linearNodes[0]?.name || 'EXPLORE',
          signal: 'BOOT_RUNTIME',
          guard: 'pass',
          note: 'Standard runtime initialized; prompt slice mounted.',
        },
      ]);
    }
  };

  // Universal reset
  const reset = useCallback((keepPlaying = false) => {
    if (!keepPlaying) {
      setPlaying(false);
      clearTimer();
    }
    setActive(0);
    setGuardStatus('pass');
    setBubbleAlert(null);
    if (mode === 'hsm') {
      setHistory([
        {
          seq: 1,
          type: 'SKILL_INITIALIZED',
          from: 'BOOT',
          to: 'RED_SPEC',
          signal: 'RUN_RESET',
          guard: 'pass',
          note: 'Hierarchical statechart reset to initial state RED_SPEC.',
        },
      ]);
    } else {
      setHistory([
        {
          seq: 1,
          type: 'SKILL_INITIALIZED',
          from: 'INIT',
          to: linearNodes[0]?.name || 'EXPLORE',
          signal: 'RUN_RESET',
          guard: 'pass',
          note: 'Workflow reset to initial state.',
        },
      ]);
    }
  }, [mode, linearNodes]);

  // Step function for forward progression
  const step = useCallback(() => {
    setBubbleAlert(null);
    if (atEnd) {
      reset();
      return;
    }

    if (mode === 'hsm') {
      const nextIdx = active + 1;
      const nextStep = hsmSteps[nextIdx];
      const fromStep = hsmSteps[active];

      // If transitioning from GREEN_CODE (1) to REFACTOR.CLEAN_CODE (2): entering composite state!
      if (active === 1 && nextIdx === 2) {
        setActive(nextIdx);
        setGuardStatus('pass');
        setHistory((prev) => [
          ...prev,
          {
            seq: prev.length + 1,
            type: 'STATE_TRANSITION',
            from: fromStep.name,
            to: 'REFACTOR.CLEAN_CODE',
            signal: 'TEST_RAN (pass)',
            guard: 'pass',
            note: 'Tests passed (exit_code === 0). Entered composite state REFACTOR; resolved initial_substate to CLEAN_CODE.',
          },
          {
            seq: prev.length + 2,
            type: 'STATE_ENTRY_HOOK',
            from: 'REFACTOR',
            to: 'REFACTOR',
            signal: 'REFACTOR_CYCLE_STARTED',
            guard: 'pass',
            note: 'Parent lifecycle hook executed: set_context { refactor_cycles: 1 } and emitted REFACTOR_CYCLE_STARTED.',
          },
        ]);
        return;
      }

      // If transitioning from REFACTOR.PERF_AUDIT (3) to AUDIT_VERIFY (4): exiting composite state!
      if (active === 3 && nextIdx === 4) {
        setActive(nextIdx);
        setGuardStatus('pass');
        setHistory((prev) => [
          ...prev,
          {
            seq: prev.length + 1,
            type: 'STATE_EXIT_HOOK',
            from: 'REFACTOR',
            to: 'REFACTOR',
            signal: 'REFACTOR_CYCLE_CONCLUDED',
            guard: 'pass',
            note: 'Parent lifecycle exit hook: emitted REFACTOR_CYCLE_CONCLUDED before leaving composite boundary.',
          },
          {
            seq: prev.length + 2,
            type: 'STATE_TRANSITION',
            from: 'REFACTOR.PERF_AUDIT',
            to: 'AUDIT_VERIFY',
            signal: 'AUDIT_PASSED',
            guard: 'pass',
            note: 'Performance audit completed without regressions. Advanced to AUDIT_VERIFY.',
          },
        ]);
        return;
      }

      // Standard forward transition
      setActive(nextIdx);
      setGuardStatus('pass');
      setHistory((prev) => [
        ...prev,
        {
          seq: prev.length + 1,
          type: 'STATE_TRANSITION',
          from: fromStep.name,
          to: nextStep.name,
          signal: fromStep.emits || `SIGNAL_${nextStep.name}`,
          guard: 'pass',
          note: `Guard passed (${fromStep.guard || 'unconditional'}); advanced to ${nextStep.name}.`,
        },
      ]);
    } else {
      // Linear mode
      const nextIdx = active + 1;
      const nextNode = linearNodes[nextIdx];
      const fromNode = linearNodes[active];
      setActive(nextIdx);
      setGuardStatus('pass');
      setHistory((prev) => [
        ...prev,
        {
          seq: prev.length + 1,
          type: 'STATE_TRANSITION',
          from: fromNode.name,
          to: nextNode.name,
          signal: fromNode.emits || `SIGNAL_${nextNode.name}`,
          guard: 'pass',
          note: `Guard verified: ${fromNode.guard || 'true'}; advanced to ${nextNode.name}.`,
        },
      ]);
    }
  }, [active, atEnd, mode, hsmSteps, linearNodes, reset]);

  // Autoplay
  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => {
      step();
    }, 1600);
    return clearTimer;
  }, [playing, atEnd, step]);

  const togglePlay = () => {
    if (atEnd) {
      reset(true);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  const handleManualStep = () => {
    setPlaying(false);
    clearTimer();
    step();
  };

  // HSM Specific: Simulate Event Bubbling Upwards
  const handleBubbleRegression = () => {
    setPlaying(false);
    setGuardStatus('fail');
    setBubbleAlert({
      title: 'Event Bubbled to Ancestor State',
      description:
        'Signal TEST_RAN { exit_code: 1 } was unhandled in leaf state PERF_AUDIT. The runtime bubbled the event up 1 level to ancestor REFACTOR. Parent guard "exit_code != 0" matched, executed on_exit hook, and rolled back active state to GREEN_CODE.',
    });

    setHistory((prev) => [
      ...prev,
      {
        seq: prev.length + 1,
        type: 'SIGNAL_EMITTED',
        from: 'REFACTOR.PERF_AUDIT',
        to: 'REFACTOR.PERF_AUDIT',
        signal: 'TEST_RAN (fail)',
        guard: 'fail',
        note: 'Regression detected: exit_code = 1. No transition defined on PERF_AUDIT leaf.',
      },
      {
        seq: prev.length + 2,
        type: 'EVENT_BUBBLED',
        from: 'REFACTOR.PERF_AUDIT',
        to: 'REFACTOR',
        signal: 'TEST_RAN',
        guard: 'bubbled',
        note: 'Unhandled event bubbled up hierarchy: depth 2 -> depth 1 (handledAt: REFACTOR).',
      },
      {
        seq: prev.length + 3,
        type: 'GUARD_EVALUATED',
        from: 'REFACTOR',
        to: 'GREEN_CODE',
        signal: 'TEST_RAN',
        guard: 'pass',
        note: 'Ancestor transition guard evaluated: "event.payload.exit_code != 0" returned true.',
      },
      {
        seq: prev.length + 4,
        type: 'STATE_EXIT_HOOK',
        from: 'REFACTOR',
        to: 'REFACTOR',
        signal: 'REFACTOR_CYCLE_CONCLUDED',
        guard: 'pass',
        note: 'Parent lifecycle exit hook: emitted REFACTOR_CYCLE_CONCLUDED.',
      },
      {
        seq: prev.length + 5,
        type: 'STATE_TRANSITION',
        from: 'REFACTOR.PERF_AUDIT',
        to: 'GREEN_CODE',
        signal: 'TEST_RAN',
        guard: 'fail',
        note: 'Rolled back to GREEN_CODE to re-establish passing test baseline.',
      },
    ]);

    // Roll back to GREEN_CODE (index 1)
    setActive(1);
  };

  // HSM Specific: Global Ancestor Abort
  const handleGlobalAbort = () => {
    setPlaying(false);
    setGuardStatus('fail');
    setBubbleAlert({
      title: 'Ancestor Transition: Global Abort Policy',
      description:
        'Signal GLOBAL_ABORT was caught directly by the parent composite state REFACTOR. Substates do not require individual abort transitions, eliminating state explosion.',
    });

    const fromState = hsmSteps[active].name;
    setHistory((prev) => [
      ...prev,
      {
        seq: prev.length + 1,
        type: 'EVENT_BUBBLED',
        from: fromState,
        to: 'REFACTOR',
        signal: 'GLOBAL_ABORT',
        guard: 'pass',
        note: 'Substate received abort. Bubbled up to parent REFACTOR ancestor transition.',
      },
      {
        seq: prev.length + 2,
        type: 'STATE_EXIT_HOOK',
        from: 'REFACTOR',
        to: 'REFACTOR',
        signal: 'REFACTOR_CYCLE_CONCLUDED',
        guard: 'pass',
        note: 'Parent on_exit hook fired: REFACTOR_CYCLE_CONCLUDED.',
      },
      {
        seq: prev.length + 3,
        type: 'STATE_TRANSITION',
        from: fromState,
        to: 'RED_SPEC',
        signal: 'GLOBAL_ABORT',
        guard: 'pass',
        note: 'Ancestor transition routed directly to RED_SPEC; spec cycle reset.',
      },
    ]);

    setActive(0);
  };

  // Linear mode: Simulate guard rejection
  const handleLinearFail = () => {
    setPlaying(false);
    const currNode = linearNodes[active];
    setGuardStatus('fail');
    setHistory((prev) => [
      ...prev,
      {
        seq: prev.length + 1,
        type: 'GUARD_EVALUATED',
        from: currNode.name,
        to: currNode.name,
        signal: 'GUARD_REJECTED',
        guard: 'fail',
        note: `Guard "${currNode.guard || 'check'}" rejected transition. State held deterministically.`,
      },
    ]);
  };

  const isCompositeActive = mode === 'hsm' && (active === 2 || active === 3);

  return (
    <div className="overflow-hidden rounded-xl border border-phino-border bg-phino-surface shadow-sm">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-phino-border bg-phino-surface-raised px-4 py-3">
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-phino-border bg-phino-canvas p-1">
          <button
            type="button"
            onClick={() => switchMode('hsm')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
              mode === 'hsm'
                ? 'bg-phino-signal text-phino-canvas shadow-sm'
                : 'text-phino-text-muted hover:text-phino-text hover:bg-phino-surface-raised',
            )}
          >
            <Workflow className="h-3.5 w-3.5" />
            <span>Hierarchical (HSM & Bubbling)</span>
            <span
              className={cn(
                'rounded px-1 text-[10px] uppercase font-bold tracking-wider',
                mode === 'hsm' ? 'bg-black/20 text-white' : 'bg-phino-signal-soft text-phino-signal-text',
              )}
            >
              Harel
            </span>
          </button>
          <button
            type="button"
            onClick={() => switchMode('linear')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
              mode === 'linear'
                ? 'bg-phino-signal text-phino-canvas shadow-sm'
                : 'text-phino-text-muted hover:text-phino-text hover:bg-phino-surface-raised',
            )}
          >
            <Radio className="h-3.5 w-3.5" />
            <span>Linear (Flat FSM)</span>
          </button>
        </div>

        {/* Player Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause run' : 'Play simulation'}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-phino-border-strong bg-phino-surface px-3 text-xs font-medium text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            {playing ? <Pause className="h-3.5 w-3.5 text-phino-signal-text" /> : <Play className="h-3.5 w-3.5 text-phino-signal-text" />}
            {playing ? 'Pause' : 'Simulate'}
          </button>
          <button
            type="button"
            onClick={handleManualStep}
            aria-label="Step forward"
            title="Step to next transition"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-phino-border bg-phino-surface text-phino-text-muted transition-colors hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => reset()}
            aria-label="Reset run"
            title="Reset state machine"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-phino-border bg-phino-surface text-phino-text-muted transition-colors hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Bubbling Event Toast / Notification Banner */}
      {bubbleAlert ? (
        <div className="flex items-start gap-3 border-b border-phino-border bg-phino-guard-soft/60 px-4 py-2.5 text-xs text-phino-guard-text">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-phino-signal" />
          <div className="flex-1">
            <p className="font-semibold text-phino-text">{bubbleAlert.title}</p>
            <p className="mt-0.5 text-phino-text-muted leading-relaxed">{bubbleAlert.description}</p>
          </div>
          <button
            type="button"
            onClick={() => setBubbleAlert(null)}
            className="rounded px-1.5 py-0.5 text-phino-text-subtle hover:text-phino-text"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Main Machine Grid */}
      <div className="grid gap-0 lg:grid-cols-12">
        {/* Left State Rail (5 cols on lg) */}
        <div className="border-b border-phino-border p-4 lg:col-span-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-phino-text-subtle">
              {mode === 'hsm' ? 'hsm state hierarchy' : 'flat state pipeline'}
            </span>
            <span className="rounded bg-phino-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-phino-text-muted">
              {mode === 'hsm' ? 'tdd-refactor.yaml' : 'standard-fsm'}
            </span>
          </div>

          {/* HSM Hierarchical Rail */}
          {mode === 'hsm' ? (
            <div className="space-y-1">
              {/* Step 0: RED_SPEC */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setPlaying(false); setActive(0); }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                    active === 0 ? 'bg-phino-surface-raised' : 'hover:bg-phino-surface-raised/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] transition-all',
                      active > 0 && 'border-phino-signal bg-phino-signal text-phino-canvas font-bold',
                      active === 0 && 'border-phino-signal bg-phino-signal-soft text-phino-signal-text ring-2 ring-phino-signal/20',
                    )}
                  >
                    {active > 0 ? <Check className="h-3 w-3" /> : '1'}
                  </span>
                  <span className={cn('font-display text-xs font-semibold', active === 0 ? 'text-phino-signal-text' : 'text-phino-text')}>
                    RED_SPEC
                  </span>
                  <span className="ml-auto font-mono text-xs text-phino-text-subtle">exit_code != 0</span>
                </button>
                <div className="ml-5 flex items-center gap-1.5 py-1 text-phino-text-subtle">
                  <ArrowDown className="h-3 w-3" />
                  <span className="font-mono text-xs">TEST_RAN (fail)</span>
                </div>
              </div>

              {/* Step 1: GREEN_CODE */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setPlaying(false); setActive(1); }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                    active === 1 ? 'bg-phino-surface-raised' : 'hover:bg-phino-surface-raised/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] transition-all',
                      active > 1 && 'border-phino-signal bg-phino-signal text-phino-canvas font-bold',
                      active === 1 && 'border-phino-signal bg-phino-signal-soft text-phino-signal-text ring-2 ring-phino-signal/20',
                      active < 1 && 'border-phino-border bg-phino-surface text-phino-text-subtle',
                    )}
                  >
                    {active > 1 ? <Check className="h-3 w-3" /> : '2'}
                  </span>
                  <span className={cn('font-display text-xs font-semibold', active === 1 ? 'text-phino-signal-text' : active > 1 ? 'text-phino-text' : 'text-phino-text-subtle')}>
                    GREEN_CODE
                  </span>
                  <span className="ml-auto font-mono text-xs text-phino-text-subtle">exit_code == 0</span>
                </button>
                <div className="ml-5 flex items-center gap-1.5 py-1 text-phino-text-subtle">
                  <ArrowDown className="h-3 w-3 text-phino-signal" />
                  <span className="font-mono text-xs text-phino-signal-text">enters composite REFACTOR (initial: CLEAN_CODE)</span>
                </div>
              </div>

              {/* Composite Parent State: REFACTOR */}
              <div
                className={cn(
                  'rounded-lg border p-3 transition-all',
                  isCompositeActive
                    ? 'border-phino-signal bg-phino-signal-soft/30 shadow-[0_0_0_1px_var(--phino-signal)]'
                    : 'border-phino-border-strong/70 bg-phino-surface-raised/40',
                )}
              >
                <div className="flex items-center justify-between gap-2 border-b border-phino-border/60 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className={cn('h-3.5 w-3.5', isCompositeActive ? 'text-phino-signal-text' : 'text-phino-text-subtle')} />
                    <span className="font-display text-xs font-bold text-phino-text">REFACTOR</span>
                    <span className="rounded bg-phino-guard-soft px-1.5 py-0.5 font-mono text-[11px] uppercase font-semibold text-phino-guard-text">
                      composite ancestor
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-phino-text-subtle">initial: CLEAN_CODE</span>
                </div>

                <p className="mt-1.5 font-mono text-[11px] text-phino-text-subtle">
                  ⚡ on_enter: emit REFACTOR_CYCLE_STARTED
                </p>

                {/* Substates inside REFACTOR */}
                <div className="mt-2.5 space-y-1.5 pl-2 border-l border-phino-border-strong/50">
                  {/* Substate 2: CLEAN_CODE */}
                  <button
                    type="button"
                    onClick={() => { setPlaying(false); setActive(2); }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors',
                      active === 2 ? 'bg-phino-surface font-semibold shadow-sm' : 'hover:bg-phino-surface/50',
                    )}
                  >
                    <CornerDownRight className="h-3 w-3 text-phino-text-subtle" />
                    <span className={cn('font-mono text-xs', active === 2 ? 'text-phino-signal-text font-bold' : active > 2 ? 'text-phino-text' : 'text-phino-text-subtle')}>
                      CLEAN_CODE
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-phino-text-subtle">substate (depth 2)</span>
                  </button>

                  <div className="ml-4 flex items-center gap-1 text-phino-text-subtle text-[11px] font-mono py-0.5">
                    <ArrowDown className="h-2.5 w-2.5" />
                    <span>CLEANING_DONE</span>
                  </div>

                  {/* Substate 3: PERF_AUDIT */}
                  <button
                    type="button"
                    onClick={() => { setPlaying(false); setActive(3); }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors',
                      active === 3 ? 'bg-phino-surface font-semibold shadow-sm' : 'hover:bg-phino-surface/50',
                    )}
                  >
                    <CornerDownRight className="h-3 w-3 text-phino-text-subtle" />
                    <span className={cn('font-mono text-xs', active === 3 ? 'text-phino-signal-text font-bold' : active > 3 ? 'text-phino-text' : 'text-phino-text-subtle')}>
                      PERF_AUDIT
                    </span>
                    <span className="ml-auto rounded bg-phino-danger-soft px-1.5 py-0.5 text-[11px] font-mono font-medium text-phino-danger-text">
                      bubbles on error
                    </span>
                  </button>
                </div>

                {/* Ancestor Catchers Footer */}
                <div className="mt-3 border-t border-phino-border/60 pt-2 font-mono text-[11px] text-phino-text-subtle space-y-1">
                  <div className="flex items-center justify-between text-phino-guard-text">
                    <span>↑ TEST_RAN (fail)</span>
                    <span>bubbles to GREEN_CODE</span>
                  </div>
                  <div className="flex items-center justify-between text-phino-danger-text">
                    <span>↑ GLOBAL_ABORT</span>
                    <span>ancestor reset to RED_SPEC</span>
                  </div>
                  <div className="text-phino-text-subtle pt-1">
                    ⚡ on_exit: emit REFACTOR_CYCLE_CONCLUDED
                  </div>
                </div>
              </div>

              <div className="ml-5 flex items-center gap-1.5 py-1 text-phino-text-subtle">
                <ArrowDown className="h-3 w-3" />
                <span className="font-mono text-xs">AUDIT_PASSED (exits composite)</span>
              </div>

              {/* Step 4: AUDIT_VERIFY */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setPlaying(false); setActive(4); }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                    active === 4 ? 'bg-phino-surface-raised' : 'hover:bg-phino-surface-raised/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] transition-all',
                      active > 4 && 'border-phino-signal bg-phino-signal text-phino-canvas font-bold',
                      active === 4 && 'border-phino-signal bg-phino-signal-soft text-phino-signal-text ring-2 ring-phino-signal/20',
                      active < 4 && 'border-phino-border bg-phino-surface text-phino-text-subtle',
                    )}
                  >
                    {active > 4 ? <Check className="h-3 w-3" /> : '4'}
                  </span>
                  <span className={cn('font-display text-xs font-semibold', active === 4 ? 'text-phino-signal-text' : active > 4 ? 'text-phino-text' : 'text-phino-text-subtle')}>
                    AUDIT_VERIFY
                  </span>
                  <span className="ml-auto font-mono text-xs text-phino-text-subtle">all_checks === 0</span>
                </button>
                <div className="ml-5 flex items-center gap-1.5 py-1 text-phino-text-subtle">
                  <ArrowDown className="h-3 w-3" />
                  <span className="font-mono text-xs">ALL_CHECKS_PASSED</span>
                </div>
              </div>

              {/* Step 5: COMPLETED */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setPlaying(false); setActive(5); }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                    active === 5 ? 'bg-phino-surface-raised' : 'hover:bg-phino-surface-raised/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] transition-all',
                      active === 5 && 'border-phino-signal bg-phino-signal text-phino-canvas font-bold',
                      active < 5 && 'border-phino-border bg-phino-surface text-phino-text-subtle',
                    )}
                  >
                    {active === 5 ? <Check className="h-3 w-3" /> : '5'}
                  </span>
                  <span className={cn('font-display text-xs font-semibold', active === 5 ? 'text-phino-signal-text' : 'text-phino-text-subtle')}>
                    COMPLETED
                  </span>
                  <span className="ml-auto font-mono text-xs text-phino-text-subtle">terminal sink</span>
                </button>
              </div>
            </div>
          ) : (
            /* Linear Flat Rail */
            <ol className="space-y-1">
              {linearNodes.map((node, i) => {
                const status = i < active ? 'done' : i === active ? 'active' : 'todo';
                return (
                  <li key={node.name}>
                    <button
                      type="button"
                      onClick={() => { setPlaying(false); setActive(i); }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                        status === 'active' ? 'bg-phino-surface-raised' : 'hover:bg-phino-surface-raised/60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]',
                          status === 'done' && 'border-phino-signal bg-phino-signal text-phino-canvas font-bold',
                          status === 'active' && 'border-phino-signal bg-phino-signal-soft text-phino-signal-text ring-2 ring-phino-signal/20',
                          status === 'todo' && 'border-phino-border bg-phino-surface text-phino-text-subtle',
                        )}
                      >
                        {status === 'done' ? <Check className="h-3 w-3" /> : i + 1}
                      </span>
                      <span className={cn('font-display text-xs font-semibold', status === 'active' ? 'text-phino-signal-text' : status === 'done' ? 'text-phino-text' : 'text-phino-text-subtle')}>
                        {node.name}
                      </span>
                      {node.guard ? (
                        <span className="ml-auto font-mono text-xs text-phino-text-subtle">{node.guard}</span>
                      ) : null}
                    </button>
                    {i < linearNodes.length - 1 ? (
                      <div className="ml-5 flex items-center gap-1.5 py-1 text-phino-text-subtle">
                        <ArrowDown className="h-3 w-3" />
                        <span className="font-mono text-xs">{node.emits || 'SIGNAL'}</span>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Right Detail & Action Console (7 cols on lg) */}
        <div className="flex flex-col justify-between p-5 lg:col-span-7">
          <div>
            {/* Header / Breadcrumb */}
            <div className="flex flex-wrap items-center justify-between gap-2" aria-live="polite" aria-atomic="true">
              <div className="flex items-center gap-1.5 font-mono text-xs text-phino-text-subtle">
                <span>active path:</span>
                {mode === 'hsm' ? (
                  <span className="font-semibold text-phino-signal-text">
                    root / {current.path ? current.path.join(' / ') : current.name}
                  </span>
                ) : (
                  <span className="font-semibold text-phino-signal-text">root / {current.name}</span>
                )}
              </div>
              <span className="rounded border border-phino-border bg-phino-surface px-2 py-0.5 font-mono text-[11px] text-phino-text-muted">
                {mode === 'hsm'
                  ? current.depth === 2
                    ? 'depth: 2 (nested substate)'
                    : 'depth: 1 (root state)'
                  : `step ${active + 1} of ${totalSteps}`}
              </span>
            </div>

            {/* Current State Title & Summary */}
            <div className="mt-2">
              <h3 className="font-display text-xl font-bold tracking-tight text-phino-text flex items-center gap-2">
                {current.name}
                {mode === 'hsm' && current.parent ? (
                  <span className="rounded bg-phino-guard-soft px-1.5 py-0.5 font-mono text-[11px] font-medium text-phino-guard-text">
                    child of {current.parent}
                  </span>
                ) : null}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-phino-text-muted">{current.description}</p>
            </div>

            {/* Invariants & Statechart Properties */}
            <dl className="mt-4 space-y-2 border-t border-phino-border pt-3 text-xs">
              {mode === 'hsm' && current.promptTemplate ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-phino-text-subtle">scoped prompt slice</dt>
                  <dd className="font-mono text-[11px] text-phino-text">{current.promptTemplate}</dd>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <dt className="text-phino-text-subtle">guard invariant</dt>
                <dd className="font-mono text-[11px] text-phino-guard-text">
                  {current.guard || 'none (terminal / unconditional)'}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-2">
                <dt className="text-phino-text-subtle">transitions to</dt>
                <dd className="font-mono text-[11px] text-phino-state-text">
                  {current.transitionsTo || 'COMPLETED'}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-2">
                <dt className="text-phino-text-subtle">signal emitted on entry</dt>
                <dd className="inline-flex items-center gap-1 font-mono text-[11px] text-phino-event-text">
                  <span className="h-1.5 w-1.5 rounded-full bg-phino-event" />
                  {current.emits}
                </dd>
              </div>

              {mode === 'hsm' && current.canBubble ? (
                <div className="flex items-center justify-between gap-2 rounded bg-phino-guard-soft/40 px-2 py-1">
                  <dt className="font-medium text-phino-guard-text">unhandled exception handling</dt>
                  <dd className="font-mono text-[11px] text-phino-signal-text font-semibold">
                    bubbles ↑ to REFACTOR ancestor
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          {/* Interactive Action Console */}
          <div className="mt-5 rounded-lg border border-phino-border bg-phino-surface-raised p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-phino-text">
                interactive signal dispatch
              </span>
              <span className="font-mono text-[11px] text-phino-text-subtle">
                {mode === 'hsm' ? 'test transitions & bubbling' : 'deterministic stepping'}
              </span>
            </div>

            {mode === 'hsm' ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Normal forward emit */}
                  <button
                    type="button"
                    onClick={step}
                    className="inline-flex items-center gap-1.5 rounded-md bg-phino-signal px-3 py-1.5 text-xs font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
                  >
                    <Radio className="h-3 w-3" />
                    {atEnd ? 'Reset Statechart' : `Emit ${current.emits || 'ADVANCE'}`}
                  </button>

                  {/* Special Bubbling Test: only in PERF_AUDIT */}
                  {active === 3 ? (
                    <button
                      type="button"
                      onClick={handleBubbleRegression}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-500 hover:bg-amber-500/20 transition-colors"
                      title="Trigger regression in leaf substate to watch event bubble up to ancestor"
                    >
                      <Sparkles className="h-3 w-3" />
                      Simulate Regression (Watch Bubbling ↑)
                    </button>
                  ) : null}

                  {/* Global Abort in Composite Substates */}
                  {active === 2 || active === 3 ? (
                    <button
                      type="button"
                      onClick={handleGlobalAbort}
                      className="inline-flex items-center gap-1.5 rounded-md border border-phino-danger/40 bg-phino-danger-soft px-3 py-1.5 text-xs font-medium text-phino-danger-text hover:bg-phino-danger/20 transition-colors"
                      title="Ancestor transition: abort and reset without per-state wiring"
                    >
                      <AlertOctagon className="h-3 w-3" />
                      Trigger GLOBAL_ABORT
                    </button>
                  ) : null}
                </div>

                <p className="text-[11px] text-phino-text-subtle">
                  {active === 3
                    ? 'Tip: Click "Simulate Regression" to see how an unhandled test failure in PERF_AUDIT bubbles up to REFACTOR and rolls back to GREEN_CODE without crashing.'
                    : active === 2
                    ? 'Tip: You are inside the composite state REFACTOR. Substates share parent context while keeping prompt templates isolated.'
                    : active === 1
                    ? 'Tip: Passing tests will auto-mount the composite state REFACTOR and initialize substate CLEAN_CODE.'
                    : 'Tip: Stepping forward advances through deterministic guards verified against exit codes and contexts.'}
                </p>
              </div>
            ) : (
              /* Linear Mode Action */
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={step}
                  className="inline-flex items-center gap-1.5 rounded-md bg-phino-signal px-3 py-1.5 text-xs font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
                >
                  <Radio className="h-3 w-3" />
                  {atEnd ? 'Reset Run' : `Emit ${current.emits || 'SIGNAL_PASS'}`}
                </button>
                {!atEnd ? (
                  <button
                    type="button"
                    onClick={handleLinearFail}
                    className="inline-flex items-center gap-1.5 rounded-md border border-phino-danger/40 bg-phino-danger-soft px-3 py-1.5 text-xs font-medium text-phino-danger-text transition-colors hover:border-phino-danger"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    Simulate Guard Failure
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Live Immutable Event Ledger */}
      <div className="border-t border-phino-border bg-phino-surface-raised/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-phino-signal animate-pulse" />
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-phino-text-subtle">
              live append-only event ledger (.reactive/events.jsonl)
            </p>
          </div>
          <span className="font-mono text-[11px] text-phino-text-subtle">{history.length} events recorded</span>
        </div>

        <div
          className="max-h-36 overflow-y-auto rounded-lg border border-phino-border bg-phino-code-bg p-3 font-mono text-xs"
          aria-live="polite"
          aria-relevant="additions"
          aria-atomic="false"
        >
          <ol className="space-y-1.5" role="log" aria-label="Event ledger log">
            {history.slice(-7).map((item) => (
              <li key={item.seq} className="flex flex-wrap items-baseline gap-2 text-phino-code-text">
                <span className="text-white/60">#{item.seq}</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[11px] font-bold uppercase',
                    item.type === 'EVENT_BUBBLED'
                      ? 'bg-amber-500/20 text-amber-400'
                      : item.type === 'STATE_ENTRY_HOOK' || item.type === 'STATE_EXIT_HOOK'
                      ? 'bg-purple-500/20 text-purple-300'
                      : item.type === 'SKILL_INITIALIZED'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-phino-signal/20 text-phino-signal-text',
                  )}
                >
                  {item.type || 'SIGNAL'}
                </span>
                <span className="text-phino-text font-semibold">{item.signal}</span>
                <span className="text-white/70">[{item.from} → {item.to}]</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[11px] font-bold uppercase',
                    item.guard === 'pass'
                      ? 'bg-phino-event/20 text-phino-event'
                      : item.guard === 'bubbled'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-phino-danger/20 text-phino-danger',
                  )}
                >
                  {item.guard}
                </span>
                <span className="text-white/70 text-xs">— {item.note}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
