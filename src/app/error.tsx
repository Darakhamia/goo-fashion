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
      <p
        className="text-[56px] md:text-[80px] font-extrabold tracking-[0.18em] text-[var(--foreground)] leading-none"
        style={{ fontFamily: "var(--font-poppins), sans-serif" }}
      >
        GOO
      </p>
      <h1 className="mt-6 text-xl md:text-2xl font-semibold text-[var(--foreground)]">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm text-[var(--muted-foreground,rgba(128,128,128,0.9))]">
        An unexpected error occurred. It&apos;s on us — try again, or head back to the
        homepage.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={reset}
          className="px-6 py-3 rounded-full bg-[var(--foreground)] text-[var(--background)] text-sm font-semibold hover:opacity-80 transition-opacity"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-6 py-3 rounded-full border border-[var(--foreground)]/20 text-[var(--foreground)] text-sm font-semibold hover:bg-[var(--foreground)]/5 transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
