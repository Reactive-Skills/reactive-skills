import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';

export function QuickstartCta() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-phino-border-strong bg-phino-surface p-8 sm:p-10">
      <div className="phino-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative mx-auto max-w-2xl text-center">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-phino-text sm:text-3xl">Run your first reactive skill</h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-phino-text-muted">
          Scaffold, inspect, and advance a skill in seconds through local-first AXI or MCP selection. AXI uses no background daemon, and MCP is available through a single flag.
        </p>
        <div className="mx-auto mt-6 max-w-xl text-left">
          <CommandBlock command="npx -y @reactive-skills/axi init my-feature-flow" caption="zero-install AXI launcher" />
        </div>
        <Link
          href="/docs/quickstart"
          className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-phino-text px-5 py-2.5 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-canvas"
        >
          Open the quickstart <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
