import { Info, Radio, AlertTriangle, OctagonAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  info: { wrap: 'bg-phino-state-soft border-l-2 border-l-phino-state', icon: Info, iconClass: 'text-phino-state-text' },
  signal: { wrap: 'bg-phino-signal-soft border-l-2 border-l-phino-signal', icon: Radio, iconClass: 'text-phino-signal-text' },
  warn: { wrap: 'bg-phino-guard-soft border-l-2 border-l-phino-guard', icon: AlertTriangle, iconClass: 'text-phino-guard-text' },
  danger: { wrap: 'bg-phino-danger-soft border-l-2 border-l-phino-danger', icon: OctagonAlert, iconClass: 'text-phino-danger-text' },
};

export function Callout({ variant = 'info', title, text, children }) {
  const cfg = VARIANTS[variant] || VARIANTS.info;
  const Icon = cfg.icon;
  return (
    <div className={cn('my-5 flex gap-3 rounded-md border border-phino-border px-4 py-3.5', cfg.wrap)} role="note">
      <Icon className={cn('mt-0.5 h-4.5 w-4.5 shrink-0', cfg.iconClass)} aria-hidden="true" style={{ height: '1.1rem', width: '1.1rem' }} />
      <div className="min-w-0">
        {title ? <p className="font-display text-sm font-semibold text-phino-text">{title}</p> : null}
        {text ? <p className="mt-0.5 text-sm leading-relaxed text-phino-text-muted">{text}</p> : null}
        {children}
      </div>
    </div>
  );
}
