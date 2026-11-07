import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';

/**
 * Closing call to action: install every official skill, then open the quickstart or the registry.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=1
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=2
 */
export function QuickstartCta() {
  return (
    <div className="mt-5 flex flex-col justify-between gap-8 md:flex-row md:items-end">
      <div className="min-w-0">
        <h2 id="cta-heading" className="section-title font-display text-phino-text">
          Make your skills
          <br />
          reactive.
        </h2>
        <CommandBlock className="mt-8 max-w-lg" command="npx skills add Reactive-Skills/skills" caption="install every official skill" />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Link
          href="/docs/quickstart"
          className="inline-flex h-14 items-center gap-2 rounded-sm bg-phino-signal px-8 text-sm font-medium text-phino-signal-on transition-opacity hover:opacity-90"
        >
          Open the quickstart <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/registry"
          className="text-sm text-phino-text underline decoration-phino-border-strong hover:decoration-phino-text"
        >
          Browse workflows
        </Link>
      </div>
    </div>
  );
}
