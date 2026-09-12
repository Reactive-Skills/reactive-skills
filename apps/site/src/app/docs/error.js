'use client';

import { ErrorState } from '@/components/common/States';

export default function DocsError({ reset }) {
  return (
    <div className="max-w-2xl">
      <ErrorState
        title="This documentation page could not load"
        description="The content source failed to return this page. Retry, or use the navigation to open another page."
        onRetry={reset}
        retryLabel="Reload page"
      />
    </div>
  );
}
