import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { CopyButton } from '@/components/common/CopyButton';

/**
 * One registry entry as a cell of the catalog grid; the whole cell links to the skill page.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; the only client work is the copy button)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=4
 */
export function SkillCard({ skill }) {
  const installCmd = `npx skills add Reactive-Skills/skills --skill ${skill.slug}`;

  return (
    <article className="group relative flex h-full flex-col p-6 transition-colors duration-150 hover:bg-phino-surface">
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase text-phino-text-subtle">
        <span className="truncate">{skill.category}</span>
        <span className="flex shrink-0 items-center gap-1.5 normal-case tabular-nums">
          v{skill.version}
          {skill.strictExecution && (
            <ShieldCheck className="h-3.5 w-3.5 text-phino-signal-text" aria-label="Strict execution" />
          )}
        </span>
      </div>

      <h3 className="mt-4 font-display text-xl font-medium text-phino-text transition-colors group-hover:text-phino-signal-text">
        <Link
          href={`/registry/${skill.slug}`}
          className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-canvas"
        >
          <span className="absolute inset-0" aria-hidden="true" />
          {skill.name}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-phino-text-muted">{skill.description}</p>

      <div className="relative z-10 mt-6 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-phino-text-muted">
          <span className="tabular-nums text-phino-text">{skill.stateCount}</span> states
        </span>
        <div className="flex items-center gap-3">
          <CopyButton
            value={installCmd}
            label="Install"
            ariaLabel={`Copy install command for ${skill.name}`}
            size="sm"
            className="h-7 px-2 text-xs"
          />
          <span
            className="pointer-events-none inline-flex select-none items-center gap-1 text-xs font-medium text-phino-text transition-colors group-hover:text-phino-signal-text"
            aria-hidden="true"
          >
            Details <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
