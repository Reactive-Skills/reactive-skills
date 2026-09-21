import Link from 'next/link';
import { Layers, ArrowRight, ArrowLeft } from 'lucide-react';

export function SeriesBanner({ series }) {
  if (!series) return null;

  return (
    <div className="my-6 rounded-lg border border-phino-border-strong bg-phino-surface-raised p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-phino-signal-text">
        <Layers className="h-4 w-4" aria-hidden="true" />
        <span>Series: {series.title}</span>
        <span className="text-phino-text-subtle">·</span>
        <span>Part {series.part} of {series.total}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        {series.prevSlug ? (
          <Link
            href={`/blog/${series.prevSlug}`}
            className="inline-flex items-center gap-1.5 font-medium text-phino-signal-text hover:text-phino-text transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Previous Part</span>
          </Link>
        ) : (
          <span className="text-xs text-phino-text-subtle font-mono">Series Inception</span>
        )}

        {series.nextSlug ? (
          <Link
            href={`/blog/${series.nextSlug}`}
            className="inline-flex items-center gap-1.5 font-medium text-phino-signal-text hover:text-phino-text transition-colors"
          >
            <span>Next: Part {series.part + 1}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className="text-xs text-phino-text-subtle font-mono">Series Finale</span>
        )}
      </div>
    </div>
  );
}
