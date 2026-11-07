'use client';

import { ErrorState } from '@/components/common/States';

export default function Error({ reset }) {
  return (
    <div className="container py-16 lg:py-28">
      <div className="mx-auto max-w-2xl">
        <ErrorState
          title="This page hit an unexpected error"
          description="The page failed to render. You can retry, or head back to the documentation overview."
          onRetry={reset}
          retryLabel="Try again"
        />
      </div>
    </div>
  );
}
