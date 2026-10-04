import Link from 'next/link';
import { getRegistryContentSource } from '@/infrastructure/container';
import { SkillCatalog } from '@/features/registry/SkillCatalog';
import { ExternalLink, GitPullRequest, ArrowRight } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';
import { formatStepShare } from '@/lib/registry/registryStats';

function GithubIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...props}>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export const metadata = {
  title: 'Public Skill Registry',
  description:
    'Published reactive workflows for coding agents from Reactive-Skills/skills, ready to install with skills.sh.',
};

export default function RegistryPage() {
  const registrySource = getRegistryContentSource();
  const skills = registrySource.listSkills();
  const categories = registrySource.getCategories();

  const stats = registrySource.getStats();

  return (
    <div className="container py-10 sm:py-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:items-end lg:gap-10">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-bold tracking-tight text-phino-text sm:text-4xl">Skill Registry</h1>
          <p className="mt-3 text-base leading-relaxed text-phino-text-muted">
            Published workflows from{' '}
            <a
              href="https://github.com/Reactive-Skills/skills"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm font-semibold text-phino-text underline decoration-phino-signal underline-offset-4 hover:text-phino-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              Reactive-Skills/skills
            </a>
            . Install one with skills.sh, then invoke it from your agent.
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-phino-text-muted">
            <li><strong className="font-mono font-semibold tabular-nums text-phino-text">{stats.skillCount}</strong> skills</li>
            <li><strong className="font-mono font-semibold tabular-nums text-phino-text">{stats.stateCount}</strong> explicit states</li>
            {stats.medianStepShare !== null && (
              <li title={`Median across ${stats.measuredSkillCount} skills: one state file versus SKILL.md plus every state file, in bytes. SKILL.md loads once when the skill starts, and earlier steps stay in the conversation.`}>
                <strong className="font-mono font-semibold tabular-nums text-phino-text">{formatStepShare(stats.medianStepShare)}</strong> of a skill&apos;s instructions delivered per step
              </li>
            )}
          </ul>
        </div>

        <div className="min-w-0">
          <CommandBlock command="npx skills add Reactive-Skills/skills" caption="install every skill" />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a
              href="https://github.com/Reactive-Skills/skills"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-phino-text-muted hover:text-phino-text"
            >
              <GithubIcon className="h-4 w-4" aria-hidden="true" /> Source <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a
              href="https://github.com/Reactive-Skills/skills/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-phino-text-muted hover:text-phino-text"
            >
              <GitPullRequest className="h-4 w-4 text-phino-signal" aria-hidden="true" /> Contribute
            </a>
            <Link href="/registry/skill-manager" className="inline-flex items-center gap-1 font-medium text-phino-signal-text hover:text-phino-text">
              Building your own? Start with Skill Manager <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <SkillCatalog initialSkills={skills} categories={categories} />
      </div>
    </div>
  );
}
