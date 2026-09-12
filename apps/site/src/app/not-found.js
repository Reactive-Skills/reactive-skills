import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-phino-border bg-phino-surface text-phino-signal-text">
        <Compass className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-6 font-mono text-sm text-phino-text-subtle">404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-phino-text">This route has no state</h1>
      <p className="mt-3 max-w-md text-phino-text-muted">The page you were looking for does not exist. Try the documentation overview to find your way.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="rounded-md border border-phino-border-strong bg-phino-surface-raised px-4 py-2 text-sm font-medium text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">Home</Link>
        <Link href="/docs" className="rounded-md bg-phino-text px-4 py-2 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">Documentation</Link>
      </div>
    </div>
  );
}
