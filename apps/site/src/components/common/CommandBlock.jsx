'use client';

import { cn } from '@/lib/utils';
import { CopyButton } from './CopyButton';

export function CommandBlock({ command, caption = 'zero-install', className }) {
  return (
    <div
      className={cn(
        'group overflow-hidden rounded-xl border border-phino-border-strong bg-phino-code-bg text-phino-code-text',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">{caption}</span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <code className="min-w-0 overflow-x-auto whitespace-nowrap font-mono text-sm text-phino-code-text sm:text-base">
          <span className="mr-2 select-none text-phino-signal" aria-hidden="true">$</span>
          {command}
        </code>
        <CopyButton
          value={command}
          label="Copy"
          className="shrink-0 border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"
        />
      </div>
    </div>
  );
}
