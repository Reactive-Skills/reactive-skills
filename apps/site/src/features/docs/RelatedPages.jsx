import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * "Next" links at the foot of a docs page.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(n) in the n related pages
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=4
 */
export function RelatedPages({ pages }) {
  if (!pages || pages.length === 0) return null;
  return (
    <nav aria-label="Next" className="mt-14 max-w-2xl border-t border-phino-border pt-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-phino-text-subtle">Next</p>
      <ul className="mt-3 flex flex-wrap gap-3">
        {pages.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="inline-flex items-center gap-2 rounded-md border border-phino-border bg-phino-surface px-3 py-2 text-sm text-phino-text transition-colors hover:border-phino-signal hover:text-phino-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              {p.title}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
