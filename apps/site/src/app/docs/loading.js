import { LoadingState } from '@/components/common/States';

export default function DocsLoading() {
  return (
    <div className="max-w-2xl">
      <LoadingState label="Loading documentation" lines={5} />
    </div>
  );
}
