"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function BugButtonInner() {
  const params = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const fromUrl = params.get("internal") === "true";
    const fromStorage = typeof window !== "undefined" && localStorage.getItem("internal") === "true";
    if (fromUrl) {
      localStorage.setItem("internal", "true");
      setShow(true);
    } else if (fromStorage) {
      setShow(true);
    }
  }, [params]);

  if (!show) return null;

  return (
    <Link
      href="/report?internal=true"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#1a1a1a] border border-white/10 hover:border-white/25 text-white/70 hover:text-white text-sm font-medium shadow-lg backdrop-blur-sm transition-all hover:scale-105"
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
