'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';
import { cn } from '@/lib/utils';

const FILTERS = ['all', 'exit code', 'payload guard', 'signal only'];

/**
 * Registry list with a check-kind filter and a detail panel for the hovered or focused workflow.
 * Every row links to its generated registry page, so the full list stays in the static HTML.
 *
 * # Performance & Risk Budget
 * - Tier: P2 (client interaction; one filter pass per render)
 * - Complexity: O(n) in the n published workflows
 * - Cyclomatic Complexity (CC): target <=6
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=12
 */
export function RegistrySection({ rows }) {
  const [filter, setFilter] = useState('all');
  const [activeSlug, setActiveSlug] = useState(rows[0]?.slug);
  const visible = filter === 'all' ? rows : rows.filter((row) => row.kind === filter);
  const current = rows.find((row) => row.slug === activeSlug) ?? rows[0];

  return (
    <>
      <div className="mt-12 flex flex-wrap gap-2" role="group" aria-label="Filter by kind of check">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className="rounded-full border border-phino-border px-4 py-1.5 font-mono text-[11px] uppercase text-phino-text-muted transition-colors hover:text-phino-text aria-pressed:border-phino-signal aria-pressed:bg-phino-signal aria-pressed:text-phino-signal-on"
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        <ul className="border-t border-phino-border">
          {visible.map((row) => (
            <li key={row.slug}>
              <Link
                href={`/registry/${row.slug}`}
                onMouseEnter={() => setActiveSlug(row.slug)}
                onFocus={() => setActiveSlug(row.slug)}
                className={cn(
                  'grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-phino-border py-4 transition-colors hover:text-phino-signal-text sm:grid-cols-[1fr_120px_80px_70px]',
                  row.slug === current?.slug ? 'text-phino-signal-text' : 'text-phino-text',
                )}
              >
                <span className="min-w-0 font-display text-xl [overflow-wrap:anywhere]">{row.name}</span>
                <span className="hidden font-mono text-[11px] text-phino-text-subtle sm:block">{row.kind}</span>
                <span className="hidden text-right font-mono text-xs text-phino-text-muted sm:block">{row.stateCount} states</span>
                <span className="text-right font-mono text-xs text-phino-text-subtle">v{row.version}</span>
              </Link>
            </li>
          ))}
        </ul>

        {current && (
          <aside className="lg:sticky lg:top-28 lg:self-start" aria-label="Selected workflow">
            <div className="phino-panel rounded-lg p-6">
              <p className="font-mono text-[11px] uppercase text-phino-text-subtle">{current.category}</p>
              <h3 className="mt-3 font-display text-3xl text-phino-text">{current.name}</h3>
              <p className="mt-4 text-sm leading-7 text-phino-text-muted">{current.note}</p>
              <dl className="mt-6 grid grid-cols-3 border-y border-phino-border py-4 font-mono text-xs">
                <div>
                  <dt className="text-phino-text-subtle">STATES</dt>
                  <dd className="mt-1 text-lg text-phino-text">{current.stateCount}</dd>
                </div>
                <div>
                  <dt className="text-phino-text-subtle">CHECKS</dt>
                  <dd className="mt-1 text-lg text-phino-text">{current.guardCount}</dd>
                </div>
                <div>
                  <dt className="text-phino-text-subtle">GATE</dt>
                  <dd className="mt-1 text-phino-text">{current.kind}</dd>
                </div>
              </dl>
              <CommandBlock
                className="mt-6"
                command={`npx skills add Reactive-Skills/skills --skill ${current.slug}`}
                caption="install this workflow"
              />
              <Link
                href={`/registry/${current.slug}`}
                className="mt-5 inline-flex items-center gap-1.5 text-sm text-phino-signal-text underline decoration-phino-signal/40 hover:decoration-phino-signal"
              >
                View in registry <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
