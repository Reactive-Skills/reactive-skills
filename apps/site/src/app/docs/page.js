import { getDocsContentSource } from '@/infrastructure/container';
import { DocsOverview } from '@/features/docs/DocsOverview';
import { EmptyState } from '@/components/common/States';

export const metadata = {
  title: 'Documentation',
  description: 'Reactive Skills documentation — quickstart, concepts, MCP, and AXI.',
};

export default function DocsPage() {
  const content = getDocsContentSource();
  const overview = content.getPage('overview');
  const pages = content.listPages().filter((p) => p.slug !== 'overview');

  if (!overview) {
    return <EmptyState title="No documentation yet" description="The content source returned no overview page." />;
  }

  return <DocsOverview page={overview} pages={pages} />;
}
