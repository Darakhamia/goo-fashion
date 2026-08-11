"use client";

import { useEffect, useState } from "react";

/**
 * A hairline at the very top of the viewport tracking how far through the
 * article the reader is.
 *
 * z-40, one rung under the sticky header (Navigation sits at 50): the header is
 * a floating pill inset from the top edge, so the two never actually overlap,
 * and the ladder stays the one documented in DESIGN_SYSTEM.md §3.
 *
 * No transition on the width — the bar has to track the scroll position exactly
 * rather than easing towards it. It is driven by scroll, not by a loop, so the
 * global prefers-reduced-motion guard has nothing to switch off here.
 */
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, doc.scrollTop / scrollable)) : 0);
    };

    const onScroll = () => {
      // Coalesce to one measurement per frame: scroll fires far more often.
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div aria-hidden className="fixed top-0 left-0 right-0 z-40 h-[2px] pointer-events-none">
      <div
        className="h-full bg-[var(--foreground)] origin-left"
        style={{ transform: `scaleX(${progress})`, width: "100%" }}
      />
    </div>
  );
}
