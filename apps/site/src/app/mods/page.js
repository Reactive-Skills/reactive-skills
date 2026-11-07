import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { getModsContentSource } from '@/infrastructure/container';
import { CommandBlock } from '@/components/common/CommandBlock';
import { PageHeader } from '@/components/common/PageHeader';
import flowPlanImage from '@/features/mods/images/flow-plan.png';
import statusLineImage from '@/features/mods/images/status-line.png';
import flowImage from '@/features/mods/images/flow.png';

export const metadata = {
  title: 'Mods',
  description:
    'Claude Code mods for working with Reactive Skills runs: a status line, a live state-machine map and a query-plan style trace.',
};

const SCREENSHOTS = {
  'bq-vitals': [
    {
      src: statusLineImage,
      alt: 'bq-vitals status line with example context, cost and rate-limit readings, and release-notes active at VALIDATE.',
      caption: 'The status line: context, cost and rate limits, with the active skill and state. Example readings.',
      wide: true,
    },
    {
      src: flowImage,
      alt: 'Live release-notes map at VALIDATE: INTAKE, COLLECT, CLASSIFY and COMPOSE are done; REVIEW is not reached. The plan alongside shows signals, guards and duration bars.',
      caption: '/flow during validation: completed states, the current state and the path so far.',
    },
    {
      src: flowPlanImage,
      alt: 'release-notes /flow-plan at REVIEW: five guarded hops from INTAKE, with duration bars and exits not taken. Example timings.',
      caption: '/flow-plan at review: the path taken, time per state and the exits not taken. Example timings.',
    },
  ],
};

/** # Performance & Risk Budget
 * - Tier: P3 (static render, <2000ms target)
 * - Complexity: O(m + f + i) mods, features and images
 * - Cyclomatic Complexity (CC): target <=20
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=30
 */
export default function ModsPage() {
  const mods = getModsContentSource().listMods();

  return (
    <div className="container py-12 lg:py-20">
      <PageHeader eyebrow="Claude Code plugins" title="Mods">
        <p>
          A mod is a small plugin that adds a status line, a pane or a command inside Claude Code. Skills run a
          workflow; mods change what you can see and do while the workflow runs. They are installed from a plugin
          marketplace, not with skills.sh, and they only act in the session where they are installed.
        </p>
      </PageHeader>

      <div className="mt-16 space-y-20">
        {mods.map((mod) => (
          <section key={mod.slug} id={mod.slug} aria-labelledby={`${mod.slug}-title`} className="border-t border-phino-border pt-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-end lg:gap-16">
              <div className="max-w-2xl">
                <h2 id={`${mod.slug}-title`} className="font-mono text-3xl font-medium tracking-tight text-phino-text">
                  {mod.name}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-phino-text-muted">{mod.summary}</p>
              </div>
              <div className="min-w-0">
                <CommandBlock command={mod.installCmd} caption="install" wrap />
                <p className="mt-4 text-sm text-phino-text-muted">
                  Answer <code className="font-mono">y</code> to add the marketplace, then pick a scope.{' '}
                  <a
                    href={mod.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-phino-signal-text hover:text-phino-text"
                  >
                    Source <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </p>
              </div>
            </div>

            <dl className="mt-10 grid gap-px border-y border-phino-border bg-phino-border sm:grid-cols-3">
              {mod.features.map((feature) => (
                <div key={feature.name} className="bg-phino-canvas py-5 sm:px-5 sm:first:pl-0">
                  <dt className="font-mono text-sm font-semibold text-phino-text">{feature.name}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-phino-text-muted">{feature.description}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              {(SCREENSHOTS[mod.slug] ?? []).map((shot) => (
                <figure key={shot.caption} className={`min-w-0 ${shot.wide ? 'lg:col-span-2' : ''}`}>
                  <a href={shot.src.src} target="_blank" rel="noopener noreferrer" className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-phino-focus">
                    <Image
                      src={shot.src}
                      alt={shot.alt}
                      width={shot.src.width}
                      height={shot.src.height}
                      className="h-auto w-full rounded-lg border border-phino-border-strong"
                      sizes={shot.wide ? '100vw' : '(min-width: 1024px) 50vw, 100vw'}
                    />
                  </a>
                  <figcaption className="mt-3 font-mono text-[11px] leading-relaxed text-phino-text-muted">
                    {shot.caption}
                  </figcaption>
                </figure>
              ))}
            </div>

            <h3 className="mt-10 font-mono text-[11px] uppercase tracking-[0.14em] text-phino-text-subtle">What it reads</h3>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-phino-text-muted marker:text-phino-signal">
              {mod.reads.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-phino-text-muted">
              It only reads. It looks in the session directory, ~/.claude/skills, ~/.agents/skills and /tmp for the
              latest run.
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
