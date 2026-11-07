import Link from 'next/link';
import { ArrowUpRight, Check, Layers, Radio, ShieldCheck, X } from 'lucide-react';
import { formatStepShare } from '@/lib/registry/registryStats';
import { cn } from '@/lib/utils';
import { Hero } from './Hero';
import { RunTape } from './RunTape';
import { RuntimeDemo } from './RuntimeDemo';
import { RunDemo } from './RunDemo';
import { RegistrySection } from './RegistrySection';
import { StartPaths } from './StartPaths';
import { Boundaries } from './Boundaries';
import { QuickstartCta } from './QuickstartCta';

const RUN_STEPS = [
  ['Mount', 'The agent receives only VERIFY instructions.'],
  ['Reject', 'A failed check blocks progress and preserves state.'],
  ['Resume', 'A passing result advances the workflow and records why.'],
];

const PASSIVE = [
  'Entire instruction manual dumped into context at once.',
  'Unrecorded internal state; the model guesses next actions.',
  'Completion claims without verifiable gates.',
  'Failures restart from scratch or cascade.',
];

const REACTIVE = [
  'A scoped prompt slice for only the active state.',
  'An explicit state path; each move needs a declared signal, and guards can demand evidence.',
  'An immutable event store (JSONL + SQLite) for replay and audit.',
  'Resume from the last recorded state instead of starting over.',
];

const PRINCIPLES = [
  { icon: Layers, title: 'Context, on purpose.', description: 'Focused prompt slices replace the wall of instructions. Each state gives the agent only the instructions that step needs.', label: 'FOCUSED PROMPT SLICES' },
  { icon: ShieldCheck, title: 'Progress, not guesswork.', description: "Each move needs a typed signal; guards can demand evidence. The runtime commits the transition, not the model's best guess.", label: 'SIGNALS + GUARDS' },
  { icon: Radio, title: 'A history that holds.', description: 'Immutable events capture what happened. Live deliverables turn a running process into inspectable work.', label: 'EVENTS + DELIVERABLES' },
];

function Section({ id, label, labelClassName = 'text-phino-signal-text', className, children, ...rest }) {
  return (
    <section id={id} className={cn('border-b border-phino-border px-5 py-20 sm:px-10 sm:py-28', className)} {...rest}>
      <div className="mx-auto max-w-[1320px]">
        <p className={cn('font-mono text-xs', labelClassName)}>{label}</p>
        {children}
      </div>
    </section>
  );
}

/**
 * Landing page: hero, run tape, the two run examples, registry, before and after, principles,
 * start paths, boundaries and the closing call to action. Registry numbers come from the build.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; interactive parts are client islands)
 * - Complexity: O(n) in the n published workflows
 * - Cyclomatic Complexity (CC): target <=4
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=8
 */
