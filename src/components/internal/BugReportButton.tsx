"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";

// The flag only changes through this component, so there is nothing to subscribe to.
const subscribeNoop = () => () => {};
const readStoredFlag = () => {
  try {
    return localStorage.getItem("internal") === "true";
  } catch {
    return false;
  }
};

function BugButtonInner() {
  const params = useSearchParams();
  const fromUrl = params.get("internal") === "true";
  // The server has no localStorage, so it (and hydration) reads the flag as off.
  const fromStorage = useSyncExternalStore(subscribeNoop, readStoredFlag, () => false);

  // Remember ?internal=true, so the button stays on across pages.
  useEffect(() => {
    if (fromUrl) localStorage.setItem("internal", "true");
  }, [fromUrl]);

  if (!fromUrl && !fromStorage) return null;

  return (
    <Link
      href="/report?internal=true"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#1a1a1a] border border-white/10 hover:border-white/25 text-white/70 hover:text-white text-sm font-medium shadow-lg backdrop-blur-sm transition-[color,background-color,border-color,transform] hover:scale-105"
    >
      🐛 Bug
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
