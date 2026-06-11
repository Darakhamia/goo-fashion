// Shown while the look is fetched on a direct hit, so the page paints
// immediately instead of staying blank.
export default function LoadingSharedLook() {
  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-8 h-3 w-48 rounded bg-[var(--surface)] animate-pulse" />
        <div className="mt-8 md:mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="rounded-2xl border border-[var(--border)] overflow-hidden">
            <div className="aspect-[3/4] bg-[var(--surface)] animate-pulse" />
          </div>
          <div className="rounded-2xl border border-[var(--border)] px-6 md:px-10 py-8 md:py-12">
            <div className="h-3 w-24 rounded bg-[var(--surface)] animate-pulse" />
            <div className="mt-4 h-9 w-2/3 rounded bg-[var(--surface)] animate-pulse" />
            <div className="mt-6 flex gap-6">
              <div className="h-10 w-24 rounded bg-[var(--surface)] animate-pulse" />
              <div className="h-10 w-16 rounded bg-[var(--surface)] animate-pulse" />
            </div>
            <div className="mt-10 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[72px] rounded-xl bg-[var(--surface)] animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
