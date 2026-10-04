import { SectionHeading } from '@/components/common/SectionHeading';
import { Hero } from './Hero';
import { UseCases } from './UseCases';
import { SkillComparison } from './SkillComparison';
import { RunDemo } from './RunDemo';
import { StartPaths } from './StartPaths';
import { Boundaries } from './Boundaries';
import { QuickstartCta } from './QuickstartCta';

const RUN_STEPS = [
  ['01', 'Mount', 'The agent receives only VERIFY instructions.'],
  ['02', 'Reject', 'A failed check blocks progress and preserves state.'],
  ['03', 'Resume', 'A passing result advances the workflow and records why.'],
];

export function LandingPage({ stats, useCases }) {
  return (
    <div>
      <Hero stats={stats} />

      <section className="container py-16 sm:py-20" aria-labelledby="use-cases-heading">
        <SectionHeading
          id="use-cases-heading"
          eyebrow="where it fits"
          title="Built for work that spans many steps"
          description="Published workflows you can install today. Each one runs as explicit states, so your agent works one step at a time and moves on when a check passes."
        />
        <div className="mt-8">
          <UseCases items={useCases} />
        </div>
      </section>

      <section className="border-y border-phino-border bg-phino-surface" aria-labelledby="passive-heading">
        <div className="container py-16 sm:py-20">
          <SectionHeading
            id="passive-heading"
            eyebrow="the shift"
            title="From a document the model reads to a workflow you can watch"
            description="A passive skill leaves the model to police itself. A reactive skill runs explicit states with checks on every transition, scoped instructions, and an append-only event log."
          />
          <div className="mt-8">
            <SkillComparison />
          </div>
        </div>
      </section>

      <section className="container py-16 sm:py-20" aria-labelledby="run-heading">
        <SectionHeading
          id="run-heading"
          eyebrow="follow one run"
          title="The useful part appears when something fails"
          description="A passing demo proves little. A rejected check shows that the workflow can stop, keep its state, and continue from evidence."
        />
        <div className="mt-8">
          <RunDemo />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {RUN_STEPS.map(([number, title, text]) => (
              <div key={number} className="rounded-xl border border-phino-border bg-phino-surface p-4">
                <span className="font-mono text-xs font-semibold text-phino-signal-text">{number}</span>
                <p className="mt-3 font-display text-sm font-semibold text-phino-text">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-phino-text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-phino-border bg-phino-surface" aria-labelledby="paths-heading">
        <div className="container py-16 sm:py-20">
          <SectionHeading
            id="paths-heading"
            eyebrow="choose your path"
            title="Three ways to start"
            description="Use a published skill, author one for your team, or connect the runtime to your agent host."
          />
          <div className="mt-8">
            <StartPaths />
          </div>
        </div>
      </section>

      <section className="container py-16 sm:py-20" aria-labelledby="boundaries-heading">
        <SectionHeading
          id="boundaries-heading"
          eyebrow="know the boundaries"
          title="Use it where state and evidence matter"
          description="Reactive Skills is not required for every prompt. It earns its place when a workflow spans multiple steps, tools, or sessions."
        />
        <div className="mt-8">
          <Boundaries />
        </div>
      </section>

      <section className="container pb-20">
        <QuickstartCta />
      </section>
    </div>
  );
}
