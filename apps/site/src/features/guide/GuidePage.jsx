import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, CircleHelp, FileText, Layers3, Terminal, Workflow } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';
import { GuideRunDemo } from './GuideRunDemo';

const CONTENT_LINKS = [
  { label: 'Start here', href: '#start' },
  { label: 'The core idea', href: '#core-idea' },
  { label: 'Choose a path', href: '#paths' },
  { label: 'Follow a run', href: '#run' },
  { label: 'Files and boundaries', href: '#files' },
  { label: 'Next steps', href: '#next' },
];

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
    description: 'Use AXI when your agent has shell access. Add MCP when a GUI client needs the bridge.',
    command: 'npx -y @reactive-skills/axi mcp',
    href: '/docs/axi',
    linkLabel: 'Compare AXI and MCP',
    icon: Terminal,
  },
];

const FILES = [
  ['skill.yaml', 'The workflow contract', 'States, signals, guards, and allowed tools.'],
  ['states/*.md', 'The active instructions', 'One focused prompt slice per state.'],
  ['guards/', 'The evidence checks', 'Code-backed conditions that decide progress.'],
  ['.reactive/', 'The run history', 'Events, state, and projected deliverables.'],
];

const PRINCIPLES = [
  { label: 'Current step', text: 'Agents receive the instructions needed now, not the entire playbook.' },
  { label: 'Evidence to advance', text: 'Signals move the workflow only when declared facts satisfy the guard.' },
  { label: 'Durable history', text: 'Each transition leaves a record that can be inspected and resumed.' },
];

function GuideEyebrow({ children }) {
  return (
    <p className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-phino-signal-text">
      <span className="h-px w-6 bg-phino-signal" aria-hidden="true" />
      {children}
    </p>
  );
}

