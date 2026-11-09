import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * Closing call to action linking back to the two agent entry paths.
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
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <Link
          href="/registry"
          className="inline-flex h-14 items-center gap-2 rounded-sm bg-phino-signal px-8 text-sm font-medium text-phino-signal-on transition-opacity hover:opacity-90"
        >
          Use a skill <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/docs/quickstart#create-a-skill"
          className="text-sm text-phino-text underline decoration-phino-border-strong hover:decoration-phino-text"
        >
          Create a skill with your agent
        </Link>
      </div>
    </div>
  );
}
