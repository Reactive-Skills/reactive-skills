import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const PATHS = [
  {
    title: 'Use a skill',
    description: 'Install a workflow someone already made, then run it from your agent or terminal.',
    command: 'npx skills add Reactive-Skills/skills --skill <name>',
    href: '/registry',
    linkLabel: 'Browse the registry',
  },
  {
    title: 'Create a skill',
    description: 'Turn a repeatable process into explicit states, evidence gates, and durable outputs.',
    install: 'npx skills add Reactive-Skills/skills --skill skill-manager',
    prompt: 'Use skill-manager to create a reactive skill named my-workflow',
    alternative: 'npx -y @reactive-skills/axi init my-workflow',
    href: '/docs/authoring',
    linkLabel: 'Read authoring guide',
  },
  {
    title: 'Connect a host',
    description: 'Select a compatible local AXI or MCP transport during startup. AXI uses shell commands, while MCP connects host tool panels.',
    command: 'npx -y @reactive-skills/axi mcp',
    href: '/docs/axi',
    linkLabel: 'Compare AXI and MCP',
  },
];

export function StartPaths() {
  return (
    <ul className="border-t border-phino-border">
      {PATHS.map((path) => (
        <li key={path.title} className="grid gap-3 border-b border-phino-border py-6 lg:grid-cols-[14rem_1fr_minmax(0,26rem)] lg:gap-8">
          <h3 className="font-display text-base font-semibold tracking-tight text-phino-text">{path.title}</h3>
          <div>
            <p className="max-w-[60ch] text-sm leading-relaxed text-phino-text-muted">{path.description}</p>
            <Link href={path.href} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-phino-signal-text underline decoration-phino-signal/40 hover:decoration-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">
              {path.linkLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
          <div className="self-start">
            {path.install && (
              <p className="mb-2 text-xs text-phino-text-muted">
                Install first: <code className="font-mono text-phino-code-text">{path.install}</code>
              </p>
            )}
            <code className="block overflow-x-auto border border-phino-border bg-phino-code-bg px-3 py-2.5 font-mono text-xs leading-relaxed text-phino-code-text">
              <span className="mr-2 text-phino-signal-text" aria-hidden="true">{path.prompt ? '>' : '$'}</span>
              {path.prompt ? `"${path.prompt}"` : path.command}
            </code>
            {path.prompt && <p className="mt-1.5 text-xs text-phino-text-muted">Ask your agent. Recommended.</p>}
            {path.alternative && (
              <p className="mt-2 text-xs text-phino-text-muted">
                Terminal alternative: <code className="font-mono text-phino-code-text">{path.alternative}</code>
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
