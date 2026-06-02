"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BugButtonInner() {
  const params = useSearchParams();
  if (params.get("internal") !== "true") return null;

  return (
    <Link
      href="/report"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500/90 hover:bg-red-500 text-white text-sm font-medium shadow-lg backdrop-blur-sm transition-all hover:scale-105"
      title="Report a bug"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      Bug
    </Link>
  );
}

export default function BugReportButton() {
  return (
    <Suspense fallback={null}>
      <BugButtonInner />
    </Suspense>
  );
}
