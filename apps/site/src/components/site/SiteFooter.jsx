import Link from 'next/link';
import { Logo } from './Logo';

function GithubIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-phino-border bg-phino-canvas">
      <div className="container flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-phino-text-muted">
            An event-driven runtime that turns passive agent skills into reactive, observable state machines.
          </p>
          <a
            href="https://github.com/Reactive-Skills/reactive-skills"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-phino-border-strong bg-phino-surface-raised px-3 py-1.5 text-sm font-medium text-phino-text transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            <GithubIcon className="h-3.5 w-3.5" aria-hidden="true" />
            GitHub repository
          </a>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
          <Link href="/docs/quickstart" className="text-phino-text-muted transition-colors hover:text-phino-text">Quickstart</Link>
          <Link href="/docs/concepts" className="text-phino-text-muted transition-colors hover:text-phino-text">Concepts</Link>
          <Link href="/docs/axi" className="text-phino-text-muted transition-colors hover:text-phino-text">AXI</Link>
          <Link href="/docs/mcp" className="text-phino-text-muted transition-colors hover:text-phino-text">MCP</Link>
          <Link href="/docs/troubleshooting" className="text-phino-text-muted transition-colors hover:text-phino-text">Troubleshooting</Link>
          <Link href="/docs/changelog" className="text-phino-text-muted transition-colors hover:text-phino-text">Changelog</Link>
        </nav>
      </div>
      <div className="border-t border-phino-border">
        <div className="container py-4">
          <p className="font-mono text-xs text-phino-text-subtle">skill → state → signal → guard → event → deliverable</p>
        </div>
      </div>
    </footer>
  );
}
