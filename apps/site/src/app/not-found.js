import Link from 'next/link';
import { Compass, ArrowRight, Sparkles } from 'lucide-react';

export default function NotFound() {
  const popularSkills = [
    { slug: 'jsm-workflow', name: 'JSM Workflow', badge: 'Flagship / SDLC' },
    { slug: 'skill-manager', name: 'Skill Manager', badge: 'Essential / Authoring' },
    { slug: 'tdd-refactor', name: 'TDD Refactor', badge: 'Testing & Quality' },
  ];

  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-phino-border bg-phino-surface text-phino-signal-text shadow-sm">
        <Compass className="h-7 w-7 text-phino-signal" aria-hidden="true" />
      </span>
      <p className="mt-6 font-mono text-xs font-semibold uppercase tracking-widest text-phino-signal-text">
        404 &bull; Unmapped State
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-phino-text sm:text-4xl">
        This route has no state
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-phino-text-muted sm:text-base">
        The requested path does not exist in the statechart. Route to an active state, explore documentation, or jump directly into a verified skill.
      </p>

      {/* Suggested Flagship Skills */}
      <div className="mt-8 w-full max-w-md rounded-xl border border-phino-border bg-phino-surface p-4 text-left">
        <div className="mb-3 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-phino-text-muted">
          <Sparkles className="h-3.5 w-3.5 text-phino-signal" aria-hidden="true" />
          <span>Recommended Transitions</span>
        </div>
        <div className="space-y-2">
          {popularSkills.map((s) => (
            <Link
              key={s.slug}
              href={`/registry/${s.slug}`}
              className="group flex items-center justify-between rounded-lg border border-phino-border/70 bg-phino-canvas/50 px-3 py-2 text-sm transition-colors hover:border-phino-signal hover:bg-phino-surface-raised"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-phino-text group-hover:text-phino-signal-text transition-colors">
                  {s.name}
                </span>
                <span className="rounded bg-phino-signal-soft px-1.5 py-0.5 font-mono text-[10px] font-medium text-phino-signal-text border border-phino-signal/30">
                  {s.badge}
                </span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-phino-text-muted group-hover:text-phino-signal transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-phino-border-strong bg-phino-surface-raised px-4 py-2 text-sm font-medium text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
        >
          Home
        </Link>
        <Link
          href="/registry"
          className="rounded-lg border border-phino-border-strong bg-phino-surface-raised px-4 py-2 text-sm font-medium text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
        >
          Skill Registry
        </Link>
        <Link
          href="/docs"
          className="rounded-lg bg-phino-text px-4 py-2 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
        >
          Documentation
        </Link>
      </div>
    </div>
  );
}
