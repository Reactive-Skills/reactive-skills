import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { DocsBreadcrumb } from './DocsBreadcrumb';
import { DocSections } from './DocPageView';

const MODEL = ['skill', 'state', 'signal', 'guard', 'event', 'deliverable'];

export function DocsOverview({ page, pages }) {
  return (
    <div>
      <DocsBreadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Docs' }]} />

      <p className="font-mono text-xs uppercase tracking-[0.2em] text-phino-signal-text">{page.category}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-phino-text sm:text-4xl">{page.title}</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-phino-text-muted">{page.summary}</p>

      <div className="mt-6 flex flex-wrap items-center gap-1.5" aria-label="Mental model">
        {MODEL.map((word, i) => (
          <span key={word} className="flex items-center gap-1.5">
            <span className="rounded-md border border-phino-border bg-phino-surface px-2.5 py-1 font-mono text-xs text-phino-text">{word}</span>
            {i < MODEL.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-phino-text-subtle" aria-hidden="true" /> : null}
          </span>
        ))}
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {pages.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="group rounded-xl border border-phino-border bg-phino-surface p-5 transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-phino-text-subtle">{p.category}</span>
              <ArrowRight className="h-4 w-4 text-phino-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-phino-signal-text" aria-hidden="true" />
            </div>
            <h2 className="mt-3 font-display text-lg font-semibold text-phino-text">{p.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-phino-text-muted">{p.summary}</p>
          </Link>
        ))}
      </div>

      <div className="mt-14 max-w-2xl">
        <DocSections sections={page.sections} />
      </div>
    </div>
  );
}
