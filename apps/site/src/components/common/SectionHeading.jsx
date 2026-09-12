import { cn } from '@/lib/utils';

export function SectionHeading({ eyebrow, title, description, align = 'left', className }) {
  return (
    <div className={cn(align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}>
      {eyebrow ? (
        <div className={cn('mb-3 flex items-center gap-2', align === 'center' && 'justify-center')}>
          <span className="h-px w-6 bg-phino-signal" aria-hidden="true" />
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-phino-signal-text">{eyebrow}</span>
        </div>
      ) : null}
      <h2 className="font-display text-2xl font-semibold tracking-tight text-phino-text sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 text-base leading-relaxed text-phino-text-muted">{description}</p> : null}
    </div>
  );
}
