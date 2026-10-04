import { cn } from '@/lib/utils';
import { formatStepShare } from '@/lib/registry/registryStats';

export function HeroStats({ stats }) {
  const items = [
    stats.medianStepShare !== null && {
      value: formatStepShare(stats.medianStepShare),
      label: "of a skill's instructions delivered at each step",
      tone: 'text-phino-signal-text',
    },
    {
      value: String(stats.stateCount),
      label: `explicit states across ${stats.skillCount} published workflows`,
      tone: 'text-phino-state-text',
    },
    {
      value: 'Every',
      label: 'transition and failed check lands in a replayable run history',
      tone: 'text-phino-guard-text',
    },
  ].filter(Boolean);

  return (
    <figure className="max-w-2xl pt-2">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.label} className="rounded-lg border border-phino-border bg-phino-surface-raised/80 p-3">
            <p className={cn('font-display text-2xl font-bold tracking-tight', item.tone)}>{item.value}</p>
            <p className="mt-0.5 text-xs font-medium leading-snug text-phino-text-subtle">{item.label}</p>
          </li>
        ))}
      </ul>
      {stats.medianStepShare !== null && (
        <figcaption className="mt-2 text-[11px] leading-relaxed text-phino-text-subtle">
          Median across {stats.measuredSkillCount} registry skills: one state file versus SKILL.md plus every state file, measured in bytes at build time. SKILL.md loads once when the skill starts, and earlier steps stay in the conversation.
        </figcaption>
      )}
    </figure>
  );
}
