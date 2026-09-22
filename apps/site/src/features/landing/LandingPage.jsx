import { SectionHeading } from '@/components/common/SectionHeading';
import { Hero } from './Hero';
import { SkillComparison } from './SkillComparison';
import { EventFlowDiagram } from './EventFlowDiagram';
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
          description="Passive markdown instructions force models to self-police. Reactive skills enforce explicit state machines — verifiable guards, prompt isolation, and immutable event logs."
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
            description="Every reactive transition follows a deterministic pipeline: prompt slice, signal, guard evaluation, state transition, event ledger entry, and read projection."
          />
          <h2 id="flow-heading" className="sr-only">The event flow</h2>
          <div className="mt-10">
            <EventFlowDiagram flow={flow} />
          </div>
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
        <SectionHeading
          eyebrow="agent interfaces"
          title="Reach it through AXI and MCP"
          description="Drive skills through a compatible local AXI or MCP transport. AXI offers token-lean shell output, while MCP connects host tool panels."
        />
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
