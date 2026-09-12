import Link from 'next/link';
import { getRegistryContentSource } from '@/infrastructure/container';
import { SkillCatalog } from '@/features/registry/SkillCatalog';
import { ShieldCheck, Workflow, Zap, GitPullRequest, ExternalLink, Package, Star, ArrowRight } from 'lucide-react';
import { CommandBlock } from '@/components/common/CommandBlock';
import { CopyButton } from '@/components/common/CopyButton';

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
    'Official community catalog of verified, production-grade Reactive Skills hosted on GitHub at Reactive-Skills/skills.',
};

export default function RegistryPage() {
  const registrySource = getRegistryContentSource();
  const skills = registrySource.listSkills();
  const categories = registrySource.getCategories();

  const totalStates = skills.reduce((acc, s) => acc + s.stateCount, 0);

  return (
    <div className="container py-12 sm:py-16">
      {/* Page Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-phino-border bg-phino-surface px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-phino-signal animate-pulse-soft" aria-hidden="true" />
          <span className="font-mono text-xs text-phino-text-muted">reactive-skills / skills</span>
        </div>

        <h1 className="font-display text-4xl font-bold tracking-tight text-phino-text sm:text-5xl">
          Public Skill Registry
        </h1>

        <p className="mt-4 text-base leading-relaxed text-phino-text-muted sm:text-lg">
          The official community catalog of verified, production-grade Reactive Skills hosted at{' '}
          <a
            href="https://github.com/Reactive-Skills/skills"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-phino-text underline decoration-phino-signal underline-offset-4 hover:text-phino-signal-text"
          >
            Reactive-Skills/skills
          </a>
          . Install directly into your agent environment using <code className="text-phino-text">skills.sh</code>, or execute on-demand via the token-efficient AXI CLI.
        </p>

        {/* Action Buttons: GitHub Repo + Contribute */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/Reactive-Skills/skills"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-phino-border-strong bg-phino-surface-raised px-4 py-2 text-sm font-medium text-phino-text transition-colors hover:border-phino-signal"
          >
            <GithubIcon className="h-4 w-4" aria-hidden="true" />
            <span>Reactive-Skills/skills</span>
            <ExternalLink className="h-3.5 w-3.5 text-phino-text-subtle" aria-hidden="true" />
          </a>

          <a
            href="https://github.com/Reactive-Skills/skills/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-phino-border bg-phino-canvas px-4 py-2 text-sm font-medium text-phino-text-muted transition-colors hover:border-phino-border-strong hover:text-phino-text"
          >
            <GitPullRequest className="h-4 w-4 text-phino-signal" aria-hidden="true" />
            <span>Contribute a Skill</span>
          </a>
        </div>

        {/* Global Install Quickstart */}
        <div className="mt-8 max-w-xl mx-auto text-left">
          <CommandBlock
            command="npx skills add Reactive-Skills/skills"
            caption="install all official skills (skills.sh)"
          />
        </div>

        {/* Stats Strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 border-y border-phino-border py-4 font-mono text-xs text-phino-text-muted">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-phino-signal" aria-hidden="true" />
            <span><strong className="text-phino-text">{skills.length}</strong> Official Skills</span>
          </div>
          <span className="text-phino-border-strong select-none" aria-hidden="true">|</span>
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-phino-signal" aria-hidden="true" />
            <span><strong className="text-phino-text">{totalStates}</strong> Total State Slices</span>
          </div>
          <span className="text-phino-border-strong select-none" aria-hidden="true">|</span>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-phino-signal" aria-hidden="true" />
            <span><strong className="text-phino-text">100%</strong> Guard Deterministic</span>
          </div>
        </div>
      </div>

      {/* Priority Skill Spotlight: Skill Manager */}
      <div className="mt-12 rounded-2xl border border-phino-signal/40 bg-gradient-to-r from-phino-surface via-phino-surface-raised to-phino-surface p-6 sm:p-8 relative overflow-hidden shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-phino-signal/20 px-2 py-0.5 font-mono text-[11px] font-bold text-phino-signal-text border border-phino-signal/35">
                <Star className="h-3 w-3 fill-phino-signal text-phino-signal" aria-hidden="true" />
                Priority Authoring Standard
              </span>
              <span className="text-xs font-mono text-phino-text-subtle">Core Lifecycle Utility</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-phino-text">
              Building or Migrating Skills? Start with Skill Manager
            </h2>
            <p className="mt-2 text-sm text-phino-text-muted leading-relaxed">
              Never hand-author reactive skill structures manually. Use <strong className="text-phino-text">Skill Manager</strong> to scaffold new skills, validate transition guards, migrate legacy <code className="text-xs text-phino-text font-mono">SKILL.md</code> files, and keep Mermaid <code className="text-xs text-phino-text font-mono">STATECHART.md</code> topologies synchronized with <code className="text-xs text-phino-text font-mono">skill.yaml</code>.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-2.5 min-w-[290px]">
            <div className="flex items-center justify-between rounded-lg border border-phino-border bg-phino-canvas px-3 py-2 text-xs font-mono">
              <span className="truncate text-phino-text-muted">... add ... skill-manager</span>
              <CopyButton
                value="npx skills add Reactive-Skills/skills --skill skill-manager"
                label="Copy"
                size="sm"
                className="h-6 px-2 text-[11px]"
              />
            </div>
            <Link
              href="/registry/skill-manager"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-phino-text px-4 py-2.5 text-xs font-semibold text-phino-canvas hover:opacity-90 transition-opacity"
            >
              Inspect Skill Manager <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {/* Interactive Catalog */}
      <div className="mt-12">
        <SkillCatalog initialSkills={skills} categories={categories} />
      </div>
    </div>
  );
}
