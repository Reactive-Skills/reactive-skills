'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { sortRegistryLog } from '@/lib/landing/flightRecorder';
import { cn } from '@/lib/utils';

const COLUMNS = [
  { key: 'name', label: 'Workflow' },
  { key: 'stateCount', label: 'States', numeric: true },
  { key: 'guardCount', label: 'Checks', numeric: true },
];

function SortHeader({ column, sort, onSort, className }) {
  const active = sort.key === column.key;
  const Arrow = sort.direction === 'desc' ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}
      className={cn('py-3 font-normal', column.numeric && 'text-right', className)}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={cn(
          'inline-flex items-center gap-1 uppercase transition-colors sm:tracking-wider hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
          active && 'text-phino-text',
        )}
      >
        {column.label}
        <Arrow className={cn('h-3 w-3', !active && 'hidden opacity-0 sm:inline')} aria-hidden="true" />
      </button>
    </th>
  );
}

export function RegistryLog({ rows }) {
  const [sort, setSort] = useState({ key: 'order', direction: 'asc' });
  const sorted = sortRegistryLog(rows, sort.key, sort.direction);

  const onSort = (key) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'name' ? 'asc' : 'desc' },
    );

  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Published workflows. Column headers sort the list.</caption>
      <thead className="border-y border-phino-border-strong font-mono text-xs text-phino-text-subtle">
        <tr>
          <SortHeader column={COLUMNS[0]} sort={sort} onSort={onSort} className="pr-2 sm:pr-4" />
          <th scope="col" className="hidden py-3 pr-4 font-normal uppercase tracking-wider md:table-cell">Kind of check</th>
          <SortHeader column={COLUMNS[1]} sort={sort} onSort={onSort} className="pr-2 sm:pr-4" />
          <SortHeader column={COLUMNS[2]} sort={sort} onSort={onSort} className="sm:pr-4" />
          <th scope="col" className="hidden py-3 text-right font-normal uppercase tracking-wider sm:table-cell">Version</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={row.slug} className="group border-b border-phino-border align-top transition-colors hover:bg-phino-surface">
            <td className="min-w-0 py-3.5 pr-2 sm:pr-4">
              <Link
                href={`/registry/${row.slug}`}
                className="font-display text-sm font-semibold tracking-tight text-phino-text underline decoration-transparent group-hover:decoration-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
              >
                {row.name}
              </Link>
              <span className="ml-2 font-mono text-xs text-phino-text-subtle">{row.category}</span>
              <p className="mt-1 max-w-[70ch] text-sm leading-relaxed text-phino-text-muted [overflow-wrap:anywhere] md:line-clamp-1">{row.note}</p>
            </td>
            <td className="hidden whitespace-nowrap py-3.5 pr-4 font-mono text-xs text-phino-text-muted md:table-cell">{row.kind}</td>
            <td className="py-3.5 pr-2 text-right font-mono sm:pr-4 text-sm tabular-nums text-phino-text">{row.stateCount}</td>
            <td className="py-3.5 text-right font-mono text-sm tabular-nums text-phino-text sm:pr-4">{row.guardCount}</td>
            <td className="hidden py-3.5 text-right font-mono text-xs tabular-nums text-phino-text-subtle sm:table-cell">v{row.version}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
