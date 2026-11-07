'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { useTheme } from 'next-themes';
import { Eye, Code2, AlertCircle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { cn } from '@/lib/utils';

const DARK_BASE = {
  darkMode: true,
  background: '#0a0a0a',
  primaryColor: '#121212',
  primaryTextColor: '#ebeff2',
  primaryBorderColor: '#4d4d4d',
  lineColor: '#c1f354',
  secondaryColor: '#1d1d1d',
  tertiaryColor: '#0a0a0a',
};

const LIGHT_BASE = {
  darkMode: false,
  background: '#f8fafd',
  primaryColor: '#ffffff',
  primaryTextColor: '#151b24',
  primaryBorderColor: '#c2c8cf',
  lineColor: '#455c01',
  secondaryColor: '#f3f6f9',
  tertiaryColor: '#f8fafd',
};

const THEME_CSS = `
  .node rect, .node polygon, .statediagram-state rect, .basic.label-container { fill: var(--phino-surface) !important; stroke: var(--phino-border-strong) !important; }
  .statediagram-cluster rect, .cluster rect { fill: var(--phino-canvas) !important; stroke: var(--phino-border) !important; }
  .statediagram-cluster rect.inner, .composit { fill: var(--phino-surface-sunken) !important; }
  text, .nodeLabel, .label, .stateLabel text, .cluster-label text, .state-title { fill: var(--phino-text) !important; color: var(--phino-text) !important; }
  .transition, path.relation, .flowchart-link { stroke: var(--phino-signal) !important; }
  marker path, marker circle, [id$="barbEnd"] path { fill: var(--phino-signal) !important; stroke: var(--phino-signal) !important; }
  .edgeLabel, .edgeLabel p, .edgeLabel span, .labelBkg { background-color: var(--phino-canvas) !important; color: var(--phino-text-muted) !important; }
  .edgeLabel rect { fill: var(--phino-canvas) !important; }
  .state-start, circle.state-start { fill: var(--phino-text) !important; stroke: var(--phino-text) !important; }
  .state-end { fill: var(--phino-text) !important; stroke: var(--phino-canvas) !important; }
  .node circle.state-end + circle, .end-state-inner { fill: var(--phino-canvas) !important; }
  .note rect, .statediagram-note rect, .state-note { fill: var(--phino-guard-soft) !important; stroke: var(--phino-guard) !important; }
  .note text, .statediagram-note text { fill: var(--phino-text) !important; }
`;

/**
 * Mermaid statechart with diagram and source views, zoom, copy, and an optional highlighted state.
 * The diagram is themed from the site tokens and re-renders when the theme changes.
 *
 * # Performance & Risk Budget
 * - Tier: P2 (client render; Mermaid loads on demand)
 * - Complexity: O(n) in the n diagram nodes, per render
 * - Cyclomatic Complexity (CC): target <=12
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=24
 */
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

        // khroma only parses hex, rgb and hsl, so the base palette is the tokens' sRGB values and
        // THEME_CSS repaints the rendered SVG from the live --phino-* custom properties.
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'base',
          themeVariables: { ...(isDark ? DARK_BASE : LIGHT_BASE), fontSize: '13px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
          themeCSS: THEME_CSS,
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
            r.style.stroke = 'var(--phino-signal)';
            r.style.strokeWidth = '3px';
            r.style.filter = 'drop-shadow(0 0 8px color-mix(in srgb, var(--phino-signal) 70%, transparent))';
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
    <div className={cn('overflow-hidden rounded-lg border border-phino-border bg-phino-surface', className)}>
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-phino-border px-4 py-3 bg-phino-surface-raised/50">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-phino-text-muted [overflow-wrap:anywhere]">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle (Diagram vs Code) */}
          <div className="flex items-center rounded-md border border-phino-border bg-phino-canvas p-0.5">
            <button
              type="button"
              onClick={() => setView('diagram')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
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
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
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
