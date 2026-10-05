"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept up to date as the window resizes or the
 * phone turns. On the server, and in the first render after it, the answer is
 * `serverValue`; the real one follows straight after hydration.
 *
 * ```tsx
 * const phone = useMediaQuery("(width < 48rem)"); // Tailwind's below `md:`
 * ```
 *
 * For a layout that CSS alone can switch, prefer the `md:` classes: this is
 * for a component that renders different markup on a phone (DataTable's card
 * list, the filter sheet), where hiding one of two copies would double the
 * rows, their photos and their menus.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}
