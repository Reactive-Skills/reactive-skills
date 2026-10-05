'use client';

import { useRef, useState } from 'react';
import { CopyButton } from '@/components/common/CopyButton';
import { getTabIndexForKey } from '@/lib/a11y/tabKeyboard';
import { cn } from '@/lib/utils';

const MODES = [
  { id: 'use', label: 'Use a skill', caption: 'skills.sh', command: 'npx skills add Reactive-Skills/skills --skill tdd-refactor' },
  { id: 'build', label: 'Build a skill', caption: 'zero install', command: 'npx -y @reactive-skills/axi init my-workflow' },
];

export function HeroCommandTabs() {
  const [modeId, setModeId] = useState(MODES[0].id);
  const mode = MODES.find((entry) => entry.id === modeId) ?? MODES[0];
  const tabRefs = useRef([]);

  const handleKeyDown = (event) => {
    const currentIndex = MODES.findIndex((entry) => entry.id === mode.id);
    const nextIndex = getTabIndexForKey(event.key, currentIndex, MODES.length);
    if (nextIndex === null) return;
    event.preventDefault();
    setModeId(MODES[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="max-w-2xl rounded-xl border border-phino-border bg-phino-surface p-3 sm:p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Getting started command">
          {MODES.map((entry, index) => (
            <button
              key={entry.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              id={`hero-tab-${entry.id}`}
              type="button"
              role="tab"
              aria-selected={entry.id === mode.id}
              aria-controls="hero-command-panel"
              tabIndex={entry.id === mode.id ? 0 : -1}
              onClick={() => setModeId(entry.id)}
              onKeyDown={handleKeyDown}
              className={cn(
                'rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
                entry.id === mode.id
                  ? 'border border-phino-signal/40 bg-phino-signal-soft font-semibold text-phino-signal-text'
                  : 'text-phino-text-muted hover:text-phino-text',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <span className="hidden font-mono text-[11px] uppercase tracking-wider text-phino-text-subtle sm:inline">{mode.caption}</span>
      </div>
      <div
        id="hero-command-panel"
        role="tabpanel"
        aria-labelledby={`hero-tab-${mode.id}`}
        className="flex flex-col gap-2 rounded-lg border border-phino-border-strong bg-phino-code-bg px-3.5 py-2.5 xl:flex-row xl:items-center xl:justify-between xl:gap-3"
      >
        <code className="min-w-0 font-mono text-xs text-phino-code-text [overflow-wrap:anywhere] sm:text-sm xl:overflow-x-auto xl:whitespace-nowrap xl:[overflow-wrap:normal]">
          <span className="mr-2 select-none text-phino-signal" aria-hidden="true">$</span>
          {mode.command}
        </code>
        <CopyButton
          value={mode.command}
          size="sm"
          className="self-end border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white xl:shrink-0 xl:self-auto"
        />
      </div>
    </div>
  );
}
