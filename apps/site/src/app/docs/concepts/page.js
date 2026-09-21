import { getDocsContentSource } from '@/infrastructure/container';
import { notFound } from 'next/navigation';
import { DocsBreadcrumb } from '@/features/docs/DocsBreadcrumb';
import { DocPageView } from '@/features/docs/DocPageView';
import { RelatedPages } from '@/features/docs/RelatedPages';
import { StateMachine } from '@/features/landing/StateMachine';

const SLUG = 'concepts';
const page = getDocsContentSource().getPage(SLUG);

export const metadata = page ? { title: page.title, description: page.summary } : {};

export default function ConceptsPage() {
  const content = getDocsContentSource();
  const doc = content.getPage(SLUG);
  const machine = content.getStateMachine();

  if (!doc) notFound();

  return (
    <div className="space-y-12">
      <DocsBreadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Docs', href: '/docs' }, { label: doc.title }]} />
      <DocPageView page={doc} />

      {/* Interactive State Machine Laboratory Section */}
      <section className="rounded-2xl border border-phino-border bg-phino-surface p-6 sm:p-8" id="interactive-simulator">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-phino-signal/30 bg-phino-signal-soft px-3 py-0.5 font-mono text-xs font-semibold text-phino-signal-text">
            Interactive Laboratory
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-phino-text sm:text-3xl">
            Live State Machine & Event Ledger
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-phino-text-muted sm:text-base">
            Simulate runtime execution or step through transitions manually. Toggle between a Hierarchical Statechart (HSM with ancestor bubbling) and a Flat Linear Pipeline to see how typed signals, deterministic guards, and immutable event ledgers operate in real time.
          </p>
        </div>
        <StateMachine machine={machine} />
      </section>

      <RelatedPages pages={doc.relatedPages} />
    </div>
  );
}
