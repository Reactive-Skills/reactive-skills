import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

const POPULAR_SKILLS = [
  { slug: 'jsm-workflow', name: 'JSM Workflow', badge: 'Flagship / SDLC' },
  { slug: 'skill-manager', name: 'Skill Manager', badge: 'Essential / Authoring' },
  { slug: 'tdd-refactor', name: 'TDD Refactor', badge: 'Testing & Quality' },
];

const secondary =
  'inline-flex h-11 items-center rounded-sm border border-phino-border-strong px-5 text-sm text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus';

/**
 * Site 404: the unmapped-state message, links home, to the registry and docs, and three suggested skills.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(1) (three suggested skills)
 * - Cyclomatic Complexity (CC): target <=1
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=2
 */
export default function NotFound() {
  return (
    <div className="container py-16 lg:py-28">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-end lg:gap-16">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-phino-signal-text">404 &bull; Unmapped State</p>
          <p className="mt-6 font-display text-[clamp(88px,16vw,180px)] font-medium leading-none tracking-[-0.04em] text-phino-text" aria-hidden="true">
            404<span className="text-phino-signal">.</span>
          </p>
          <h1 className="mt-6 font-display text-3xl font-medium tracking-tight text-phino-text sm:text-4xl">This route has no state</h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-phino-text-muted">
            The requested path does not exist in the statechart. Route to an active state, explore documentation, or jump directly into a verified skill.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/docs"
              className="inline-flex h-11 items-center gap-2 rounded-sm bg-phino-signal px-5 text-sm font-medium text-phino-signal-on transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              Documentation <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/registry" className={secondary}>
              Skill Registry
            </Link>
            <Link href="/" className={secondary}>
              Home
            </Link>
          </div>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-phino-text-subtle">Recommended Transitions</p>
          <ul className="mt-4 border-t border-phino-border">
            {POPULAR_SKILLS.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/registry/${s.slug}`}
                  className="group flex items-center justify-between gap-4 border-b border-phino-border py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-lg text-phino-text transition-colors group-hover:text-phino-signal-text">{s.name}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-phino-text-subtle">{s.badge}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-phino-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-phino-signal-text" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
