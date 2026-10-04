import Link from 'next/link';
import { ArrowRight, Layers3, Terminal, Workflow } from 'lucide-react';

const PATHS = [
  {
    number: '01',
    title: 'Use a skill',
    description: 'Install a workflow someone already made, then run it from your agent or terminal.',
    command: 'npx skills add Reactive-Skills/skills --skill <name>',
    href: '/registry',
    linkLabel: 'Browse the registry',
    icon: Layers3,
  },
  {
    number: '02',
    title: 'Create a skill',
    description: 'Turn a repeatable process into explicit states, evidence gates, and durable outputs.',
    command: 'npx -y @reactive-skills/axi init my-workflow',
    href: '/docs/authoring',
    linkLabel: 'Read authoring guide',
    icon: Workflow,
  },
  {
    number: '03',
    title: 'Connect a host',
    description: 'Select a compatible local AXI or MCP transport during startup. AXI uses shell commands, while MCP connects host tool panels.',
    command: 'npx -y @reactive-skills/axi mcp',
    href: '/docs/axi',
    linkLabel: 'Compare AXI and MCP',
    icon: Terminal,
  },
];

function PathCard({ path }) {
  const Icon = path.icon;
  return (
    <article className="flex h-full flex-col rounded-2xl border border-phino-border bg-phino-surface p-5 transition-colors hover:border-phino-border-strong sm:p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold tracking-[0.2em] text-phino-text-subtle">{path.number}</span>
        <Icon className="h-4 w-4 text-phino-signal" aria-hidden="true" />
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-phino-text">{path.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-phino-text-muted">{path.description}</p>
      <div className="mt-5 flex-1">
        <code className="block overflow-x-auto rounded-lg border border-phino-border bg-phino-code-bg px-3 py-3 font-mono text-xs leading-relaxed text-phino-code-text">
          <span className="mr-2 text-phino-signal" aria-hidden="true">$</span>
          {path.command}
        </code>
      </div>
      <Link href={path.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-phino-signal-text hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">
        {path.linkLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </article>
  );
}

export function StartPaths() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PATHS.map((path) => <PathCard key={path.number} path={path} />)}
    </div>
  );
}
