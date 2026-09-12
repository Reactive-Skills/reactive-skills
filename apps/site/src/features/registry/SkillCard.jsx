import Link from 'next/link';
import { ArrowRight, ShieldCheck, Workflow, Wrench, Package, Star } from 'lucide-react';
import { CopyButton } from '@/components/common/CopyButton';
import { cn } from '@/lib/utils';

export function SkillCard({ skill }) {
  const installCmd = skill.skillsShInstallCmd || `npx skills add Reactive-Skills/skills --skill ${skill.slug}`;

  return (
    <div
      className={cn(
        'group relative flex h-[340px] flex-col justify-between rounded-xl border p-5 transition-colors duration-150',
        skill.featured
          ? 'border-phino-signal/50 bg-gradient-to-b from-phino-surface via-phino-surface to-phino-surface-raised ring-1 ring-phino-signal/25 hover:border-phino-signal hover:bg-phino-surface-raised'
          : 'border-phino-border bg-phino-surface hover:border-phino-border-strong hover:bg-phino-surface-raised',
      )}
    >
      <div className="flex flex-1 flex-col">
        {/* Top badges: category & version & priority */}
        <div className="flex h-6 items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="truncate rounded-md border border-phino-border bg-phino-canvas px-2 py-0.5 text-xs font-medium text-phino-text-muted">
              {skill.category}
            </span>
            {skill.featured && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-phino-signal/15 px-1.5 py-0.5 text-[11px] font-semibold text-phino-signal-text border border-phino-signal/30">
                <Star className="h-2.5 w-2.5 fill-phino-signal text-phino-signal" aria-hidden="true" />
                {skill.priorityBadge || 'Priority'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs text-phino-text-muted shrink-0 tabular-nums">
            <span>v{skill.version}</span>
            {skill.strictExecution && (
              <span
                title="Strict execution: auto-aborts if runtime invariants are violated"
                className="inline-flex items-center gap-0.5 text-phino-signal-text"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            )}
          </div>
        </div>

        {/* Title: fixed height with truncate */}
        <h3 className="mt-3 h-7 font-display text-lg font-semibold text-phino-text group-hover:text-phino-signal-text transition-colors truncate">
          <Link
            href={`/registry/${skill.slug}`}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-surface rounded-md"
          >
            <span className="absolute inset-0 rounded-xl" aria-hidden="true" />
            {skill.name}
          </Link>
        </h3>

        {/* Description: fixed height so shorter descriptions don't shift height */}
        <p className="mt-2 h-[4.25rem] text-sm leading-relaxed text-phino-text-muted line-clamp-3 overflow-hidden">
          {skill.description}
        </p>

        {/* Stats & Tools info: pinned above footer */}
        <div className="mt-auto flex h-8 items-center gap-2 border-t border-phino-border/60 pt-2">
          <span className="inline-flex items-center gap-1 rounded bg-phino-canvas px-2 py-0.5 text-xs text-phino-text-muted border border-phino-border">
            <Workflow className="h-3 w-3 text-phino-signal" aria-hidden="true" />
            <span className="font-mono tabular-nums font-medium">{skill.stateCount}</span> states
          </span>
          {skill.tools && skill.tools.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-phino-canvas px-2 py-0.5 text-xs text-phino-text-muted border border-phino-border">
              <Wrench className="h-3 w-3 text-phino-signal" aria-hidden="true" />
              <span className="font-mono tabular-nums font-medium">{skill.tools.length}</span> tools
            </span>
          )}
        </div>
      </div>

      {/* Footer: Quick Command + Arrow */}
      <div className="relative z-10 mt-4 flex flex-col gap-2 border-t border-phino-border pt-3">
        {/* Package Add Snippet */}
        <div className="flex h-8 items-center justify-between gap-1.5 overflow-hidden rounded-md border border-phino-border bg-phino-canvas px-2.5 py-1 text-xs">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Package className="h-3 w-3 text-phino-signal shrink-0" aria-hidden="true" />
            <span className="truncate font-mono text-phino-text-muted text-[11px]">
              npx skills add Reactive-Skills/skills --skill {skill.slug}
            </span>
          </div>
          <CopyButton
            value={installCmd}
            label="Copy"
            size="sm"
            className="relative z-20 h-6 px-1.5 text-[10px] border-none bg-transparent hover:bg-phino-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          />
        </div>

        <div className="flex h-5 items-center justify-between">
          <span className="truncate font-mono text-[11px] text-phino-text-muted max-w-[190px]">
            or: <code className="text-phino-text font-semibold">axi invoke {skill.slug}</code>
          </span>

          <span
            className="inline-flex items-center gap-1 text-xs font-semibold text-phino-text transition-colors group-hover:text-phino-signal-text shrink-0 select-none pointer-events-none"
            aria-hidden="true"
          >
            Details <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}
