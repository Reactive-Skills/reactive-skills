import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';

const PATHS = [
  {
    n: '01',
    title: 'Use a skill',
    body: 'Install a workflow someone already made, then run it from your agent or terminal.',
    command: 'npx skills add Reactive-Skills/skills --skill <name>',
    href: '/registry',
    linkLabel: 'Browse the registry',
  },
  {
    n: '02',
    title: 'Create a skill',
    body: 'Install skill-manager, then ask your agent: "Use skill-manager to create a reactive skill named my-workflow."',
    command: 'npx skills add Reactive-Skills/skills --skill skill-manager',
    alternative: 'npx -y @reactive-skills/axi init my-workflow',
    href: '/docs/authoring',
    linkLabel: 'Read the authoring guide',
  },
  {
    n: '03',
    title: 'Connect a host',
    body: 'AXI uses shell commands; MCP connects host tool panels. The runtime picks a compatible transport when a run starts.',
    command: 'npx -y @reactive-skills/axi setup',
    href: '/docs/axi',
    linkLabel: 'Compare AXI and MCP',
  },
];

/**
 * The three entry paths, each with its first command and the docs page that continues it.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(n) in the n = 3 paths
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=4
 */
export function StartPaths() {
  // Subgrid rows line up the shell boxes, alternatives and links across the three columns.
  return (
    <div className="mt-14 grid gap-10 lg:grid-cols-3 lg:grid-rows-[repeat(6,auto)]">
      {PATHS.map((path) => (
        <div key={path.n} className="flex min-w-0 flex-col border-t border-phino-border-strong pt-6 lg:row-span-6 lg:grid lg:grid-rows-subgrid lg:gap-y-0">
          <span className="font-mono text-xs text-phino-text-subtle">{path.n}</span>
          <h3 className="mt-6 font-display text-3xl text-phino-text">{path.title}</h3>
          <p className="mt-4 text-sm leading-7 text-phino-text-muted">{path.body}</p>
          <CommandBlock className="mt-6" command={path.command} caption="shell" wrap />
          {path.alternative ? (
            <p className="mt-3 text-xs leading-5 text-phino-text-muted">
              Terminal alternative: <code className="mt-1 block font-mono text-phino-text [overflow-wrap:anywhere]">{path.alternative}</code>
            </p>
          ) : (
            <span className="hidden lg:block" aria-hidden="true" />
          )}
          <Link
            href={path.href}
            className="mt-5 inline-flex items-center gap-1.5 self-start lg:justify-self-start text-sm text-phino-signal-text underline decoration-phino-signal/40 hover:decoration-phino-signal"
          >
            {path.linkLabel} <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ))}
    </div>
  );
}
