'use client';

import { cn } from '@/lib/utils';
import { CopyButton } from './CopyButton';

export function CodeBlock({ example, className }) {
  const { language = 'bash', command = '', explanation, expectedOutput } = example || {};
  return (
    <figure className={cn('my-5 overflow-hidden rounded-lg border border-phino-border-strong bg-phino-code-bg text-phino-code-text', className)}>
      <div className="flex items-center justify-between border-b border-white/5 px-3.5 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">{language}</span>
        <CopyButton value={command} size="sm" className="border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white" />
      </div>
      <pre className="overflow-x-auto px-4 py-3.5">
        <code className="whitespace-pre font-mono text-[13px] leading-relaxed text-phino-code-text">{command}</code>
      </pre>
      {expectedOutput ? (
        <div className="border-t border-white/5 bg-black/25 px-4 py-3">
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">Output</div>
          <pre className="overflow-x-auto">
            <code className="whitespace-pre font-mono text-[12.5px] leading-relaxed text-white/70">{expectedOutput}</code>
          </pre>
        </div>
      ) : null}
      {explanation ? (
        <figcaption className="border-t border-phino-border bg-phino-surface px-4 py-2.5 text-sm text-phino-text-muted">{explanation}</figcaption>
      ) : null}
    </figure>
  );
}
