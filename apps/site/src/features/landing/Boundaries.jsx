import { Check } from 'lucide-react';

const BOUNDARIES = [
  'It does not make a model correct. It makes progress explicit and inspectable.',
  'It does not replace tests, reviews, or human decisions.',
  'It does not require a state machine for a one-off question or short script.',
  'It does not hide failed guards. Rejections remain visible in the run history.',
];

export function Boundaries() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {BOUNDARIES.map((text) => (
        <div key={text} className="flex gap-3 rounded-xl border border-phino-border bg-phino-surface p-4">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-phino-signal" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-phino-text-muted">{text}</p>
        </div>
      ))}
    </div>
  );
}
