import { cn } from '@/lib/utils';

/**
 * Site mark (a framed signal dot with a pulsing trace) and the wordmark.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static markup rendered at build time; no client work beyond a CSS animation)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=50%
 * - CRAP Score: target <=6
 */
export function Logo({ className, showText = true }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span aria-hidden="true" className="relative inline-flex size-6 items-center justify-center">
        <span className="absolute inset-0 rounded-[7px] border border-phino-signal/60" />
        <span className="phino-signal-line phino-pulse absolute inset-x-1 top-1/2 h-px" />
        <span className="size-1.5 rounded-full bg-phino-signal" />
      </span>
      {showText ? (
        <span className="font-display text-[15px] font-semibold tracking-tight text-phino-text">Reactive Skills</span>
      ) : null}
    </span>
  );
}
