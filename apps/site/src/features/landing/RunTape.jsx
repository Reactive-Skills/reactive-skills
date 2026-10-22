'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { clampProgress } from '@/lib/motion/useScrollProgress';
import { cn } from '@/lib/utils';

// Static frame (and the reduced-motion frame): the playhead rests inside the second state.
const REST_AT = 0.3;
const END_AT = 0.94;

function useHeroScroll() {
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const measure = () => {
      frame = 0;
      setProgress(reduce.matches ? null : clampProgress(window.scrollY / (window.innerHeight * 0.55)));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    reduce.addEventListener('change', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      reduce.removeEventListener('change', schedule);
    };
  }, []);
  return progress;
}

function clock(seconds) {
  return `14:02:${String(seconds).padStart(2, '0')}`;
}

function eventsInto(steps, active) {
  if (active === 0) return [{ at: clock(14), type: 'STATE_VISITED', detail: steps[0].name }];
  const from = steps[active - 1];
  const base = 14 + active * 4;
  return [
    { at: clock(base + 2), type: 'STATE_TRANSITION', detail: `${from.name} -> ${steps[active].name}` },
    { at: clock(base + 1), type: 'GUARD_EVALUATED', detail: `${from.check}, pass` },
    { at: clock(base), type: 'SIGNAL_EMITTED', detail: from.signal },
  ];
}

export function RunTape({ steps, skillName }) {
  const progress = useHeroScroll();
  const playhead = REST_AT + (progress ?? 0) * (END_AT - REST_AT);
  const share = 1 / steps.length;
  const active = Math.min(steps.length - 1, Math.floor(playhead / share));
  const events = eventsInto(steps, active);

  return (
    <figure className="mt-12 [font-variant-ligatures:none] sm:mt-14">
      <div className="relative border-y border-phino-border py-5 sm:pb-12 sm:pt-8">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-3 opacity-70 sm:block"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg, var(--phino-border) 0 1px, transparent 1px 16px)' }}
          aria-hidden="true"
        />
        <ol className="relative grid gap-4 sm:grid-cols-5 sm:gap-0" aria-label={`Example run of ${skillName}`}>
          {steps.map((step, index) => {
            const status = index < active ? 'done' : index === active ? 'now' : 'next';
            return (
              <li
                key={step.name}
                aria-current={status === 'now' ? 'step' : undefined}
                className={cn(
                  'relative min-w-0 border-l pl-4 sm:pl-3 sm:pr-2',
                  status === 'done' && 'border-phino-signal',
                  status === 'now' && 'border-phino-guard',
                  status === 'next' && 'border-phino-border-strong',
                )}
              >
                <p
                  className={cn(
                    'flex items-center gap-1.5 font-display text-[13px] font-semibold tracking-tight [overflow-wrap:anywhere]',
                    status === 'done' && 'text-phino-signal-text',
                    status === 'now' && 'text-phino-guard-text',
                    status === 'next' && 'text-phino-text',
                  )}
                >
                  {step.name}
                  {status === 'done' && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  {status === 'now' && <span className="h-2 w-2 shrink-0 bg-phino-guard" aria-hidden="true" />}
                  <span className="sr-only">{status === 'done' ? ', passed' : status === 'now' ? ', running' : ', waiting'}</span>
                </p>
                <p className="mt-1.5 font-mono text-xs text-phino-text-subtle [overflow-wrap:anywhere]">
                  {step.check}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="pointer-events-none absolute inset-x-0 bottom-5 hidden h-1.5 sm:block" aria-hidden="true">
          <div className="absolute inset-y-0 left-0 bg-phino-signal" style={{ width: `${active * share * 100}%` }} />
          <div
            className="absolute inset-y-0"
            style={{
              left: `${active * share * 100}%`,
              width: `${Math.max(0, playhead - active * share) * 100}%`,
              backgroundImage: 'repeating-linear-gradient(90deg, var(--phino-guard) 0 6px, transparent 6px 10px)',
            }}
          />
        </div>
        <div
          className="pointer-events-none absolute -bottom-1.5 -top-1.5 hidden w-0.5 bg-phino-guard transition-[left] sm:block"
          style={{ left: `${playhead * 100}%`, transitionDuration: 'var(--phino-duration-deliberate)', transitionTimingFunction: 'var(--phino-ease-move)' }}
          aria-hidden="true"
        >
          <span className="absolute -top-0.5 left-2 whitespace-nowrap font-mono text-xs text-phino-guard-text">playhead</span>
        </div>
      </div>
      <figcaption className="mt-4 flex flex-col gap-1 font-mono text-xs leading-relaxed text-phino-text-muted sm:flex-row sm:flex-wrap sm:gap-x-5">
        {events.map((event) => (
          <span key={event.type} className="[overflow-wrap:anywhere]">
            <span className="text-phino-signal-text">{event.at}</span> {event.type} {event.detail}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