export function LandingPage({ stats, tape, tapeSkillName, registryRows }) {
  return (
    <div>
      <Hero />

      <div className="border-b border-phino-border px-5 py-10 sm:px-10">
        <div className="mx-auto max-w-[1320px]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-phino-text-muted">From passive instructions to reactive state machines.</p>
            <p className="font-mono text-[11px] text-phino-signal-text">PROMPT → SIGNAL → GUARD → EVENT → DELIVERABLE</p>
          </div>
          <p className="mt-8 font-mono text-[11px] uppercase text-phino-text-subtle">
            {tapeSkillName}: its real states and exit checks, from the registry
          </p>
          <div className="mt-4">
            <RunTape steps={tape} skillName={tapeSkillName} />
          </div>
        </div>
      </div>

      <Section id="runtime" label="01 / THE RUNTIME" aria-labelledby="runtime-heading">
        <div className="mb-12 mt-4 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <h2 id="runtime-heading" className="section-title font-display text-phino-text">
            Less context.
            <br />
            More control.
          </h2>
          <p className="max-w-sm text-base leading-relaxed text-phino-text-muted">
            Each state hands the agent only its own instructions. Every next step is explicit and recorded; guards can demand evidence.
          </p>
        </div>
        <RuntimeDemo />
      </Section>

      <Section label="02 / WHEN IT FAILS" aria-labelledby="run-heading">
        <div className="mb-12 mt-4 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <h2 id="run-heading" className="section-title max-w-3xl font-display text-phino-text">
            The useful part appears when something fails.
          </h2>
          <p className="max-w-sm text-base leading-relaxed text-phino-text-muted">
            A passing demo proves little. A rejected check shows that the workflow can stop, keep its state, and continue from evidence.
          </p>
        </div>
        <RunDemo />
        <ol className="mt-6 grid border-t border-phino-border sm:grid-cols-3">
          {RUN_STEPS.map(([title, text]) => (
            <li key={title} className="border-b border-phino-border py-4 sm:border-b-0 sm:pr-6">
              <p className="font-display text-sm font-semibold text-phino-text">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-phino-text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="registry" label="03 / THE REGISTRY" aria-labelledby="registry-heading">
        <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <h2 id="registry-heading" className="section-title max-w-3xl font-display text-phino-text">
            {stats.skillCount} workflows.
            <br />
            {stats.stateCount} explicit states.
          </h2>
          <p className="max-w-sm text-sm leading-7 text-phino-text-muted">
            Published workflows you can install today. Each runs as explicit states; checks count the transitions that carry a guard.
          </p>
        </div>
        <RegistrySection rows={registryRows} />
        {stats.medianStepShare !== null && (
          <p className="mt-6 max-w-[75ch] text-xs leading-relaxed text-phino-text-subtle">
            At each step the agent gets <span className="text-phino-signal-text">{formatStepShare(stats.medianStepShare)}</span> of a
            skill&apos;s instructions: the median across {stats.measuredSkillCount} registry skills of one state file versus SKILL.md
            plus every state file, measured in bytes at build time. SKILL.md loads once when the skill starts, and earlier steps
            stay in the conversation.
          </p>
        )}
      </Section>

      <Section label="04 / BEFORE AND AFTER" labelClassName="text-phino-hero-muted" className="border-b-0 bg-phino-hero text-phino-hero-ink" aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="section-title mt-5 max-w-3xl font-display">
          From a document the model reads to a workflow you can watch.
        </h2>
        <div className="mt-16 grid md:grid-cols-2">
          <div className="border-t border-phino-hero-muted/30 py-8 md:pr-12">
            <p className="font-mono text-sm text-phino-hero-muted">SKILL.md</p>
            <h3 className="mt-2 font-display text-3xl text-phino-hero-muted">A passive skill</h3>
            <ul className="mt-8 space-y-5">
              {PASSIVE.map((text) => (
                <li key={text} className="flex gap-3 text-phino-hero-muted">
                  <X className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-phino-lime py-8 md:border-l md:border-l-phino-hero-muted/30 md:pl-12">
            <p className="font-mono text-sm text-phino-lime">states/*.md</p>
            <h3 className="mt-2 font-display text-3xl">A reactive skill</h3>
            <ul className="mt-8 space-y-5">
              {REACTIVE.map((text) => (
                <li key={text} className="flex gap-3">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-phino-lime" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section label="05 / DESIGNED FOR INTENT" labelClassName="text-phino-paper-muted" className="border-b-0 bg-phino-paper text-phino-paper-ink" aria-labelledby="principles-heading">
        <div className="mt-5 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 id="principles-heading" className="section-title max-w-2xl font-display">
            Not a bigger prompt.
            <br />
            A better architecture.
          </h2>
          <Link href="/docs/concepts" className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-phino-paper-line hover:decoration-phino-paper-ink">
            Explore the concepts <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-12">
          {PRINCIPLES.map((principle, index) => (
            <div key={principle.title} className="border-t border-phino-paper-line pt-6">
              <div className="mb-12 flex justify-between">
                <principle.icon className="h-7 w-7 stroke-1" aria-hidden="true" />
                <span className="font-mono text-xs text-phino-paper-muted">0{index + 1}</span>
              </div>
              <h3 className="font-display text-2xl">{principle.title}</h3>
              <p className="mt-4 max-w-sm text-sm leading-7 text-phino-paper-muted">{principle.description}</p>
              <p className="mt-8 font-mono text-[10px] text-phino-paper-muted">{principle.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section label="06 / THREE WAYS TO START" aria-labelledby="paths-heading">
        <h2 id="paths-heading" className="section-title mt-5 font-display text-phino-text">Pick your entry state.</h2>
        <StartPaths />
      </Section>

      <Section label="07 / BOUNDARIES" aria-labelledby="boundaries-heading">
        <div className="mb-12 mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <h2 id="boundaries-heading" className="section-title max-w-3xl font-display text-phino-text">
            Use it where state and evidence matter.
          </h2>
          <p className="max-w-sm text-base leading-relaxed text-phino-text-muted">
            Reactive Skills is not required for every prompt. It earns its place when a workflow spans multiple steps, tools, or sessions.
          </p>
        </div>
        <Boundaries />
      </Section>

      <Section label="08 / YOUR NEXT STATE" className="border-b-0" aria-labelledby="cta-heading">
        <QuickstartCta />
      </Section>
    </div>
  );
}
