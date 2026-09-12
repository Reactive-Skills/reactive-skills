'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function TableOfContents({ sections }) {
  const [activeId, setActiveId] = useState(sections?.[0]?.id || '');

  useEffect(() => {
    if (!sections || sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting section or the top-most visible one
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setActiveId(visibleEntry.target.id);
        }
      },
      {
        rootMargin: '-80px 0% -60% 0%',
        threshold: 0.1,
      }
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  if (!sections || sections.length <= 1) return null;

  return (
    <nav aria-label="On this page" className="space-y-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-phino-text-subtle">On this page</p>
      <ul className="space-y-0.5 border-l border-phino-border">
        {sections.map((section) => {
          const isActive = activeId === section.id;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  const target = document.getElementById(section.id);
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    window.history.pushState(null, '', `#${section.id}`);
                    setActiveId(section.id);
                  }
                }}
                className={cn(
                  '-ml-px block border-l-2 py-1 pl-3 text-xs leading-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
                  isActive
                    ? 'border-l-phino-signal font-medium text-phino-signal-text'
                    : 'border-l-transparent text-phino-text-muted hover:border-l-phino-border-strong hover:text-phino-text',
                )}
              >
                {section.heading}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
