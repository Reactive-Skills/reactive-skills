'use client';

import { useState, useMemo } from 'react';
import { Search, X, Sparkles, SlidersHorizontal } from 'lucide-react';
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
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-phino-text-subtle"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills by name, tag, or description..."
            className="w-full rounded-lg border border-phino-border bg-phino-surface py-2 pl-10 pr-9 text-sm text-phino-text placeholder:text-phino-text-subtle focus:border-phino-signal focus:outline-none focus:ring-1 focus:ring-phino-focus"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-phino-text-subtle hover:text-phino-text"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Results Counter */}
        <div className="text-xs font-mono text-phino-text-muted flex items-center gap-1.5 self-start sm:self-auto">
          <Sparkles className="h-3.5 w-3.5 text-phino-signal" aria-hidden="true" />
          <span>
            Showing <strong className="text-phino-text">{filteredSkills.length}</strong> of{' '}
            {initialSkills.length} skills
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
          All ({initialSkills.length})
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
            {cat.name} ({cat.count})
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
        <div className="rounded-xl border border-dashed border-phino-border bg-phino-surface/50 p-12 text-center">
          <SlidersHorizontal className="mx-auto h-8 w-8 text-phino-text-subtle" aria-hidden="true" />
          <h3 className="mt-4 font-display text-base font-semibold text-phino-text">
            No reactive skills matched your filter
          </h3>
          <p className="mt-1 text-sm text-phino-text-muted max-w-sm mx-auto">
            Try adjusting your search query or selecting a different category filter.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-phino-border-strong bg-phino-surface-raised px-4 py-2 text-xs font-semibold text-phino-text hover:border-phino-signal"
          >
            Reset all filters
          </button>
        </div>
      )}
    </div>
  );
}
