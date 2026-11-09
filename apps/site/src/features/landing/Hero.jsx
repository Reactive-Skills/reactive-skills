import Link from 'next/link';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import avif768 from './images/runtime-object-768.avif';
import avif1536 from './images/runtime-object-1536.avif';
import webp768 from './images/runtime-object-768.webp';
import webp1536 from './images/runtime-object-1536.webp';

/**
 * Landing hero: wordmark, tagline and actions leading to the use/create paths.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=4
 */
export function Hero() {
  return (
    <section className="hero-stage relative isolate overflow-hidden bg-phino-hero text-phino-hero-ink" aria-labelledby="hero-heading">
      <picture>
        <source type="image/avif" srcSet={`${avif768.src} 768w, ${avif1536.src} 1536w`} sizes="100vw" />
        {/* Static export has no image optimizer, so the picture element serves the pre-encoded AVIF and WebP files. */}
        <img
          src={webp1536.src}
          srcSet={`${webp768.src} 768w, ${webp1536.src} 1536w`}
          sizes="100vw"
          width={1536}
          height={1024}
          alt="Five glass and aluminum modules connected in sequence, a sculptural picture of the runtime"
          fetchPriority="high"
          className="hero-object"
        />
      </picture>

      <div className="hero-copy mx-auto max-w-[1400px] px-5 pt-12 sm:px-10 sm:pt-16">
        <div className="flex items-center justify-between font-mono text-[11px] text-phino-hero-muted">
          <p className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-phino-lime" aria-hidden="true" /> EVENT-DRIVEN AGENT RUNTIME
          </p>
          <span className="hidden sm:block">STRUCTURE IS THE DIFFERENCE.</span>
        </div>
        <h1 id="hero-heading" className="hero-title mt-8 font-display">
          Reactive Skills<span className="text-phino-lime">.</span>
        </h1>
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-10">
          <p className="max-w-md text-lg leading-relaxed text-phino-hero-muted">
            Your agent has skills.
            <br />
            <span className="text-phino-hero-ink">Give them a nervous system.</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="#start"
              className="inline-flex h-12 items-center gap-2 rounded-sm bg-phino-lime px-6 text-sm font-medium text-phino-hero transition-opacity hover:opacity-90"
            >
              Get started <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a
              href="#runtime"
              className="inline-flex h-12 items-center gap-2 rounded-sm border border-phino-hero-muted/40 bg-phino-hero/60 px-5 text-sm font-medium text-phino-hero-ink transition-colors hover:bg-phino-hero"
            >
              See it react <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-phino-hero-muted/25 bg-phino-hero/80 px-5 py-5 backdrop-blur sm:px-10">
        <div className="mx-auto flex max-w-[1320px] flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <p className="font-mono text-[11px] text-phino-hero-muted">START WITH A TASK.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-phino-lime">
            <Link href="/registry" className="underline underline-offset-4">Use a skill</Link>
            <Link href="/docs/quickstart#create-a-skill" className="underline underline-offset-4">Create a skill with your agent</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
