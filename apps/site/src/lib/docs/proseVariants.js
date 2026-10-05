// Body text classes for DocSections. Docs keep the compact muted style; the blog
// gets a larger size and a tone between phino-text and phino-text-muted for long reading.
const BLOG_BODY_TEXT = 'text-base leading-8 text-phino-text/85 sm:text-[17px]';

export const PROSE_VARIANTS = {
  docs: {
    text: 'text-[15px] leading-7 text-phino-text-muted',
    stepText: 'text-sm leading-relaxed text-phino-text-muted',
    bullet: 'mt-2.5',
  },
  blog: {
    text: BLOG_BODY_TEXT,
    stepText: BLOG_BODY_TEXT,
    bullet: 'mt-[13px]',
  },
};

export function getProseVariant(variant) {
  return PROSE_VARIANTS[variant] ?? PROSE_VARIANTS.docs;
}
