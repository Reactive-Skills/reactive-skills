import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';
import { CREATE_SKILL_PROMPT, USE_SKILL_PROMPT } from '@/lib/skillPrompts';

const PATHS = [
  {
    n: '01',
    title: 'Use a skill',
    body: 'Install a published skill, then ask your agent to use it.',
    install: 'npx skills add Reactive-Skills/skills --skill tdd-refactor',
    prompt: USE_SKILL_PROMPT,
    href: '/registry',
    linkLabel: 'Browse the registry',
  },
  {
    n: '02',
    title: 'Create a skill with your agent',
    body: 'Ask your agent to create a skill with skill-manager. It asks about missing requirements first.',
    install: 'npx skills add Reactive-Skills/skills --skill skill-manager',
    prompt: CREATE_SKILL_PROMPT,
    href: '/docs/quickstart#create-a-skill',
    linkLabel: 'Open the create guide',
  },
];

/**
 * Two entry paths, each with installation, a copyable agent prompt and a next link.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(n) in the n = 2 paths
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=4
 */
export function StartPaths() {
  // Subgrid rows align the prompts, installation lines and links across the two columns.
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:grid-rows-[repeat(6,auto)]">
      {PATHS.map((path) => (
        <div key={path.n} className="flex min-w-0 flex-col border-t border-phino-border-strong pt-6 lg:row-span-6 lg:grid lg:grid-rows-subgrid lg:gap-y-0">
          <span className="font-mono text-xs text-phino-text-subtle">{path.n}</span>
          <h3 className="mt-6 font-display text-3xl text-phino-text">{path.title}</h3>
          <p className="mt-4 text-sm leading-7 text-phino-text-muted">{path.body}</p>
          <CommandBlock className="mt-6" command={path.prompt} caption="Ask your agent" prompt wrap />
          <p className="mt-3 text-xs leading-5 text-phino-text-muted">
            Install: <code className="mt-1 block font-mono text-phino-text [overflow-wrap:anywhere]">{path.install}</code>
          </p>
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
