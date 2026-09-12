import { getDocsContentSource } from '@/infrastructure/container';
import { notFound } from 'next/navigation';
import { DocsBreadcrumb } from '@/features/docs/DocsBreadcrumb';
import { DocPageView } from '@/features/docs/DocPageView';
import { RelatedPages } from '@/features/docs/RelatedPages';

const SLUG = 'quickstart';
const page = getDocsContentSource().getPage(SLUG);

export const metadata = page ? { title: page.title, description: page.summary } : {};

export default function QuickstartPage() {
  const doc = getDocsContentSource().getPage(SLUG);
  if (!doc) notFound();
  return (
    <div>
      <DocsBreadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Docs', href: '/docs' }, { label: doc.title }]} />
      <DocPageView page={doc} />
      <RelatedPages pages={doc.relatedPages} />
    </div>
  );
}
