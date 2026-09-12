'use client';

import { Fragment } from 'react';
import { cn } from '@/lib/utils';

const KIND = {
  input: { dot: 'bg-phino-text-subtle', text: 'text-phino-text' },
  signal: { dot: 'bg-phino-signal', text: 'text-phino-signal-text' },
  guard: { dot: 'bg-phino-guard', text: 'text-phino-guard-text' },
  state: { dot: 'bg-phino-state', text: 'text-phino-state-text' },
  event: { dot: 'bg-phino-event', text: 'text-phino-event-text' },
  deliverable: { dot: 'bg-phino-signal', text: 'text-phino-signal-text' },
};

function FlowNode({ step, index }) {
  const cfg = KIND[step.kind] || KIND.input;
  return (
    <div className="w-full rounded-lg border border-phino-border bg-phino-surface p-4 lg:flex-1">
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', cfg.dot)} aria-hidden="true" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-phino-text-subtle">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <p className={cn('mt-2 font-display text-sm font-semibold', cfg.text)}>{step.label}</p>
      <p className="mt-1 text-xs leading-relaxed text-phino-text-muted">{step.description}</p>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex items-center justify-center py-1 lg:flex-1 lg:py-0" aria-hidden="true">
      <div className="phino-signal-line animate-signal-flow h-6 w-px lg:h-px lg:w-full" />
    </div>
  );
}

export function EventFlowDiagram({ flow }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch">
      {flow.map((step, i) => (
        <Fragment key={step.id}>
          <FlowNode step={step} index={i} />
          {i < flow.length - 1 ? <Connector /> : null}
        </Fragment>
      ))}
    </div>
  );
}
