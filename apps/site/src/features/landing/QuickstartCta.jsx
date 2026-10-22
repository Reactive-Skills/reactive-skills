import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';

export function QuickstartCta() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,32rem)] lg:items-end">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-phino-text sm:text-3xl">Try a published workflow</h2>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-phino-text-muted">
          Install the official skills, then invoke one by name in your agent. It starts in its first state and tells the agent what to do next.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold">
          <Link
            href="/registry"
            className="inline-flex items-center gap-1.5 text-phino-signal-text underline decoration-phino-signal/40 hover:decoration-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            Browse workflows <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/docs/quickstart"
            className="text-phino-text underline decoration-phino-border-strong hover:decoration-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            Read the quickstart
          </Link>
        </div>
      </div>
      <CommandBlock command="npx skills add Reactive-Skills/skills" caption="install every skill" />
    </div>
  );
}
