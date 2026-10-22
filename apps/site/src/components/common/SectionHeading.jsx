import { cn } from '@/lib/utils';

export function SectionHeading({ id, title, description, align = 'left', className }) {
  return (
    <div className={cn(align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}>
      <h2 id={id} className="font-display text-2xl font-bold tracking-[-0.03em] text-phino-text [text-wrap:balance] sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 text-base leading-relaxed text-phino-text-muted">{description}</p> : null}
    </div>
  );
}
