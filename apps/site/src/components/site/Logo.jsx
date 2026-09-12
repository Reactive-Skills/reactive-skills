import { cn } from '@/lib/utils';

export function Logo({ className, showText = true }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="text-phino-signal">
        <path d="M5 6.5 L13 11 L21 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
        <path d="M5 19.5 L13 15 L21 19.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
        <path d="M13 11 L13 15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="5" cy="6.5" r="2.2" fill="currentColor" />
        <circle cx="21" cy="6.5" r="2.2" fill="currentColor" opacity="0.7" />
        <circle cx="13" cy="13" r="2.6" fill="currentColor" />
        <circle cx="5" cy="19.5" r="2.2" fill="currentColor" opacity="0.7" />
        <circle cx="21" cy="19.5" r="2.2" fill="currentColor" />
      </svg>
      {showText ? (
        <span className="font-display text-[15px] font-semibold tracking-tight text-phino-text">
          Reactive<span className="text-phino-text-subtle">Skills</span>
        </span>
      ) : null}
    </span>
  );
}
