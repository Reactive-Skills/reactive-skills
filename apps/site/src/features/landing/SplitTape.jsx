'use client';

import { useRef } from 'react';
import { useScrollProgress } from '@/lib/motion/useScrollProgress';

const PASSIVE = [
  'Entire instruction manual dumped into context at once.',
  'Unrecorded internal state; model guesses next actions.',
  'Subjective completion claims without verifiable gates.',
  'Failures restart from scratch or cascade into hallucinations.',
];

const REACTIVE = [
  'Scoped prompt slice for only the active state.',
  'Explicit state path with a declared check on every transition.',
  'Immutable event store (JSONL + SQLite) for replay and audit.',
  'Resume from the last recorded state instead of starting over.',
];

function Points({ title, file, items }) {
  return (
    <div>
      <h3 className="font-display text-base font-semibold tracking-tight text-phino-text">
        {title} <span className="ml-1 font-mono text-xs font-normal text-phino-text-subtle">{file}</span>
      </h3>
      <ul className="mt-3 divide-y divide-phino-border border-y border-phino-border">
        {items.map((item) => (
          <li key={item} className="py-2.5 text-sm leading-relaxed text-phino-text-muted">{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function SplitTape({ states }) {
  const ref = useRef(null);
  const measured = useScrollProgress(ref, { start: 0.85, distance: 0.45 });
  // Reduced motion (null) shows the finished split.
  const split = measured ?? 1;
  // The file label fades out before the state labels fade in, so the two never overlap.
  const labelOpacity = Math.max(0, split * 2 - 1);

  return (
    <div>
      <div ref={ref} className="relative" role="img" aria-label={`One SKILL.md file splitting into ${states.length} states: ${states.join(', ')}`}>
        <div className="flex flex-col sm:flex-row" style={{ gap: `${split * 10}px` }}>
          {states.map((name) => (
            <div
              key={name}
              className="flex h-10 min-w-0 items-center border-l-2 sm:flex-1 bg-phino-surface-raised px-3 sm:h-14"
              style={{ borderLeftColor: `color-mix(in srgb, var(--phino-signal) ${Math.round(split * 100)}%, var(--phino-surface-raised))` }}
            >
              <span className="truncate font-display text-xs font-semibold text-phino-text" style={{ opacity: labelOpacity }}>
                {name}
              </span>
            </div>
          ))}
        </div>
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-sm font-semibold text-phino-text-muted"
          style={{ opacity: Math.max(0, 1 - split * 2) }}
          aria-hidden="true"
        >
          SKILL.md
        </span>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-12">
        <Points title="A passive skill" file="SKILL.md" items={PASSIVE} />
        <Points title="A reactive skill" file="states/*.md" items={REACTIVE} />
      </div>
    </div>
  );
}
