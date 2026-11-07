'use client';

import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { CopyButton } from './CopyButton';

/**
 * A shell command with its copy button. `wrap` breaks long commands between arguments instead of
 * scrolling them, for narrow columns; the copy button always copies the full command.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; the only client work is the copy button)
 * - Complexity: O(n) in the n characters of the command
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=6
 */
export function CommandBlock({ command, caption = 'zero-install', wrap = false, className }) {
  return (
    <div
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-phino-border-strong bg-phino-code-bg text-phino-code-text',
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
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <code
          className={cn(
            'min-w-0 font-mono text-sm text-phino-code-text [overflow-wrap:anywhere]',
            wrap ? 'leading-6' : 'sm:overflow-x-auto sm:whitespace-nowrap sm:text-base sm:[overflow-wrap:normal]',
          )}
        >
          <span className="mr-2 select-none text-phino-signal" aria-hidden="true">$</span>
          {wrap
            ? // Break between arguments first; split one only when it alone is wider than the column.
              command.split(' ').map((part, index) => (
                <Fragment key={index}>
                  {index > 0 && ' '}
                  <span className="inline-block max-w-full [overflow-wrap:anywhere]">{part}</span>
                </Fragment>
              ))
            : command}
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
