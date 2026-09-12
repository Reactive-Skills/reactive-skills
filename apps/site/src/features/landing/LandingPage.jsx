import { SectionHeading } from '@/components/common/SectionHeading';
import { Hero } from './Hero';
import { SkillComparison } from './SkillComparison';
import { EventFlowDiagram } from './EventFlowDiagram';
import { StateMachine } from './StateMachine';
import { ValueAreas } from './ValueAreas';
import { AgentHosts } from './AgentHosts';
import { QuickstartCta } from './QuickstartCta';

export function LandingPage({ machine, flow }) {
  return (
    <div>
      <Hero />

      <section className="container py-16 sm:py-20" aria-labelledby="passive-heading">
        <SectionHeading
          eyebrow="the shift"
          title="From a document the model reads to a machine you can watch"
          description="A passive SKILL.md hopes the model behaves. A reactive skill makes behaviour explicit — with the same readability and far more reliability."
        />
        <h2 id="passive-heading" className="sr-only">Passive versus reactive skills</h2>
        <div className="mt-8">
          <SkillComparison />
        </div>
      </section>

      <section className="border-y border-phino-border bg-phino-surface" aria-labelledby="flow-heading">
        <div className="container py-16 sm:py-20">
          <SectionHeading
            eyebrow="the event flow"
            title="One chain explains the whole runtime"
            description="Every reactive skill moves through the same six-stage chain. Read it once and the rest of the model follows."
          />
          <h2 id="flow-heading" className="sr-only">The event flow</h2>
          <div className="mt-10">
            <EventFlowDiagram flow={flow} />
          </div>
        </div>
      </section>

      <section className="container py-16 sm:py-20" aria-labelledby="machine-heading">
        <SectionHeading
          eyebrow="interactive"
          title="Step through a skill’s state machine"
          description="Play the run or step through it yourself. Each state gates on a guard and emits an event you could replay later."
        />
        <h2 id="machine-heading" className="sr-only">Interactive state machine</h2>
        <div className="mt-8">
          <StateMachine machine={machine} />
        </div>
      </section>

      <section className="border-t border-phino-border bg-phino-surface" aria-labelledby="value-heading">
        <div className="container py-16 sm:py-20">
          <SectionHeading eyebrow="why it matters" title="Three properties you get for free" />
          <h2 id="value-heading" className="sr-only">Value areas</h2>
          <div className="mt-8">
            <ValueAreas />
          </div>
        </div>
      </section>

      <section className="container py-16 sm:py-20" aria-labelledby="hosts-heading">
        <SectionHeading eyebrow="built for agent hosts" title="Reach it through MCP and AXI" description="Reactive Skills is designed to be driven by agents and tools, not just people." />
        <h2 id="hosts-heading" className="sr-only">Built for agent hosts</h2>
        <div className="mt-8">
          <AgentHosts />
        </div>
      </section>

      <section className="container pb-20">
        <QuickstartCta />
      </section>
    </div>
  );
}
