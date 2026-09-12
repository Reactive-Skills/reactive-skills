'use client';

import { Inbox, RefreshCw, TriangleAlert } from 'lucide-react';

export function LoadingState({ label = 'Loading', lines = 4 }) {
  return (
    <div className="animate-pulse space-y-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="h-8 w-2/3 rounded-md bg-phino-surface-raised" />
      <div className="h-4 w-full rounded bg-phino-surface-raised" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-phino-surface-raised" style={{ width: `${90 - i * 8}%` }} />
      ))}
      <div className="h-28 w-full rounded-lg bg-phino-surface-raised" />
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', description = 'This section has no content to show.' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-phino-border-strong bg-phino-surface px-6 py-14 text-center">
      <Inbox className="h-7 w-7 text-phino-text-subtle" aria-hidden="true" />
      <p className="mt-3 font-display text-base font-semibold text-phino-text">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-phino-text-muted">{description}</p>
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description = 'This content could not be loaded.', onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-phino-border bg-phino-danger-soft px-6 py-14 text-center">
      <TriangleAlert className="h-7 w-7 text-phino-danger-text" aria-hidden="true" />
      <p className="mt-3 font-display text-base font-semibold text-phino-text">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-phino-text-muted">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-phino-border-strong bg-phino-surface-raised px-3.5 py-2 text-sm font-medium text-phino-text transition-colors hover:border-phino-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
