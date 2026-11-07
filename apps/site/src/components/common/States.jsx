'use client';

import { Inbox, RefreshCw, TriangleAlert } from 'lucide-react';

/*
 * Loading, empty and error placeholders shared by the site.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(n) in the n skeleton lines (LoadingState), otherwise O(1)
 * - Cyclomatic Complexity (CC): target <=2 each
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=4 each
 */

export function LoadingState({ label = 'Loading', lines = 4 }) {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="h-3 w-24 rounded-sm bg-phino-surface-raised" />
      <div className="h-10 w-2/3 rounded-sm bg-phino-surface-raised" />
      <div className="h-4 w-full rounded-sm bg-phino-surface-raised" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded-sm bg-phino-surface-raised" style={{ width: `${90 - i * 8}%` }} />
      ))}
      <div className="h-28 w-full rounded-sm bg-phino-surface-raised" />
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', description = 'This section has no content to show.' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-phino-border-strong bg-phino-surface px-6 py-14 text-center">
      <Inbox className="h-7 w-7 text-phino-text-subtle" aria-hidden="true" />
      <p className="mt-4 font-display text-lg font-medium text-phino-text">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-phino-text-muted">{description}</p>
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description = 'This content could not be loaded.', onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-phino-danger/40 bg-phino-danger-soft px-6 py-14 text-center" role="alert">
      <TriangleAlert className="h-7 w-7 text-phino-danger-text" aria-hidden="true" />
      <p className="mt-4 font-display text-lg font-medium text-phino-text">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-phino-text-muted">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-sm border border-phino-border-strong bg-phino-surface px-4 text-sm text-phino-text transition-colors hover:border-phino-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
