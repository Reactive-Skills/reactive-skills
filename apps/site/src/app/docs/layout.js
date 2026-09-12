import { getDocsContentSource } from '@/infrastructure/container';
import { DocsShell } from '@/features/docs/DocsShell';

export default function DocsLayout({ children }) {
  const navigation = getDocsContentSource().getNavigation();
  return <DocsShell navigation={navigation}>{children}</DocsShell>;
}
