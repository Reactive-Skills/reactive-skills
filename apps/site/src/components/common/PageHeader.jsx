import { cn } from '@/lib/utils';

/**
 * Page opening shared by the secondary pages: mono eyebrow, display title and lead, matching the docs index.
 * The title stays a single text node so pages can match it against their metadata title.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=6
 */
export function PageHeader({ eyebrow, title, children, className }) {
  return (
    <div className={cn('max-w-3xl', className)}>
      {eyebrow ? <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-phino-signal-text">{eyebrow}</p> : null}
      <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-phino-text [text-wrap:balance] sm:text-5xl">{title}</h1>
      {children ? <div className="mt-5 max-w-2xl text-lg leading-relaxed text-phino-text-muted">{children}</div> : null}
    </div>
  );
}
