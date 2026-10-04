import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';

export function QuickstartCta() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-phino-border-strong bg-phino-surface p-8 sm:p-10">
      <div className="phino-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative mx-auto max-w-2xl text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-phino-text sm:text-3xl">Try a published workflow</h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-phino-text-muted">
          Install the official skills, then invoke one by name in your agent. It starts in its first state and tells the agent what to do next.
        </p>
        <div className="mx-auto mt-6 max-w-xl text-left">
          <CommandBlock command="npx skills add Reactive-Skills/skills" caption="install every skill" />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/registry"
            className="inline-flex items-center gap-1.5 rounded-md bg-phino-text px-5 py-2.5 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-canvas"
          >
            Browse workflows <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/docs/quickstart"
            className="inline-flex items-center gap-1.5 rounded-md border border-phino-border-strong bg-phino-surface-raised px-5 py-2.5 text-sm font-medium text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            Read the quickstart
          </Link>
        </div>
      </div>
    </div>
  );
}
