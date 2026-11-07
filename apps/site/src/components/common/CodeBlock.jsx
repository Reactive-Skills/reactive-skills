import { cn } from '@/lib/utils';
import { CopyButton } from './CopyButton';

/**
 * Docs code example: language bar with copy, a `$` prompt on shell lines, optional expected output and caption.
 * The prompt is decoration only; the copy button always copies the raw command.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; the copy button is the only client island)
 * - Complexity: O(l) in the l command lines
 * - Cyclomatic Complexity (CC): target <=4
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=8
 */
export function CodeBlock({ example, className }) {
  const { language = 'bash', command = '', explanation, expectedOutput } = example || {};
  const prompted = language === 'bash';
  return (
    <figure className={cn('my-5 overflow-hidden rounded-lg border border-phino-border bg-phino-surface-sunken', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-phino-border bg-phino-surface-raised px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-phino-text-subtle">{language}</span>
        <CopyButton value={command} size="sm" ariaLabel={`Copy ${language} example`} />
      </div>
      <pre className="overflow-x-auto px-4 py-3.5">
        <code className="whitespace-pre font-mono text-[13px] leading-relaxed text-phino-text">
          {prompted
            ? command.split('\n').map((line, i) => (
                <span key={i} className="block">
                  <span className="select-none text-phino-signal-text" aria-hidden="true">$ </span>
                  {line}
                </span>
              ))
            : command}
        </code>
      </pre>
      {expectedOutput ? (
        <div className="border-t border-phino-border bg-phino-surface">
          <pre className="overflow-x-auto px-4 py-3">
            <code className="whitespace-pre font-mono text-[12.5px] leading-relaxed text-phino-text-muted">
              <span className="sr-only">Expected output: </span>
              {expectedOutput}
            </code>
          </pre>
        </div>
      ) : null}
      {explanation ? (
        <figcaption className="border-t border-phino-border px-4 py-2.5 text-[13px] leading-relaxed text-phino-text-muted">{explanation}</figcaption>
      ) : null}
    </figure>
  );
}
