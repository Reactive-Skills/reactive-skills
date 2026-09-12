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
          <li>Prose the model reads and hopefully follows.</li>
          <li>No memory of the current step.</li>
          <li>No record of what happened.</li>
          <li>No clean way to recover.</li>
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
          <li>Runs as a Hierarchical State Machine.</li>
          <li>Knows exactly which state it is in.</li>
          <li>Appends an immutable event per change.</li>
          <li>Recovers from the last good state.</li>
        </ul>
      </div>
    </div>
  );
}
