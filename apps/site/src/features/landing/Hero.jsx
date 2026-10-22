import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CopyButton } from '@/components/common/CopyButton';
import { RunTape } from './RunTape';

const INSTALL_COMMAND = 'npx skills add Reactive-Skills/skills --skill tdd-refactor';

export function Hero({ tape, skillName }) {
  return (
    <section className="border-b border-phino-border bg-phino-canvas" aria-labelledby="hero-heading">
      <div className="container py-14 sm:py-20 lg:py-24">
        <h1
          id="hero-heading"
          className="max-w-5xl font-display text-[2rem] font-extrabold leading-[1.04] tracking-[-0.04em] text-phino-text [text-wrap:balance] sm:text-5xl lg:text-[4rem]"
        >
          Your agent runs the workflow one checked step at a time.
        </h1>

        <p className="mt-6 max-w-[62ch] text-base leading-relaxed text-phino-text-muted sm:text-lg">
          Reactive Skills turns a long instruction file into a workflow your agent runs one step at a time. It sees only the current step, moves forward when a check passes, and leaves a run history you can inspect and resume.
        </p>

        <RunTape steps={tape} skillName={skillName} />

        <div className="mt-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold" aria-label="Start here">
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
          </nav>

          <div className="flex min-w-0 items-center gap-2 lg:max-w-[60%] lg:justify-end lg:text-right">
            <code className="min-w-0 font-mono text-xs text-phino-text [overflow-wrap:anywhere] sm:text-sm">
              <span className="mr-2 select-none text-phino-signal-text" aria-hidden="true">$</span>
              {INSTALL_COMMAND}
            </code>
            <CopyButton value={INSTALL_COMMAND} size="sm" ariaLabel="Copy install command" className="shrink-0" />
          </div>
        </div>
      </div>
    </section>
  );
}
