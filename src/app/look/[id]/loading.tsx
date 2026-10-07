// Shown while the look is fetched on a direct hit, so the page paints
// immediately instead of staying blank. Phones mirror the page's own phone
// layout (12px gutter, photo plaque, no framed info card — §12.2), with the
// skeleton fill of §12.14; desktop keeps the two framed columns.
export default function LoadingSharedLook() {
  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-3 md:px-12">
        <div className="hidden md:block pt-8 h-3 w-48 rounded bg-[var(--surface)] animate-pulse" />
        <div className="mt-3 md:mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
          <div className="rounded-3xl md:rounded-2xl md:border md:border-[var(--border)] overflow-hidden">
            <div className="aspect-[3/4] bg-[var(--fg-overlay-08)] md:bg-[var(--surface)] animate-pulse" />
          </div>
          <div className="md:rounded-2xl md:border md:border-[var(--border)] px-1 md:px-10 md:py-12">
            <div className="h-3 w-24 rounded bg-[var(--fg-overlay-08)] md:bg-[var(--surface)] animate-pulse" />
            <div className="mt-4 h-9 w-2/3 rounded bg-[var(--fg-overlay-08)] md:bg-[var(--surface)] animate-pulse" />
            <div className="mt-6 hidden md:flex gap-6">
              <div className="h-10 w-24 rounded bg-[var(--surface)] animate-pulse" />
              <div className="h-10 w-16 rounded bg-[var(--surface)] animate-pulse" />
            </div>
            <div className="mt-6 md:mt-10 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 md:h-[72px] rounded-2xl md:rounded-xl bg-[var(--fg-overlay-08)] md:bg-[var(--surface)] animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
