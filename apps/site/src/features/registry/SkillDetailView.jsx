'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ShieldCheck, ArrowRight, Code2, ExternalLink, Star, Activity } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';
import { CREATE_SKILL_PROMPT } from '@/lib/skillPrompts';
import { MermaidViewer } from '@/components/common/MermaidViewer';
import { LiveTelemetryDeck } from '@/features/telemetry/LiveTelemetryDeck';
import { cn } from '@/lib/utils';

function GithubIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function renderTextWithLinks(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      const cleanUrl = part.replace(/[).,]+$/, '');
      const trailing = part.slice(cleanUrl.length);
      return (
        <span key={i}>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-phino-signal-text underline decoration-phino-signal/50 underline-offset-2 [overflow-wrap:anywhere] hover:decoration-phino-signal"
          >
            <span>{cleanUrl}</span>
            <ExternalLink className="h-3 w-3 inline text-phino-text-muted" aria-hidden="true" />
          </a>
          {trailing}
        </span>
      );
    }
    return part;
  });
}

/**
 * Sidebar block: mono label, optional description and content.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=3
 */
function SideBlock({ title, description, children }) {
  return (
    <div className="border-t border-phino-border pt-5">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-phino-text-subtle">{title}</h3>
      {description ? <p className="mt-2 text-sm leading-relaxed text-phino-text-muted">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

/**
 * Generated skill page: agent prompt, installation, optional statechart and state reference,
 * plus a sidebar with context keys, deliverables and documentation links.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; the statechart and live deck are client islands)
 * - Complexity: O(s + t) in the s states and t transitions of the skill
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
export function SkillDetailView({ skill }) {
  const [statechartMode, setStatechartMode] = useState('diagram'); // 'diagram' | 'live'
  const githubSkillUrl = `https://github.com/Reactive-Skills/skills/tree/main/${skill.slug}`;
  const skillsShCmd = skill.skillsShInstallCmd || `npx skills add Reactive-Skills/skills --skill ${skill.slug}`;
  const agentPrompt = skill.slug === 'skill-manager'
    ? CREATE_SKILL_PROMPT
    : `Use the ${skill.slug} skill to [describe your task].`;

  const numbers = [
    ['States', skill.stateCount, 'Hierarchical nodes'],
    ['Initial State', skill.initialState, 'Bootstrap entrypoint'],
    ['Allowed Tools', skill.tools ? skill.tools.length : 0, 'Whitelisted for safety'],
    ['Deliverables', skill.deliverables ? skill.deliverables.length : 0, 'Automated projections'],
  ];

  const toggle = 'inline-flex items-center gap-1.5 rounded px-3 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus';

  return (
    <div className="container py-10 lg:py-16">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-mono text-xs text-phino-text-muted">
        <Link href="/" className="rounded-sm transition-colors hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/registry" className="rounded-sm transition-colors hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">Registry</Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="truncate text-phino-text" aria-current="page">{skill.name}</span>
      </nav>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-end lg:gap-16">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-phino-signal-text">
            <span>{skill.category}</span>
            <span className="text-phino-text-subtle" aria-hidden="true">/</span>
            <span className="normal-case tabular-nums tracking-normal text-phino-text-muted">v{skill.version}</span>
            {skill.schemaVersion && (
              <span className="normal-case tabular-nums tracking-normal text-phino-text-muted">(schema v{skill.schemaVersion})</span>
            )}
          </div>

          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-phino-text [overflow-wrap:anywhere] sm:text-5xl">
            {skill.name}
          </h1>

          {(skill.strictExecution || skill.featured) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {skill.strictExecution && (
                <span className="inline-flex items-center gap-1 rounded-full border border-phino-signal/40 bg-phino-signal-soft px-2.5 py-0.5 text-xs text-phino-signal-text">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Strict HSM
                </span>
              )}
              {skill.featured && (
                <span className="inline-flex items-center gap-1 rounded-full border border-phino-signal/40 bg-phino-signal-soft px-2.5 py-0.5 text-xs text-phino-signal-text">
                  <Star className="h-3.5 w-3.5" aria-hidden="true" />
                  {skill.priorityBadge || 'Priority Skill'}
                </span>
              )}
            </div>
          )}

          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-phino-text-muted">
            {renderTextWithLinks(skill.description)}
          </p>

          {skill.featured && skill.featuredReason && (
            <div className="mt-5 max-w-3xl border-l-2 border-phino-signal pl-4 text-sm leading-relaxed text-phino-text">
              <span className="font-medium text-phino-signal-text">Recommended Standard: </span>
              {renderTextWithLinks(skill.featuredReason)}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-phino-text-muted">
            <span>Registry Repository: <strong className="font-mono font-normal text-phino-text">Reactive-Skills/skills</strong></span>
            {skill.slug === 'jsm-workflow' && (
              <span className="inline-flex items-center gap-1.5">
                <span>Based on:</span>
                <a
                  href="https://jsmastery.com/skills"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-phino-signal-text hover:underline"
                >
                  <span>JS Mastery Skills</span>
                  <ExternalLink className="h-3 w-3 text-phino-text-muted" aria-hidden="true" />
                </a>
              </span>
            )}
            <a
              href={githubSkillUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm text-phino-text transition-colors hover:text-phino-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              <GithubIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View on GitHub</span>
              <ExternalLink className="h-3 w-3 text-phino-text-muted" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <CommandBlock command={agentPrompt} caption="Ask your agent" prompt wrap />
          <p className="text-xs leading-5 text-phino-text-muted">
            Install: <code className="mt-1 block font-mono text-phino-text [overflow-wrap:anywhere]">{skillsShCmd}</code>
          </p>
          {skill.slug === 'skill-manager' && (
            <p className="text-sm text-phino-text-muted">Asks about missing requirements and gets your approval before building.</p>
          )}
        </div>
      </div>

      <dl className="mt-12 grid grid-cols-2 gap-px border-y border-phino-border bg-phino-border sm:grid-cols-4">
        {numbers.map(([label, value, note]) => (
          <div key={label} className="min-w-0 bg-phino-canvas py-5 pr-4 [&:nth-child(even)]:pl-5 sm:[&:not(:first-child)]:pl-5">
            <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-phino-text-subtle">{label}</dt>
            <dd className={cn('mt-2 truncate text-phino-text', typeof value === 'number' ? 'font-display text-3xl font-medium tabular-nums' : 'font-mono text-base')} title={String(value)}>
              {value}
            </dd>
            <dd className="mt-1 text-xs text-phino-text-muted">{note}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <div className="min-w-0 space-y-14">
          {skill.mermaidChart && (
            <section className="space-y-4" aria-labelledby="statechart-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id="statechart-heading" className="font-display text-2xl font-medium text-phino-text">
                  {statechartMode === 'live' ? 'Live Telemetry Deck (optional)' : 'Statechart (optional)'}
                </h2>

                <div className="flex items-center rounded-md border border-phino-border bg-phino-canvas p-0.5 text-xs">
                  <button
                    type="button"
                    aria-pressed={statechartMode === 'diagram'}
                    onClick={() => setStatechartMode('diagram')}
                    className={cn(toggle, statechartMode === 'diagram' ? 'bg-phino-surface-raised text-phino-text' : 'text-phino-text-muted hover:text-phino-text')}
                  >
                    <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Static Statechart</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={statechartMode === 'live'}
                    onClick={() => setStatechartMode('live')}
                    className={cn(toggle, statechartMode === 'live' ? 'bg-phino-signal text-phino-signal-on' : 'text-phino-text-muted hover:text-phino-text')}
                  >
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Live Telemetry</span>
                  </button>
                </div>
              </div>

              {statechartMode === 'live' ? (
                <LiveTelemetryDeck skill={skill} />
              ) : (
                <>
                  <p className="text-sm text-phino-text-muted">
                    Visual state machine topology parsed directly from the official <code className="font-mono text-phino-text">STATECHART.md</code> in <code className="font-mono text-phino-text">Reactive-Skills/skills</code>:
                  </p>
                  <MermaidViewer chart={skill.mermaidChart} title={`${skill.name} (stateDiagram-v2)`} />
                </>
              )}
            </section>
          )}

          <section className="space-y-4" aria-labelledby="states-heading">
            <h2 id="states-heading" className="font-display text-2xl font-medium text-phino-text">
              States & Deterministic Guards
            </h2>
            <p className="text-sm text-phino-text-muted">
              Each state is an isolated operational slice. Transitions occur only when typed signals satisfy programmatic guard conditions.
            </p>

            <ol className="border-t border-phino-border">
              {skill.states.map((state) => {
                const isInitial = state.name === skill.initialState;
                const isTerminal = !state.transitions || state.transitions.length === 0;

                return (
                  <li key={state.name} className="border-b border-phino-border py-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-phino-text [overflow-wrap:anywhere]">{state.name}</span>
                        {isInitial && (
                          <span className="rounded border border-phino-signal/40 bg-phino-signal-soft px-1.5 py-0.5 font-mono text-[10px] text-phino-signal-text">
                            INITIAL
                          </span>
                        )}
                        {isTerminal && (
                          <span className="rounded border border-phino-border px-1.5 py-0.5 font-mono text-[10px] text-phino-text-muted">
                            TERMINAL
                          </span>
                        )}
                        {state.model && (
                          <span className="rounded border border-phino-signal/40 px-1.5 py-0.5 font-mono text-[10px] text-phino-signal-text">
                            tier: {state.model.tier}{state.model.suggested ? ` (${state.model.suggested})` : ''}
                          </span>
                        )}
                      </div>

                      {state.tools && state.tools.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {state.tools.map((t) => (
                            <span key={t} className="rounded border border-phino-border px-1.5 py-0.5 font-mono text-[10px] text-phino-text-muted">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-phino-text-muted">{state.description}</p>

                    {state.transitions && state.transitions.length > 0 && (
                      <div className="mt-4 rounded-md border border-phino-border bg-phino-surface p-3">
                        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-phino-text-subtle">
                          Outgoing Transitions
                        </p>
                        <ul className="space-y-1.5 font-mono text-xs">
                          {state.transitions.map((t, idx) => (
                            <li key={idx} className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-phino-signal-text [overflow-wrap:anywhere]">{t.signal}</span>
                              <ArrowRight className="h-3 w-3 shrink-0 text-phino-text-muted" aria-hidden="true" />
                              <span className="font-semibold text-phino-text">{t.target}</span>
                              {t.guard && (
                                <span className="rounded border border-phino-border px-1.5 py-0.5 text-[11px] text-phino-text-muted [overflow-wrap:anywhere]">
                                  guard: <code className="font-semibold text-phino-guard-text">{t.guard}</code>
                                </span>
                              )}
                              {t.judgment && (
                                <span className="rounded border border-phino-signal/40 px-1.5 py-0.5 text-[11px] text-phino-signal-text">
                                  judgment: <code className="font-semibold">{t.judgment.type}</code>
                                  {t.judgment.minConfidence !== undefined && ` (min ${(t.judgment.minConfidence * 100).toFixed(0)}%)`}
                                  {t.judgment.fallbackTarget && ` → fallback: ${t.judgment.fallbackTarget}`}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start" aria-label="Skill reference">
          <SideBlock title="Documentation">
            <Link href="/docs/quickstart" className="text-sm text-phino-signal-text underline underline-offset-4">Use or create a skill</Link>
          </SideBlock>

          {skill.contextKeys && skill.contextKeys.length > 0 && (
            <SideBlock title="Context Keys" description="Runtime variables persisted across state transitions:">
              <div className="flex flex-wrap gap-1.5">
                {skill.contextKeys.map((k) => (
                  <code key={k} className="rounded border border-phino-border px-2 py-0.5 font-mono text-xs text-phino-text-muted">
                    {k}
                  </code>
                ))}
              </div>
            </SideBlock>
          )}

          {skill.deliverables && skill.deliverables.length > 0 && (
            <SideBlock title="Projected Deliverables" description="Read models automatically rendered upon transition:">
              <ul className="space-y-1.5">
                {skill.deliverables.map((deliv) => (
                  <li key={deliv} className="flex items-center gap-2 font-mono text-xs text-phino-text-muted">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-phino-signal" aria-hidden="true" />
                    <span className="truncate">{deliv}</span>
                  </li>
                ))}
              </ul>
            </SideBlock>
          )}

          <SideBlock title="Optional host integration">
            <Link href="/docs/mcp" className="text-sm text-phino-signal-text underline underline-offset-4">MCP setup guide</Link>
          </SideBlock>
        </aside>
      </div>
    </div>
  );
}
