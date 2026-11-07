import Link from 'next/link';
import { Layers, ArrowRight, ArrowLeft } from 'lucide-react';

/**
 * Series position for a post, with links to the previous and next parts.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=6
 */
export function SeriesBanner({ series }) {
  if (!series) return null;

  return (
    <div className="mt-8 rounded-lg border border-phino-border bg-phino-surface px-5 py-4">
      <div className="flex items-start gap-2 font-mono text-[11px] uppercase leading-5 tracking-[0.14em] text-phino-signal-text">
        <Layers className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          Series: {series.title} <span className="text-phino-text-subtle" aria-hidden="true">·</span>{' '}
          <span className="whitespace-nowrap">Part {series.part} of {series.total}</span>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        {series.prevSlug ? (
          <Link
            href={`/blog/${series.prevSlug}`}
            className="inline-flex items-center gap-1.5 text-phino-signal-text transition-colors hover:text-phino-text"
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
            className="inline-flex items-center gap-1.5 text-phino-signal-text transition-colors hover:text-phino-text"
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
