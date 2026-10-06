import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { getModsContentSource } from '@/infrastructure/container';
import { CommandBlock } from '@/components/common/CommandBlock';
import flowPlanImage from '@/features/mods/images/flow-plan.png';
import statusLineImage from '@/features/mods/images/status-line.png';

export const metadata = {
  title: 'Mods',
  description:
    'Claude Code mods for working with Reactive Skills runs: a status line, a live state-machine map and a query-plan style trace.',
};

const SCREENSHOTS = {
  'bq-vitals': [
    {
      src: statusLineImage,
      alt: 'Claude Code status line reading bq-vitals: ctx 246k/1.0M 25%, $6.10, 5h 2%, 7d 49%',
      caption: 'The status line: context, cost and rate limits.',
    },
    {
      src: flowPlanImage,
      alt: 'Output of /flow-plan for a caption-summarizer run: seven hops from INIT to COMPLETE with time per state and the exits not taken',
      caption: '/flow-plan on a finished run: the path taken, time per state and the exits not taken.',
    },
  ],
};

export default function ModsPage() {
  const mods = getModsContentSource().listMods();

  return (
    <div className="container py-10 sm:py-12">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-phino-text sm:text-4xl">Mods</h1>
        <p className="mt-3 text-base leading-relaxed text-phino-text-muted">
          A mod is a small plugin that adds a status line, a pane or a command inside Claude Code. Skills run a
          workflow; mods change what you can see and do while the workflow runs. They are installed from a plugin
          marketplace, not with skills.sh, and they only act in the session where they are installed.
        </p>
      </div>

      <div className="mt-10 space-y-14">
        {mods.map((mod) => (
          <section key={mod.slug} id={mod.slug} aria-labelledby={`${mod.slug}-title`}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:items-end lg:gap-10">
              <div className="max-w-2xl">
                <h2 id={`${mod.slug}-title`} className="font-mono text-2xl font-semibold text-phino-text">
                  {mod.name}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-phino-text-muted">{mod.summary}</p>
              </div>
              <div className="min-w-0">
                <CommandBlock command={mod.installCmd} caption="install" />
                <p className="mt-3 text-sm text-phino-text-muted">
                  Answer <code className="font-mono">y</code> to add the marketplace, then pick a scope.{' '}
                  <a
                    href={mod.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-phino-signal-text hover:text-phino-text"
                  >
                    Source <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </p>
              </div>
            </div>

            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              {mod.features.map((feature) => (
                <div key={feature.name} className="rounded-xl border border-phino-border bg-phino-surface-raised p-4">
                  <dt className="font-mono text-sm font-semibold text-phino-text">{feature.name}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-phino-text-muted">{feature.description}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {(SCREENSHOTS[mod.slug] ?? []).map((shot) => (
                <figure key={shot.caption} className="min-w-0">
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    className="h-auto w-full rounded-xl border border-phino-border-strong"
                    sizes="(min-width: 1024px) 50vw, 100vw"
                  />
                  <figcaption className="mt-2 text-xs text-phino-text-muted">{shot.caption}</figcaption>
                </figure>
              ))}
            </div>

            <h3 className="mt-8 text-sm font-semibold text-phino-text">What it reads</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-phino-text-muted">
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
