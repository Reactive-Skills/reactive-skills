'use client';

import { useEffect, useState } from 'react';

/**
 * Scroll progress (0 to 1) of an element through the viewport: 0 while its top sits at
 * `start` of the viewport height, 1 once it has travelled `distance` viewport heights past that.
 * Returns null under prefers-reduced-motion so callers render their static frame.
 */
export function useScrollProgress(ref, { start = 0.9, distance = 0.6 } = {}) {
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    const measure = () => {
      frame = 0;
      if (reduce.matches) {
        setProgress(null);
        return;
      }
      const { top } = node.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      setProgress(clampProgress((viewport * start - top) / (viewport * distance)));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reduce.addEventListener('change', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reduce.removeEventListener('change', schedule);
    };
  }, [ref, start, distance]);

  return progress;
}

export function clampProgress(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
