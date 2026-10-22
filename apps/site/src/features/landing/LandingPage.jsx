import { SectionHeading } from '@/components/common/SectionHeading';
import { formatStepShare } from '@/lib/registry/registryStats';
import { Hero } from './Hero';
import { RegistryLog } from './RegistryLog';
import { SplitTape } from './SplitTape';
import { RunDemo } from './RunDemo';
import { StartPaths } from './StartPaths';
import { Boundaries } from './Boundaries';
import { QuickstartCta } from './QuickstartCta';

const RUN_STEPS = [
  ['Mount', 'The agent receives only VERIFY instructions.'],
  ['Reject', 'A failed check blocks progress and preserves state.'],
  ['Resume', 'A passing result advances the workflow and records why.'],
];

function RegistryReadout({ stats }) {
  return (
    <div className="mt-8 font-mono text-xs leading-relaxed text-phino-text-muted">
      <p className="flex flex-wrap gap-x-5 gap-y-1">
        {stats.medianStepShare !== null && (
          <span>
            <span className="text-phino-signal-text">{formatStepShare(stats.medianStepShare)}</span> of a skill&apos;s instructions delivered at each step
          </span>
        )}
        <span>
          <span className="text-phino-signal-text">{stats.stateCount}</span> explicit states across {stats.skillCount} published workflows
        </span>
        <span>
          <span className="text-phino-signal-text">Every</span> transition and failed check lands in a replayable run history
        </span>
      </p>
    </div>
  );
}

export function LandingPage({ stats, tape, tapeSkillName, registryRows }) {
  return (
    <div>
      <Hero tape={tape} skillName={tapeSkillName} />

      <section className="container py-16 sm:py-24" aria-labelledby="use-cases-heading">
        <SectionHeading
          id="use-cases-heading"
          title="Built for work that spans many steps"
          description="Published workflows you can install today. Each one runs as explicit states, so your agent works one step at a time and moves on when a check passes. Checks counts the transitions that carry a guard."
        />
        <RegistryReadout stats={stats} />
        <div className="mt-6 overflow-x-auto">
          <RegistryLog rows={registryRows} />
        </div>
        {stats.medianStepShare !== null && (
          <p className="mt-4 max-w-[75ch] text-xs leading-relaxed text-phino-text-subtle">
            Median across {stats.measuredSkillCount} registry skills: one state file versus SKILL.md plus every state file, measured in bytes at build time. SKILL.md loads once when the skill starts, and earlier steps stay in the conversation.
          </p>
        )}
      </section>

      <section className="border-t border-phino-border" aria-labelledby="passive-heading">
        <div className="container py-16 sm:py-24">
          <SectionHeading
            id="passive-heading"
            title="From a document the model reads to a workflow you can watch"
            description="A passive skill leaves the model to police itself. A reactive skill runs explicit states with checks on every transition, scoped instructions, and an append-only event log."
          />
          <div className="mt-10">
            <SplitTape states={tape.map((step) => step.name)} />
          </div>
        </div>
      </section>

      <section className="border-t border-phino-border" aria-labelledby="run-heading">
        <div className="container py-16 sm:py-24">
          <SectionHeading
            id="run-heading"
            title="The useful part appears when something fails"
            description="A passing demo proves little. A rejected check shows that the workflow can stop, keep its state, and continue from evidence."
          />
          <div className="mt-10">
            <RunDemo />
            <ol className="mt-6 grid border-t border-phino-border sm:grid-cols-3">
              {RUN_STEPS.map(([title, text]) => (
                <li key={title} className="border-b border-phino-border py-4 sm:border-b-0 sm:pr-6">
                  <p className="font-display text-sm font-semibold text-phino-text">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-phino-text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t border-phino-border" aria-labelledby="paths-heading">
        <div className="container py-16 sm:py-24">
          <SectionHeading
            id="paths-heading"
            title="Three ways to start"
            description="Use a published skill, author one for your team, or connect the runtime to your agent host."
          />
          <div className="mt-10">
            <StartPaths />
          </div>
        </div>
      </section>

      <section className="border-t border-phino-border" aria-labelledby="boundaries-heading">
        <div className="container py-16 sm:py-24">
          <SectionHeading
            id="boundaries-heading"
            title="Use it where state and evidence matter"
            description="Reactive Skills is not required for every prompt. It earns its place when a workflow spans multiple steps, tools, or sessions."
          />
          <div className="mt-10">
            <Boundaries />
          </div>
        </div>
      </section>

      <section className="border-t border-phino-border">
        <div className="container py-16 sm:py-24">
          <QuickstartCta />
        </div>
      </section>
    </div>
  );
}
