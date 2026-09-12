import Link from 'next/link';
import {
  ChevronRight,
  ShieldCheck,
  Workflow,
  Wrench,
  Key,
  FileCheck,
  Terminal,
  ArrowRight,
  Code2,
  Package,
  ExternalLink,
  Star,
} from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';
import { CopyButton } from '@/components/common/CopyButton';
import { MermaidViewer } from '@/components/common/MermaidViewer';

function GithubIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function SkillDetailView({ skill }) {
  const githubSkillUrl = `https://github.com/Reactive-Skills/skills/tree/main/${skill.slug}`;
  const skillsShCmd = skill.skillsShInstallCmd || `npx skills add Reactive-Skills/skills --skill ${skill.slug}`;
  const axiRunCmd = skill.installCmd || `npx -y @reactive-skills/axi invoke ${skill.slug}`;

  const mcpConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        'reactive-skills': {
          command: 'npx',
          args: ['-y', '@reactive-skills/axi', 'mcp'],
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="container py-10 sm:py-14">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-phino-text-muted">
        <Link href="/" className="hover:text-phino-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus rounded-sm">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/registry" className="hover:text-phino-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus rounded-sm">Registry</Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-semibold text-phino-text" aria-current="page">{skill.name}</span>
      </nav>

      {/* Hero Header */}
      <div className="rounded-2xl border border-phino-border bg-phino-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-md border border-phino-border bg-phino-canvas px-2.5 py-1 text-xs font-medium text-phino-text">
              {skill.category}
            </span>
            <span className="font-mono text-xs text-phino-text-muted tabular-nums">
              v{skill.version}
            </span>
            {skill.schemaVersion && (
              <span className="font-mono text-xs text-phino-text-muted tabular-nums">
                (schema v{skill.schemaVersion})
              </span>
            )}
            {skill.strictExecution && (
              <span className="inline-flex items-center gap-1 rounded-full border border-phino-signal/30 bg-phino-signal-soft px-2.5 py-0.5 text-xs font-medium text-phino-signal-text">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Strict HSM
              </span>
            )}
            {skill.featured && (
              <span className="inline-flex items-center gap-1 rounded-full border border-phino-signal/40 bg-phino-signal/15 px-2.5 py-0.5 text-xs font-semibold text-phino-signal-text">
                <Star className="h-3.5 w-3.5 fill-phino-signal text-phino-signal" aria-hidden="true" />
                {skill.priorityBadge || 'Priority Skill'}
              </span>
            )}
          </div>

          <a
            href={githubSkillUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-phino-border bg-phino-canvas px-3 py-1 text-xs font-medium text-phino-text transition-colors hover:border-phino-signal hover:text-phino-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
          >
            <GithubIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span>View on GitHub</span>
            <ExternalLink className="h-3 w-3 text-phino-text-muted" aria-hidden="true" />
          </a>
        </div>

        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-phino-text sm:text-4xl">
          {skill.name}
        </h1>

        <p className="mt-3 max-w-3xl text-base leading-relaxed text-phino-text-muted sm:text-lg">
          {skill.description}
        </p>

        {skill.featured && skill.featuredReason && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-phino-signal/30 bg-phino-signal-soft/70 p-3.5 text-sm text-phino-text">
            <Star className="h-4 w-4 shrink-0 fill-phino-signal text-phino-signal mt-0.5" aria-hidden="true" />
            <div className="leading-relaxed">
              <span className="font-semibold text-phino-signal-text">Recommended Standard: </span>
              {skill.featuredReason}
            </div>
          </div>
        )}

        {/* Source info */}
        <div className="mt-4 flex items-center gap-2 text-xs text-phino-text-muted">
          <Package className="h-3.5 w-3.5 text-phino-signal" aria-hidden="true" />
          <span>Registry Repository: <strong className="font-mono text-phino-text">Reactive-Skills/skills</strong></span>
        </div>

        {/* Command Blocks: 1. skills.sh install, 2. AXI invoke */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-4xl">
          <CommandBlock
            command={skillsShCmd}
            caption="1. install to agent (skills.sh)"
          />
          <CommandBlock
            command={axiRunCmd}
            caption="2. zero-install run (axi cli)"
          />
        </div>
      </div>

      {/* Key Architectural Invariants Matrix */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-phino-border bg-phino-surface p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-phino-text-muted">
            <Workflow className="h-4 w-4 text-phino-signal" aria-hidden="true" />
            States
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-phino-text font-mono tabular-nums">{skill.stateCount}</p>
          <p className="mt-0.5 text-xs text-phino-text-muted">Hierarchical nodes</p>
        </div>

        <div className="rounded-xl border border-phino-border bg-phino-surface p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-phino-text-muted">
            <Key className="h-4 w-4 text-phino-signal" aria-hidden="true" />
            Initial State
          </div>
          <p className="mt-2 font-mono text-base font-bold text-phino-text truncate">{skill.initialState}</p>
          <p className="mt-0.5 text-xs text-phino-text-muted">Bootstrap entrypoint</p>
        </div>

        <div className="rounded-xl border border-phino-border bg-phino-surface p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-phino-text-muted">
            <Wrench className="h-4 w-4 text-phino-signal" aria-hidden="true" />
            Allowed Tools
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-phino-text font-mono tabular-nums">
            {skill.tools ? skill.tools.length : 0}
          </p>
          <p className="mt-0.5 text-xs text-phino-text-muted">Whitelisted for safety</p>
        </div>

        <div className="rounded-xl border border-phino-border bg-phino-surface p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-phino-text-muted">
            <FileCheck className="h-4 w-4 text-phino-signal" aria-hidden="true" />
            Deliverables
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-phino-text font-mono tabular-nums">
            {skill.deliverables ? skill.deliverables.length : 0}
          </p>
          <p className="mt-0.5 text-xs text-phino-text-muted">Automated projections</p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Left 2 Cols: States & Transitions */}
        <div className="space-y-10 lg:col-span-2">
          {/* Statechart Section */}
          {skill.mermaidChart && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-phino-signal" aria-hidden="true" />
                <h2 className="font-display text-xl font-semibold text-phino-text">
                  Statechart Diagram
                </h2>
              </div>
              <p className="text-sm text-phino-text-muted">
                Visual state machine topology parsed directly from the official <code className="text-phino-text font-mono">STATECHART.md</code> in <code className="text-phino-text font-mono">Reactive-Skills/skills</code>:
              </p>
              <MermaidViewer chart={skill.mermaidChart} title={`${skill.name} (stateDiagram-v2)`} />
            </section>
          )}

          {/* States & Invariants Breakdown */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Workflow className="h-4 w-4 text-phino-signal" aria-hidden="true" />
              <h2 className="font-display text-xl font-semibold text-phino-text">
                States & Deterministic Guards
              </h2>
            </div>
            <p className="text-sm text-phino-text-muted">
              Each state is an isolated operational slice. Transitions occur only when typed signals satisfy programmatic guard conditions.
            </p>

            <div className="space-y-4">
              {skill.states.map((state) => {
                const isInitial = state.name === skill.initialState;
                const isTerminal = !state.transitions || state.transitions.length === 0;

                return (
                  <div
                    key={state.name}
                    className="rounded-xl border border-phino-border bg-phino-surface p-5 transition-colors hover:border-phino-border-strong"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-phino-border/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-phino-text">
                          {state.name}
                        </span>
                        {isInitial && (
                          <span className="rounded bg-phino-signal-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-phino-signal-text border border-phino-signal/30">
                            INITIAL
                          </span>
                        )}
                        {isTerminal && (
                          <span className="rounded bg-phino-canvas px-2 py-0.5 font-mono text-[10px] text-phino-text-muted border border-phino-border">
                            TERMINAL
                          </span>
                        )}
                      </div>

                      {state.tools && state.tools.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {state.tools.map((t) => (
                            <span
                              key={t}
                              className="rounded bg-phino-canvas px-1.5 py-0.5 font-mono text-[10px] text-phino-text-muted border border-phino-border"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-phino-text-muted">
                      {state.description}
                    </p>

                    {state.transitions && state.transitions.length > 0 && (
                      <div className="mt-4 rounded-lg border border-phino-border/70 bg-phino-canvas/50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-phino-text-muted mb-2">
                          Outgoing Transitions
                        </p>
                        <ul className="space-y-1.5 font-mono text-xs">
                          {state.transitions.map((t, idx) => (
                            <li key={idx} className="flex flex-wrap items-center gap-2">
                              <span className="text-phino-signal font-semibold">{t.signal}</span>
                              <ArrowRight className="h-3 w-3 text-phino-text-muted shrink-0" aria-hidden="true" />
                              <span className="font-semibold text-phino-text">{t.target}</span>
                              {t.guard && (
                                <span className="rounded bg-phino-surface px-1.5 py-0.5 text-[11px] text-phino-text-muted border border-phino-border">
                                  guard: <code className="text-phino-signal-text font-semibold">{t.guard}</code>
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right 1 Col: Execution & Context Sidebar */}
        <div className="space-y-6">
          {/* CLI Invocation Card */}
          <div className="rounded-xl border border-phino-border bg-phino-surface p-5">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-phino-text">
              <Terminal className="h-4 w-4 text-phino-signal" aria-hidden="true" />
              AXI CLI Commands
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-phino-text-muted">
              Inspect or drive this state machine directly via the token-efficient AXI CLI:
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-phino-text-muted mb-1">Check state:</p>
                <div className="flex items-center justify-between rounded-md border border-phino-border bg-phino-canvas px-3 py-1.5 font-mono text-xs text-phino-text">
                  <span className="truncate">axi state {skill.slug}</span>
                  <CopyButton
                    value={`npx -y @reactive-skills/axi state ${skill.slug}`}
                    label=""
                    size="sm"
                    className="h-5 px-1.5 border-none bg-transparent hover:bg-phino-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-phino-text-muted mb-1">Inspect hierarchy:</p>
                <div className="flex items-center justify-between rounded-md border border-phino-border bg-phino-canvas px-3 py-1.5 font-mono text-xs text-phino-text">
                  <span className="truncate">axi inspect {skill.slug}</span>
                  <CopyButton
                    value={`npx -y @reactive-skills/axi inspect ${skill.slug}`}
                    label=""
                    size="sm"
                    className="h-5 px-1.5 border-none bg-transparent hover:bg-phino-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
                  />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-phino-text-muted mb-1">Tail events:</p>
                <div className="flex items-center justify-between rounded-md border border-phino-border bg-phino-canvas px-3 py-1.5 font-mono text-xs text-phino-text">
                  <span className="truncate">axi events {skill.slug}</span>
                  <CopyButton
                    value={`npx -y @reactive-skills/axi events ${skill.slug}`}
                    label=""
                    size="sm"
                    className="h-5 px-1.5 border-none bg-transparent hover:bg-phino-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Context Keys */}
          {skill.contextKeys && skill.contextKeys.length > 0 && (
            <div className="rounded-xl border border-phino-border bg-phino-surface p-5">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-phino-text">
                <Key className="h-4 w-4 text-phino-signal" aria-hidden="true" />
                Context Keys
              </h3>
              <p className="mt-2 text-xs text-phino-text-muted">
                Runtime variables persisted across state transitions:
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skill.contextKeys.map((k) => (
                  <code
                    key={k}
                    className="rounded bg-phino-canvas px-2 py-0.5 font-mono text-xs text-phino-text-muted border border-phino-border"
                  >
                    {k}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables Projections */}
          {skill.deliverables && skill.deliverables.length > 0 && (
            <div className="rounded-xl border border-phino-border bg-phino-surface p-5">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-phino-text">
                <FileCheck className="h-4 w-4 text-phino-signal" aria-hidden="true" />
                Projected Deliverables
              </h3>
              <p className="mt-2 text-xs text-phino-text-muted">
                Read models automatically rendered upon transition:
              </p>
              <ul className="mt-3 space-y-1.5">
                {skill.deliverables.map((deliv) => (
                  <li
                    key={deliv}
                    className="flex items-center gap-2 font-mono text-xs text-phino-text-muted"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-phino-signal shrink-0" aria-hidden="true" />
                    <span className="truncate">{deliv}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* MCP Integration Box */}
          <div className="rounded-xl border border-phino-border bg-phino-surface p-5">
            <h3 className="font-display text-sm font-semibold text-phino-text">
              MCP Server Configuration
            </h3>
            <p className="mt-2 text-xs text-phino-text-muted">
              Add to your Claude Desktop, Cursor, or VS Code settings:
            </p>
            <div className="mt-3 overflow-x-auto rounded-lg border border-phino-border bg-phino-canvas p-3 font-mono text-xs text-phino-text">
              <pre className="whitespace-pre">{mcpConfigSnippet}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
