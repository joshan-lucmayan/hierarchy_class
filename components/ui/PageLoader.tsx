/**
 * Shared route-loading fallback (rendered by each segment's loading file
 * while a page streams in). Server-safe - no hooks, pure tokens.
 */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <span
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-sealion"
      />
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-faint">{label}...</p>
    </div>
  );
}
