import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function RelatedPages({ pages }) {
  if (!pages || pages.length === 0) return null;
  return (
    <div className="mt-12 max-w-2xl border-t border-phino-border pt-8">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-phino-text-subtle">Keep reading</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {pages.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="group flex items-center justify-between gap-3 rounded-lg border border-phino-border bg-phino-surface px-4 py-3 transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            <span className="text-sm font-medium text-phino-text">{p.title}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-phino-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-phino-signal-text" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
