// Body text classes for DocSections. Docs keep the compact muted style; the blog
// gets a larger size and a tone between phino-text and phino-text-muted for long reading.
const BLOG_BODY_SIZE = 'text-base sm:text-[17px]';
const BLOG_BODY_TEXT = `${BLOG_BODY_SIZE} leading-8 text-phino-text/85`;

export const PROSE_VARIANTS = {
  docs: {
    text: 'text-[15px] leading-7 text-phino-text-muted',
    stepTitle: 'text-sm',
    stepText: 'text-sm leading-relaxed text-phino-text-muted',
    bullet: 'mt-2.5',
  },
  blog: {
    text: BLOG_BODY_TEXT,
    stepTitle: BLOG_BODY_SIZE,
    stepText: BLOG_BODY_TEXT,
    bullet: 'mt-[13px]',
  },
};

export function getProseVariant(variant) {
  return PROSE_VARIANTS[variant] ?? PROSE_VARIANTS.docs;
}
