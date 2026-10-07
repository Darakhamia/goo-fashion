import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center bg-[var(--background)]">
      <p
        // Phones: a quiet 64px numeral in the strong-border tone (mockup v2).
        className="text-[64px] md:text-[120px] font-extrabold tracking-[0.08em] md:tracking-[0.18em] text-[var(--border-strong)] md:text-[var(--foreground)] leading-none"
        style={{ fontFamily: "var(--font-poppins), sans-serif" }}
      >
        404
      </p>
      <h1 className="mt-6 text-xl md:text-2xl font-semibold text-[var(--foreground)] max-md:mt-3 max-md:text-[22px]">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--foreground-muted)] max-md:mt-2 max-md:text-[15px] max-md:leading-[1.5]">
        The look you&apos;re searching for may have been moved or removed. Let&apos;s get you
        back to something stylish.
      </p>
      {/* Phones (mockup v2): one filled pill, the other action as plain text under it. */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 max-md:mt-6 max-md:flex-col max-md:gap-1.5">
        <Link
          href="/"
          className="px-6 py-3 rounded-full bg-[var(--foreground)] text-[var(--background)] text-sm font-semibold hover:opacity-80 transition-opacity max-md:inline-flex max-md:h-12 max-md:items-center max-md:py-0 max-md:text-[15px]"
        >
          Back to home
        </Link>
        <Link
          href="/browse"
          className="px-6 py-3 rounded-full border border-[var(--foreground)]/20 text-[var(--foreground)] text-sm font-semibold hover:bg-[var(--foreground)]/5 transition-colors max-md:inline-flex max-md:h-11 max-md:items-center max-md:px-4 max-md:py-0 max-md:border-0 max-md:text-[15px] max-md:font-normal"
        >
          Browse fashion
        </Link>
      </div>
    </div>
  );
}
