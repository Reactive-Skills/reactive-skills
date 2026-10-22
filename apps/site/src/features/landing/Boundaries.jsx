const BOUNDARIES = [
  'It does not make a model correct. It makes progress explicit and inspectable.',
  'It does not replace tests, reviews, or human decisions.',
  'It does not require a state machine for a one-off question or short script.',
  'It does not hide failed guards. Rejections remain visible in the run history.',
];

export function Boundaries() {
  return (
    <ul className="grid border-t border-phino-border md:grid-cols-2 md:gap-x-12">
      {BOUNDARIES.map((text) => (
        <li key={text} className="border-b border-phino-border py-4 text-sm leading-relaxed text-phino-text-muted">
          {text}
        </li>
      ))}
    </ul>
  );
}
