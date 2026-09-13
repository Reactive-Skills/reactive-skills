'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { useTheme } from 'next-themes';
import { Eye, Code2, AlertCircle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { cn } from '@/lib/utils';

export function MermaidViewer({ chart, title = 'Statechart Topology', className, activeState }) {
  const [view, setView] = useState('diagram'); // 'diagram' | 'code'
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const { resolvedTheme } = useTheme();
  const containerRef = useRef(null);
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '_');

  useEffect(() => {
    let isMounted = true;

    async function renderChart() {
      if (!chart) return;
      setError(null);

      try {
        const mermaid = (await import('mermaid')).default;

        const isDark = resolvedTheme === 'dark';

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: isDark ? 'dark' : 'neutral',
          themeVariables: isDark
            ? {
                darkMode: true,
                background: '#0c0e13',
                primaryColor: '#13161c',
                primaryTextColor: '#e9edf3',
                primaryBorderColor: '#333a47',
                lineColor: '#2dd4bf',
                secondaryColor: '#06070a',
                tertiaryColor: '#212530',
                noteBkgColor: '#13161c',
                noteTextColor: '#e9edf3',
                fontSize: '13px',
                fontFamily: 'ui-monospace, monospace',
              }
            : {
                darkMode: false,
                background: '#ffffff',
                primaryColor: '#f4f5f7',
                primaryTextColor: '#0d1117',
                primaryBorderColor: '#cfd4dc',
                lineColor: '#0d9488',
                secondaryColor: '#ffffff',
                tertiaryColor: '#e4e7ec',
                noteBkgColor: '#f4f5f7',
                noteTextColor: '#0d1117',
                fontSize: '13px',
                fontFamily: 'ui-monospace, monospace',
              },
        });

        const id = `mermaid_${uniqueId}_${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);

        if (isMounted) {
          // Ensure rendered SVG is responsive
          const responsiveSvg = renderedSvg.replace(
            /<svg\s+([^>]+)>/i,
            '<svg $1 style="max-width: 100%; height: auto; display: block; margin: 0 auto;">',
          );
          setSvg(responsiveSvg);
        }
      } catch (err) {
        console.warn('Mermaid render error:', err);
        if (isMounted) {
          setError(err?.message || 'Failed to render statechart');
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart, resolvedTheme, uniqueId]);

  useEffect(() => {
    if (!containerRef.current || !activeState || !svg) return;
    try {
      const stateElements = containerRef.current.querySelectorAll('g.node, g.state, g[id*="state"]');
      stateElements.forEach((el) => {
        const textContent = el.textContent?.trim() || '';
        const id = el.id || '';
        const isMatch = textContent.includes(activeState) || id.toLowerCase().includes(activeState.toLowerCase());

        const rects = el.querySelectorAll('rect, polygon, circle, path');
        if (isMatch) {
          el.classList.add('active-hsm-state');
          rects.forEach((r) => {
            r.style.stroke = '#2dd4bf';
            r.style.strokeWidth = '3px';
            r.style.filter = 'drop-shadow(0 0 10px rgba(45, 212, 191, 0.8))';
          });
        } else {
          el.classList.remove('active-hsm-state');
          rects.forEach((r) => {
            r.style.stroke = '';
            r.style.strokeWidth = '';
            r.style.filter = '';
          });
        }
      });
    } catch {
      // ignore DOM styling exceptions
    }
  }, [svg, activeState]);

  return (
    <div className={cn('overflow-hidden rounded-xl border border-phino-border bg-phino-surface', className)}>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-phino-border px-4 py-3 bg-phino-surface-raised/50">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold text-phino-text">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle (Diagram vs Code) */}
          <div className="flex items-center rounded-lg border border-phino-border bg-phino-canvas p-0.5">
            <button
              type="button"
              onClick={() => setView('diagram')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
                view === 'diagram'
                  ? 'bg-phino-surface-raised text-phino-text shadow-sm'
                  : 'text-phino-text-muted hover:text-phino-text',
              )}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Diagram</span>
            </button>
            <button
              type="button"
              onClick={() => setView('code')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
                view === 'code'
                  ? 'bg-phino-surface-raised text-phino-text shadow-sm'
                  : 'text-phino-text-muted hover:text-phino-text',
              )}
            >
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Code</span>
            </button>
          </div>

          {/* Zoom controls (diagram mode only) */}
          {view === 'diagram' && !error && svg && (
            <div className="hidden sm:flex items-center gap-1 border-l border-phino-border pl-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 0.2, 2.0))}
                className="rounded p-1 text-phino-text-muted hover:bg-phino-canvas hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
                title="Zoom in"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 0.2, 0.6))}
                className="rounded p-1 text-phino-text-muted hover:bg-phino-canvas hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
                title="Zoom out"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              {zoom !== 1 && (
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="rounded p-1 text-phino-text-muted hover:bg-phino-canvas hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
                  title="Reset zoom"
                  aria-label="Reset zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Copy Button */}
          <CopyButton value={chart} label="Copy Mermaid" size="sm" />
        </div>
      </div>

      {/* Content Area */}
      <div className="relative">
        {view === 'diagram' ? (
          <div className="p-4 sm:p-6 overflow-x-auto min-h-[260px] flex items-center justify-center bg-phino-canvas/60">
            {error ? (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-phino-text-muted">
                <AlertCircle className="h-6 w-6 text-phino-danger-text" aria-hidden="true" />
                <p className="font-semibold text-phino-text">Diagram preview unavailable</p>
                <p className="max-w-md text-xs">{error}</p>
                <button
                  type="button"
                  onClick={() => setView('code')}
                  className="mt-2 text-xs text-phino-signal-text underline"
                >
                  View Mermaid source code instead
                </button>
              </div>
            ) : svg ? (
              <div
                ref={containerRef}
                className="w-full flex justify-center transition-transform duration-150 origin-center"
                style={{ transform: `scale(${zoom})` }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <div className="flex items-center gap-2 text-xs font-mono text-phino-text-subtle py-12">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-phino-signal border-t-transparent" />
                <span>Rendering statechart...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-phino-code-bg text-phino-code-text overflow-x-auto">
            <pre className="font-mono text-xs leading-relaxed whitespace-pre">{chart}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
