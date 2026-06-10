import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center bg-[var(--background)]">
      <p
        className="text-[80px] md:text-[120px] font-extrabold tracking-[0.18em] text-[var(--foreground)] leading-none"
        style={{ fontFamily: "var(--font-poppins), sans-serif" }}
      >
        404
      </p>
      <h1 className="mt-6 text-xl md:text-2xl font-semibold text-[var(--foreground)]">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--muted-foreground,rgba(128,128,128,0.9))]">
        The look you&apos;re searching for may have been moved or removed. Let&apos;s get you
        back to something stylish.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="px-6 py-3 rounded-full bg-[var(--foreground)] text-[var(--background)] text-sm font-semibold hover:opacity-80 transition-opacity"
        >
          Back to home
        </Link>
        <Link
          href="/browse"
          className="px-6 py-3 rounded-full border border-[var(--foreground)]/20 text-[var(--foreground)] text-sm font-semibold hover:bg-[var(--foreground)]/5 transition-colors"
        >
          Browse fashion
        </Link>
      </div>
    </div>
  );
}
