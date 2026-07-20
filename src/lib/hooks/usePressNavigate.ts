"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** How long the press animation is held before we actually navigate. Short
 *  enough to feel snappy, long enough that the glass "press" is seen instead of
 *  being cut off by an instant client-side route change. */
const PRESS_MS = 190;

/**
 * Plays a quick press animation on a link/card before navigating, so the glass
 * press effect is visible rather than swallowed by an instant route change.
 *
 * Returns `pressed` (toggle the `is-pressing` class with it) and an `onClick`
 * to put on the <Link>. Modified clicks (new tab, middle button) and
 * reduced-motion users navigate normally, untouched — no delay, no animation.
 */
export function usePressNavigate(href: string) {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Prefetch so the delayed navigation still lands instantly.
    router.prefetch?.(href);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [href, router]);

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // Leave new-tab / modified / non-primary clicks to the browser.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return; // nothing to show — let the link navigate normally

      e.preventDefault();
      setPressed(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.push(href), PRESS_MS);
    },
    [href, router]
  );

  return { pressed, onClick };
}
