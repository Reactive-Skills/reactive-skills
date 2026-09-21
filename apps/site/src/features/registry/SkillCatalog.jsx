'use client';

import { useState, useMemo } from 'react';
import { Search, X, Sparkles, SlidersHorizontal, Terminal } from 'lucide-react';
import { CopyButton } from '@/components/common/CopyButton';
import { SkillCard } from './SkillCard';
import { cn } from '@/lib/utils';

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

  return (
    <div className="space-y-8">
      {/* Controls Bar: Search & Category Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-phino-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills by name, tag, or description..."
            className="w-full rounded-lg border border-phino-border bg-phino-surface py-2 pl-10 pr-9 text-sm text-phino-text placeholder:text-phino-text-muted focus:border-phino-signal focus:outline-none focus:ring-2 focus:ring-phino-focus/25"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-phino-text-muted hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus rounded"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Results Counter */}
        <div className="text-xs text-phino-text-muted flex items-center gap-1.5 self-start sm:self-auto">
          <Sparkles className="h-3.5 w-3.5 text-phino-signal" aria-hidden="true" />
          <span>
            Showing <strong className="font-mono tabular-nums font-semibold text-phino-text">{filteredSkills.length}</strong> of{' '}
            <strong className="font-mono tabular-nums font-semibold text-phino-text">{initialSkills.length}</strong> skills
          </span>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter by category">
        <button
          type="button"
          onClick={() => setSelectedCategory('All')}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
            selectedCategory === 'All'
              ? 'bg-phino-text text-phino-canvas font-semibold'
              : 'border border-phino-border bg-phino-surface text-phino-text-muted hover:border-phino-border-strong hover:text-phino-text',
          )}
        >
          All (<span className="font-mono tabular-nums">{initialSkills.length}</span>)
        </button>
        {categories.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setSelectedCategory(cat.name)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
              selectedCategory.toLowerCase() === cat.name.toLowerCase()
                ? 'bg-phino-text text-phino-canvas font-semibold'
                : 'border border-phino-border bg-phino-surface text-phino-text-muted hover:border-phino-border-strong hover:text-phino-text',
            )}
          >
            {cat.name} (<span className="font-mono tabular-nums">{cat.count}</span>)
          </button>
        ))}
      </div>

      {/* Grid of Skill Cards */}
      {filteredSkills.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredSkills.map((skill) => (
            <SkillCard key={skill.slug} skill={skill} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-xl border border-dashed border-phino-border bg-phino-surface/50 p-10 sm:p-12 text-center max-w-lg mx-auto">
          <SlidersHorizontal className="mx-auto h-8 w-8 text-phino-text-muted" aria-hidden="true" />
          <h3 className="mt-4 font-display text-base font-semibold text-phino-text">
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

          {search.trim() && (
            <div className="mt-5 rounded-lg border border-phino-border bg-phino-code-bg p-3 text-left">
              <div className="mb-2 flex items-center justify-between text-xs text-phino-text-muted">
                <span className="font-medium flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-phino-signal" aria-hidden="true" />
                  Scaffold with axi:
                </span>
                <CopyButton
                  value={`npx -y @reactive-skills/axi init ${search.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`}
                  size="sm"
                />
              </div>
              <code className="font-mono text-xs text-phino-code-text block overflow-x-auto">
                npx -y @reactive-skills/axi init {search.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')}
              </code>
            </div>
          )}

          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-md border border-phino-border-strong bg-phino-surface-raised px-4 py-2 text-xs font-semibold text-phino-text hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
            >
              Reset all filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