function GuideSection({ id, eyebrow, title, description, children, className = '' }) {
  return (
    <section id={id} className={`scroll-mt-24 border-b border-phino-border py-14 sm:py-20 ${className}`}>
      <GuideEyebrow>{eyebrow}</GuideEyebrow>
      <h2 className="font-display text-2xl font-semibold tracking-tight text-phino-text sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 max-w-2xl text-base leading-relaxed text-phino-text-muted">{description}</p> : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

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

function FileContract() {
  return (
    <div className="overflow-hidden rounded-2xl border border-phino-border bg-phino-surface">
      <div className="hidden grid-cols-[1.1fr_1fr_1.6fr] gap-4 border-b border-phino-border bg-phino-surface-raised px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-phino-text-subtle sm:grid">
        <span>File</span>
        <span>Role</span>
        <span>What it contains</span>
      </div>
      {FILES.map(([file, role, description]) => (
        <div key={file} className="grid gap-2 border-b border-phino-border px-5 py-4 last:border-b-0 sm:grid-cols-[1.1fr_1fr_1.6fr] sm:gap-4">
          <code className="font-mono text-sm font-semibold text-phino-signal-text">{file}</code>
          <span className="text-sm font-medium text-phino-text">{role}</span>
          <span className="text-sm leading-relaxed text-phino-text-muted">{description}</span>
        </div>
      ))}
    </div>
  );
}

export function GuidePage() {
  return (
    <div>
      <section id="start" className="relative overflow-hidden border-b border-phino-border bg-phino-canvas">
        <div className="phino-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="phino-radial pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="container relative py-14 sm:py-20 lg:py-24">
          <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] lg:gap-16">
            <div>
              <GuideEyebrow>Guide for adopting Reactive Skills</GuideEyebrow>
              <h1 className="max-w-4xl font-display text-4xl font-bold leading-[1.06] tracking-tight text-phino-text sm:text-5xl lg:text-6xl">
                Give coding agents a workflow they can follow, verify, and resume.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-phino-text-muted">
                Reactive Skills turns a long instruction file into an executable workflow. Agents see the current step, advance on evidence, and leave a durable run history.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="#paths" className="inline-flex items-center gap-2 rounded-lg bg-phino-text px-4 py-2.5 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-canvas">
                  Choose a path <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/docs/quickstart" className="inline-flex items-center gap-2 rounded-lg border border-phino-border-strong bg-phino-surface px-4 py-2.5 text-sm font-semibold text-phino-text transition-colors hover:border-phino-signal hover:text-phino-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">
                  Open quickstart
                </Link>
              </div>
              <div className="mt-9 max-w-xl">
                <CommandBlock command="npx -y @reactive-skills/axi init my-workflow" caption="create your first workflow" />
              </div>
            </div>

            <aside className="rounded-2xl border border-phino-border-strong bg-phino-surface/90 p-5 shadow-sm backdrop-blur sm:p-6" aria-label="Guide contents">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-sm font-semibold text-phino-text">One guide, one path</p>
                <FileText className="h-4 w-4 text-phino-signal" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-phino-text-muted">Start with the outcome. Keep runtime details available when you need them.</p>
              <nav className="mt-5 border-t border-phino-border pt-3" aria-label="On this page">
                <ul className="space-y-1">
                  {CONTENT_LINKS.map((link) => (
                    <li key={link.href}>
                      <a href={link.href} className="group flex items-center justify-between rounded-md px-2 py-2 text-sm text-phino-text-muted transition-colors hover:bg-phino-surface-raised hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">
                        {link.label}
                        <ChevronRight className="h-3.5 w-3.5 text-phino-text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          </div>
        </div>
      </section>

      <div className="container">
        <GuideSection
          id="core-idea"
          eyebrow="The core idea"
          title="Replace self-policing with a small, explicit runtime contract."
          description="You do not need to understand every implementation detail to adopt the model. Start with these three properties."
        >
          <div className="grid gap-3 md:grid-cols-3">
            {PRINCIPLES.map((principle, index) => (
              <article key={principle.label} className="rounded-2xl border border-phino-border bg-phino-surface p-5 sm:p-6">
                <span className="font-mono text-xs font-semibold tracking-[0.2em] text-phino-signal-text">0{index + 1}</span>
                <h3 className="mt-5 font-display text-lg font-semibold text-phino-text">{principle.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-phino-text-muted">{principle.text}</p>
              </article>
            ))}
          </div>
        </GuideSection>

        <GuideSection
          id="paths"
          eyebrow="Choose your path"
          title="Three ways to start."
          description="You can use an existing skill, author one for your team, or connect the runtime to your preferred agent host."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {PATHS.map((path) => <PathCard key={path.number} path={path} />)}
          </div>
        </GuideSection>

        <GuideSection
          id="run"
          eyebrow="Follow one run"
          title="The useful part appears when something fails."
          description="A passing demo proves little. A rejected guard shows that the workflow can stop, preserve state, and continue from evidence."
        >
          <GuideRunDemo />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['01', 'Mount', 'The agent receives only VERIFY instructions.'],
              ['02', 'Reject', 'A failed check blocks progress and preserves state.'],
              ['03', 'Resume', 'A passing result advances the workflow and records why.'],
            ].map(([number, title, text]) => (
              <div key={number} className="rounded-xl border border-phino-border bg-phino-surface p-4">
                <span className="font-mono text-xs font-semibold text-phino-signal-text">{number}</span>
                <p className="mt-3 font-display text-sm font-semibold text-phino-text">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-phino-text-muted">{text}</p>
              </div>
            ))}
          </div>
        </GuideSection>

        <GuideSection
          id="files"
          eyebrow="The working contract"
          title="A small set of files carries the workflow."
          description="Each file has one job. You can inspect the structure directly, or let an agent help author and validate it."
        >
          <FileContract />
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.85fr]">
            <div>
              <h3 className="font-display text-lg font-semibold text-phino-text">A useful authoring sequence</h3>
              <ol className="mt-4 space-y-4">
                {[
                  ['Name the workflow', 'Define one repeatable outcome and the context it needs.'],
                  ['Name the states', 'Break the work into focused phases with explicit stop criteria.'],
                  ['Name the evidence', 'Attach signals and guards that decide whether progress is valid.'],
                  ['Validate the contract', 'Inspect the statechart before asking an agent to run it.'],
                ].map(([title, text], index) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-phino-border bg-phino-surface-raised font-mono text-xs text-phino-text">{index + 1}</span>
                    <div>
                      <p className="font-display text-sm font-semibold text-phino-text">{title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-phino-text-muted">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-phino-border bg-phino-surface p-5 sm:p-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-phino-signal-text">Start authoring</p>
              <p className="mt-3 text-sm leading-relaxed text-phino-text-muted">The scaffold gives you a working runtime contract. Customization gives it your domain workflow.</p>
              <Link href="/docs/authoring" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-phino-signal-text hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">
                See the package anatomy <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </GuideSection>

        <GuideSection
          id="boundaries"
          eyebrow="Know the boundaries"
          title="Use the runtime where state and evidence matter."
          description="Reactive Skills is not required for every prompt. It earns its place when a workflow spans multiple steps, tools, or sessions."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {[
              'It does not make a model correct. It makes progress explicit and inspectable.',
              'It does not replace tests, reviews, or human decisions.',
              'It does not require a state machine for a one-off question or short script.',
              'It does not hide failed guards. Rejections remain visible in the run history.',
            ].map((text) => (
              <div key={text} className="flex gap-3 rounded-xl border border-phino-border bg-phino-surface p-4">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-phino-signal" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-phino-text-muted">{text}</p>
              </div>
            ))}
          </div>
        </GuideSection>

        <GuideSection id="next" eyebrow="Next steps" title="Choose your next move." className="border-b-0">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { href: '/docs/quickstart', title: 'Run the quickstart', text: 'Scaffold, inspect, and advance a skill.' },
              { href: '/docs/concepts', title: 'Learn the concepts', text: 'Understand states, signals, guards, and events.' },
              { href: '/registry', title: 'Browse the registry', text: 'Start with a published skill.' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="group rounded-2xl border border-phino-border bg-phino-surface p-5 transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">
                <div className="flex items-center justify-between gap-3">
                  <CircleHelp className="h-4 w-4 text-phino-signal" aria-hidden="true" />
                  <ArrowRight className="h-4 w-4 text-phino-text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-phino-text">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-phino-text-muted">{item.text}</p>
              </Link>
            ))}
          </div>
        </GuideSection>
      </div>
    </div>
  );
}
