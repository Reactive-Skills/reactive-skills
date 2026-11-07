import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { DocSections } from './DocPageView';

const MODEL = ['skill', 'state', 'signal', 'guard', 'event', 'deliverable'];

/**
 * Docs index: eyebrow, title, the mental model, a numbered list of every docs page, then the overview sections.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(n) in the n docs pages
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=6
 */
export function DocsOverview({ page, pages }) {
  return (
    <div>
      {page.category ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-phino-signal-text">{page.category}</p>
      ) : null}
      <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-phino-text sm:text-5xl">{page.title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-phino-text-muted">{page.summary}</p>

      <div className="mt-6 flex flex-wrap items-center gap-1.5" aria-label="Mental model">
        {MODEL.map((word, i) => (
          <span key={word} className="flex items-center gap-1.5">
            <span className="rounded-md border border-phino-border bg-phino-surface px-2.5 py-1 font-mono text-xs text-phino-text">{word}</span>
            {i < MODEL.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-phino-text-subtle" aria-hidden="true" /> : null}
          </span>
        ))}
      </div>

      <ol className="mt-12 max-w-3xl border-t border-phino-border">
        {pages.map((p, i) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="group flex items-start gap-5 border-b border-phino-border py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              <span className="pt-1.5 font-mono text-xs text-phino-text-subtle">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-xl text-phino-text transition-colors group-hover:text-phino-signal-text sm:text-2xl">{p.title}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-phino-text-muted">{p.summary}</p>
              </div>
              <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-phino-signal-text" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-14 max-w-2xl">
        <DocSections sections={page.sections} />
      </div>
    </div>
  );
}
