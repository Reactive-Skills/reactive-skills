import { getDocsContentSource } from '@/infrastructure/container';
import { notFound } from 'next/navigation';
import { DocPageView } from '@/features/docs/DocPageView';
import { RelatedPages } from '@/features/docs/RelatedPages';

const SLUG = 'reference/guards-and-deliverables';
const page = getDocsContentSource().getPage(SLUG);

export const metadata = page ? { title: page.title, description: page.summary } : {};

/**
 * Renders the guards reference through the existing docs boundary.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(n) in sections and blocks
 * - Cyclomatic Complexity (CC): target <=2
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=4
 */
export default function GuardsAndDeliverablesPage() {
  const doc = getDocsContentSource().getPage(SLUG);
  if (!doc) notFound();
  return (
    <div>
      <DocPageView page={doc} />
      <RelatedPages pages={doc.relatedPages} />
    </div>
  );
}
