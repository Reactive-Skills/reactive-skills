export default function Loading() {
  return (
    <div className="container py-24">
      <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
        <div className="mx-auto h-10 w-2/3 rounded-lg bg-phino-surface-raised" />
        <div className="mx-auto h-4 w-1/2 rounded bg-phino-surface-raised" />
        <div className="mx-auto mt-8 h-14 w-full max-w-xl rounded-xl bg-phino-surface-raised" />
      </div>
    </div>
  );
}
