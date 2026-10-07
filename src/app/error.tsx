"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center bg-[var(--background)]">
      {/* Phones: a soft round warning sign instead of the wordmark (mockup v2). */}
      <span aria-hidden="true" className="md:hidden flex h-16 w-16 items-center justify-center rounded-full bg-[var(--fg-overlay-08)] text-[var(--foreground-muted)]">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8v5M12 16.5v.01" />
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      </span>
      <p
        className="text-[56px] md:text-[80px] font-extrabold tracking-[0.18em] text-[var(--foreground)] leading-none max-md:hidden"
        style={{ fontFamily: "var(--font-poppins), sans-serif" }}
      >
        GOO
      </p>
      <h1 className="mt-6 text-xl md:text-2xl font-semibold text-[var(--foreground)] max-md:mt-[18px] max-md:text-[22px]">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--foreground-muted)] max-md:mt-2 max-md:text-[15px] max-md:leading-[1.5]">
        An unexpected error occurred. It&apos;s on us — try again, or head back to the
        homepage.
      </p>
      {/* Phones (mockup v2): one filled pill, the other action as plain text under it. */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 max-md:mt-6 max-md:flex-col max-md:gap-1.5">
        <button
          onClick={reset}
          className="px-6 py-3 rounded-full bg-[var(--foreground)] text-[var(--background)] text-sm font-semibold hover:opacity-80 transition-opacity max-md:inline-flex max-md:h-12 max-md:items-center max-md:py-0 max-md:text-[15px]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-6 py-3 rounded-full border border-[var(--foreground)]/20 text-[var(--foreground)] text-sm font-semibold hover:bg-[var(--foreground)]/5 transition-colors max-md:inline-flex max-md:h-11 max-md:items-center max-md:px-4 max-md:py-0 max-md:border-0 max-md:text-[15px] max-md:font-normal"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
