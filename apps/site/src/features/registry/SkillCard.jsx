import Link from 'next/link';
import { ArrowRight, ShieldCheck, Workflow } from 'lucide-react';
import { CopyButton } from '@/components/common/CopyButton';

export function SkillCard({ skill }) {
  const installCmd = `npx skills add Reactive-Skills/skills --skill ${skill.slug}`;

  return (
    <article className="group relative flex h-full flex-col rounded-xl border border-phino-border bg-phino-surface p-5 transition-colors duration-150 hover:border-phino-border-strong hover:bg-phino-surface-raised">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate rounded-md border border-phino-border bg-phino-canvas px-2 py-0.5 text-xs font-medium text-phino-text-muted">
          {skill.category}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs tabular-nums text-phino-text-muted">
          v{skill.version}
          {skill.strictExecution && (
            <ShieldCheck className="h-3.5 w-3.5 text-phino-signal-text" aria-label="Strict execution" />
          )}
        </span>
      </div>

      <h3 className="mt-3 font-display text-lg font-semibold text-phino-text transition-colors group-hover:text-phino-signal-text">
        <Link
          href={`/registry/${skill.slug}`}
          className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-surface"
        >
          <span className="absolute inset-0 rounded-xl" aria-hidden="true" />
          {skill.name}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-phino-text-muted">{skill.description}</p>

      <div className="relative z-10 mt-4 flex items-center justify-between gap-2 border-t border-phino-border pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-phino-text-muted">
          <Workflow className="h-3.5 w-3.5 text-phino-signal" aria-hidden="true" />
          <span className="font-mono font-medium tabular-nums">{skill.stateCount}</span> states
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
            className="pointer-events-none inline-flex select-none items-center gap-1 text-xs font-semibold text-phino-text transition-colors group-hover:text-phino-signal-text"
            aria-hidden="true"
          >
            Details <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
