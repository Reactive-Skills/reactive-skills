'use client';

import { useState, useMemo } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { CommandBlock } from '@/components/common/CommandBlock';
import { CREATE_SKILL_PROMPT } from '@/lib/skillPrompts';
import { SkillCard } from './SkillCard';

/**
 * Registry catalog: search, category filter and a ruled grid of skill cards.
 *
 * # Performance & Risk Budget
 * - Tier: P2 (client interaction; one filter pass per keystroke)
 * - Complexity: O(n) in the n published skills
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=16
 */
export function SkillCatalog({ initialSkills, categories }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredSkills = useMemo(() => {
    let result = initialSkills;

    if (selectedCategory !== 'All') {
      result = result.filter(
        (s) => s.category.toLowerCase() === selectedCategory.toLowerCase(),
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          (s.tags && s.tags.some((t) => t.toLowerCase().includes(q))),
      );
    }

    return result;
  }, [initialSkills, selectedCategory, search]);

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('All');
  };

  const chip =
    'rounded-full border border-phino-border px-4 py-1.5 font-mono text-[11px] uppercase text-phino-text-muted transition-colors hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus aria-pressed:border-phino-signal aria-pressed:bg-phino-signal aria-pressed:text-phino-signal-on';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-phino-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills by name, tag, or description..."
            aria-label="Search skills"
            className="w-full rounded-md border border-phino-border bg-phino-surface py-2.5 pl-10 pr-9 text-sm text-phino-text placeholder:text-phino-text-subtle focus:border-phino-signal focus:outline-none focus:ring-2 focus:ring-phino-focus/25"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-phino-text-muted hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="self-start font-mono text-xs text-phino-text-muted sm:self-auto" aria-live="polite">
          Showing <strong className="font-semibold tabular-nums text-phino-text">{filteredSkills.length}</strong> of{' '}
          <strong className="font-semibold tabular-nums text-phino-text">{initialSkills.length}</strong> skills
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
        <button type="button" aria-pressed={selectedCategory === 'All'} onClick={() => setSelectedCategory('All')} className={chip}>
          All (<span className="tabular-nums">{initialSkills.length}</span>)
        </button>
        {categories.map((cat) => (
          <button
            key={cat.name}
            type="button"
            aria-pressed={selectedCategory.toLowerCase() === cat.name.toLowerCase()}
            onClick={() => setSelectedCategory(cat.name)}
            className={chip}
          >
            {cat.name} (<span className="tabular-nums">{cat.count}</span>)
          </button>
        ))}
      </div>

      {filteredSkills.length > 0 ? (
        <ul className="grid grid-cols-1 border-l border-t border-phino-border md:grid-cols-2 xl:grid-cols-3">
          {filteredSkills.map((skill) => (
            <li key={skill.slug} className="border-b border-r border-phino-border">
              <SkillCard skill={skill} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mx-auto max-w-lg rounded-lg border border-dashed border-phino-border-strong bg-phino-surface p-10 text-center sm:p-12">
          <SlidersHorizontal className="mx-auto h-7 w-7 text-phino-text-subtle" aria-hidden="true" />
          <h3 className="mt-4 font-display text-lg font-medium text-phino-text">
            No reactive skills matched your filter
          </h3>
          <p className="mt-1.5 text-sm text-phino-text-muted">
            {search.trim() ? (
              <span>
                No published skill matched <strong className="font-mono text-phino-text">&quot;{search.trim()}&quot;</strong>.
              </span>
            ) : (
              'Try adjusting your search query or selecting a different category filter.'
            )}
          </p>

          <p className="mt-4 text-sm text-phino-text-muted">
            Ask your agent to create it with <Link href="/docs/quickstart#create-a-skill" className="text-phino-signal-text underline">skill-manager</Link>.
          </p>
          <CommandBlock className="mt-5 text-left" command={CREATE_SKILL_PROMPT} caption="Ask your agent" prompt wrap />

          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-md border border-phino-border-strong px-4 py-2 text-xs font-medium text-phino-text hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              Reset all filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
