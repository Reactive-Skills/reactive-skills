import Link from 'next/link';
import { ArrowRight, Workflow } from 'lucide-react';

export function UseCases({ items }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={`/registry/${item.slug}`}
          className="group flex h-full flex-col rounded-2xl border border-phino-border bg-phino-surface p-5 transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
        >
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-phino-signal-text">{item.job}</span>
          <h3 className="mt-3 font-display text-lg font-semibold text-phino-text">{item.name}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-phino-text-muted">{item.outcome}</p>
          <div className="mt-5 flex items-center justify-between text-xs text-phino-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Workflow className="h-3.5 w-3.5 text-phino-signal" aria-hidden="true" />
              <span className="font-mono tabular-nums">{item.stateCount}</span> states
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-phino-text group-hover:text-phino-signal-text">
              View <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
