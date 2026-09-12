import { FileText, ArrowRight } from 'lucide-react';

export function SkillComparison() {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
      <div className="rounded-xl border border-phino-border bg-phino-surface p-5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-phino-text-subtle" aria-hidden="true" />
          <span className="font-mono text-xs text-phino-text-subtle">SKILL.md</span>
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold text-phino-text">A passive skill</h3>
        <ul className="mt-3 space-y-2 text-sm text-phino-text-muted">
          <li>Entire instruction manual dumped into context at once.</li>
          <li>Unrecorded internal state; model guesses next actions.</li>
          <li>Subjective completion claims without verifiable gates.</li>
          <li>Failures restart from scratch or cascade into hallucinations.</li>
        </ul>
      </div>

      <div className="flex items-center justify-center" aria-hidden="true">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-phino-signal bg-phino-signal-soft text-phino-signal-text">
          <ArrowRight className="h-4 w-4 md:rotate-0 rotate-90" />
        </span>
      </div>

      <div className="rounded-xl border border-phino-signal bg-phino-signal-soft p-5" style={{ borderColor: 'var(--phino-signal)' }}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-phino-signal" aria-hidden="true" />
          <span className="font-mono text-xs text-phino-signal-text">reactive skill</span>
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold text-phino-text">A reactive skill</h3>
        <ul className="mt-3 space-y-2 text-sm text-phino-text-muted">
          <li>Scoped prompt slice for only the active state.</li>
          <li>Explicit state path verified through deterministic guards.</li>
          <li>Immutable event store (JSONL + SQLite) for replay and audit.</li>
          <li>Deterministic recovery to the last verified checkpoint.</li>
        </ul>
      </div>
    </div>
  );
}
