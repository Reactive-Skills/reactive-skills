'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-phino-border">
      <div className="phino-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="phino-radial pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="container relative py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-phino-border bg-phino-surface-raised px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-phino-signal" aria-hidden="true" />
            <span className="font-mono text-xs tracking-wide text-phino-text-muted">event-driven agent runtime</span>
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-phino-text sm:text-5xl md:text-6xl">
            Agent work becomes
            <span className="text-phino-signal-text"> observable, stateful, and recoverable</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-phino-text-muted">
            Replace brittle prompt documents with deterministic state machines. Bounded prompt slices, typed signals, verifiable guards, and an immutable event ledger — driven natively via the token-efficient AXI CLI.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <CommandBlock command="npx -y @reactive-skills/axi" caption="zero-install axi cli (preferred)" />
          </div>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/docs/quickstart"
              className="inline-flex items-center gap-1.5 rounded-md bg-phino-text px-5 py-2.5 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-canvas"
            >
              Open the quickstart <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/registry"
              className="inline-flex items-center gap-1.5 rounded-md border border-phino-border-strong bg-phino-surface-raised px-5 py-2.5 text-sm font-medium text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              Explore Registry
            </Link>
            <Link
              href="/docs/concepts"
              className="inline-flex items-center gap-1.5 rounded-md border border-phino-border-strong bg-phino-surface-raised px-5 py-2.5 text-sm font-medium text-phino-text-muted transition-colors hover:border-phino-signal hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              How it works
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
