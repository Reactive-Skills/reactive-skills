import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HeroCommandTabs } from './HeroCommandTabs';
import { HeroStats } from './HeroStats';
import { RuntimeWorkbench } from './RuntimeWorkbench';

export function Hero({ stats }) {
  return (
    <section className="relative overflow-hidden border-b border-phino-border bg-phino-canvas">
      <div className="phino-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="phino-radial pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="container relative py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8 xl:gap-12">
          <div className="min-w-0 space-y-6 lg:col-span-6 xl:col-span-7">
            <p className="inline-flex items-center gap-2.5 rounded-full border border-phino-signal/30 bg-phino-signal-soft/60 px-3.5 py-1 font-mono text-xs text-phino-signal-text">
              <span className="h-2 w-2 rounded-full bg-phino-signal" aria-hidden="true" />
              <span className="font-semibold uppercase tracking-wider">Workflows for coding agents</span>
            </p>

            <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-phino-text sm:text-5xl xl:text-6xl">
              Stop hoping your agent followed the playbook.{' '}
              <span className="bg-gradient-to-r from-phino-signal-text via-teal-600 to-emerald-600 bg-clip-text text-transparent dark:via-teal-300 dark:to-emerald-300">
                Make each step pass a check.
              </span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-phino-text-muted sm:text-lg">
              Reactive Skills turns a long instruction file into a workflow your agent runs one step at a time. It sees only the current step, moves forward when a check passes, and leaves a run history you can inspect and resume.
            </p>

            <HeroCommandTabs />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/registry"
                className="inline-flex items-center gap-2 rounded-lg bg-phino-text px-5 py-2.5 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
              >
                Browse workflows <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/docs/quickstart"
                className="inline-flex items-center gap-1.5 rounded-lg border border-phino-border-strong bg-phino-surface-raised px-5 py-2.5 text-sm font-medium text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
              >
                Read the quickstart
              </Link>
            </div>

            <HeroStats stats={stats} />
          </div>

          <div className="min-w-0 lg:col-span-6 xl:col-span-5">
            <RuntimeWorkbench />
          </div>
        </div>
      </div>
    </section>
  );
}
