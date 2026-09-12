import { Crosshair, ShieldCheck, History } from 'lucide-react';

const AREAS = [
  {
    icon: Crosshair,
    title: 'Focused execution',
    text: 'Each state receives only its prompt slice, so the agent works on one job at a time instead of holding the whole skill in context.',
  },
  {
    icon: ShieldCheck,
    title: 'Deterministic progress',
    text: 'Guards gate every transition. The same inputs always produce the same decision, so a run is reproducible and explainable.',
  },
  {
    icon: History,
    title: 'Event-sourced recovery',
    text: 'Every change is an immutable event. Replay any run exactly, and recover from the last good state instead of starting over.',
  },
];

export function ValueAreas() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {AREAS.map((a) => {
        const Icon = a.icon;
        return (
          <div key={a.title} className="rounded-xl border border-phino-border bg-phino-surface p-5 transition-colors hover:border-phino-border-strong">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-phino-border bg-phino-signal-soft text-phino-signal-text">
              <Icon className="h-4.5 w-4.5" style={{ height: '1.15rem', width: '1.15rem' }} aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold text-phino-text">{a.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-phino-text-muted">{a.text}</p>
          </div>
        );
      })}
    </div>
  );
}
