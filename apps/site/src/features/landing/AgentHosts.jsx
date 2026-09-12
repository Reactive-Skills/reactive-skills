import Link from 'next/link';
import { Terminal, Plug, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const HOSTS = [
  {
    icon: Terminal,
    tag: 'AXI',
    badge: 'Preferred for agents',
    preferred: true,
    title: 'Agent Experience Interface (AXI)',
    text: 'Direct CLI execution designed specifically for autonomous agents. TOON-encoded output (~40% fewer tokens than JSON), deterministic exit codes, and inline recovery actions on every turn — with zero daemon overhead.',
    href: '/docs/axi',
    cta: 'Explore the AXI contract',
  },
  {
    icon: Plug,
    tag: 'MCP',
    badge: 'Host bridge',
    preferred: false,
    title: 'Model Context Protocol (MCP)',
    text: 'Stdio tool server for GUI IDE panels like Cursor, Claude Desktop, and VS Code. Exposes state inspection, signal dispatch, and projections over JSON-RPC when direct shell execution is unavailable.',
    href: '/docs/mcp',
    cta: 'Configure MCP server',
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
            className={cn(
              'group relative rounded-xl border p-6 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
              h.preferred
                ? 'border-phino-signal bg-phino-signal-soft/30 shadow-sm hover:border-phino-signal hover:bg-phino-signal-soft/40 ring-1 ring-phino-signal/30'
                : 'border-phino-border bg-phino-surface hover:border-phino-border-strong hover:bg-phino-surface-raised',
            )}
          >
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-md border text-phino-text',
                    h.preferred
                      ? 'border-phino-signal bg-phino-surface text-phino-signal-text'
                      : 'border-phino-border bg-phino-surface-raised',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-phino-signal-text font-bold">
                  {h.tag}
                </span>
              </div>
              {h.preferred ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-phino-signal px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-phino-canvas">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                  {h.badge}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-phino-border bg-phino-surface-raised px-2.5 py-0.5 font-mono text-[10px] text-phino-text-muted">
                  {h.badge}
                </span>
              )}
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
