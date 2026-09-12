import Link from 'next/link';
import { Plug, Terminal, ArrowRight } from 'lucide-react';

const HOSTS = [
  {
    icon: Plug,
    tag: 'MCP',
    title: 'Model Context Protocol',
    text: 'Connect Reactive Skills to Cursor, Claude Desktop, VS Code, or any MCP client. Tools, resources, and structured results — no bespoke glue code.',
    href: '/docs/mcp',
    cta: 'Set up MCP',
  },
  {
    icon: Terminal,
    tag: 'AXI',
    title: 'Agent Experience Interface',
    text: 'A CLI built for programs first: compact output, stable errors, structured results, traceability, and recovery actions in every message.',
    href: '/docs/axi',
    cta: 'Read the AXI contract',
  },
];

export function AgentHosts() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {HOSTS.map((h) => {
        const Icon = h.icon;
        return (
          <Link
            key={h.tag}
            href={h.href}
            className="group rounded-xl border border-phino-border bg-phino-surface p-6 transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-phino-border bg-phino-surface-raised text-phino-text">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-phino-signal-text">{h.tag}</span>
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-phino-text">{h.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-phino-text-muted">{h.text}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-phino-signal-text">
              {h.cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
