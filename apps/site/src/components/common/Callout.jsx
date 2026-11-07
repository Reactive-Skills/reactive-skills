import { Info, Radio, ShieldCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  info: { wrap: 'border-phino-state/45 bg-phino-state-soft', icon: Info, iconClass: 'text-phino-state-text' },
  signal: { wrap: 'border-phino-signal/45 bg-phino-signal-soft', icon: Radio, iconClass: 'text-phino-signal-text' },
  warn: { wrap: 'border-phino-guard/45 bg-phino-guard-soft', icon: ShieldCheck, iconClass: 'text-phino-guard-text' },
  danger: { wrap: 'border-phino-danger/45 bg-phino-danger-soft', icon: TriangleAlert, iconClass: 'text-phino-danger-text' },
};

/**
 * Tone note (info, signal, guard warning, fault) with an icon, optional title and body.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=4
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=8
 */
export function Callout({ variant = 'info', title, text, children }) {
  const cfg = VARIANTS[variant] || VARIANTS.info;
  const Icon = cfg.icon;
  return (
    <div className={cn('my-5 flex gap-3 rounded-lg border px-3.5 py-3', cfg.wrap)} role="note">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cfg.iconClass)} aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className="font-display text-sm font-semibold text-phino-text">{title}</p> : null}
        {text ? <p className={cn('text-sm leading-relaxed text-phino-text', title && 'mt-0.5')}>{text}</p> : null}
        {children}
      </div>
    </div>
  );
}
