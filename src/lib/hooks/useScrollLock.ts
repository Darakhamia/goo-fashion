"use client";

import { useEffect } from "react";

/**
 * Locks body scroll while `active` is true (e.g. when a drawer/modal is open),
 * so the page underneath an overlay doesn't scroll on mobile. Restores the
 * previous overflow value on cleanup, and tolerates several overlays being
 * open at once via a simple ref-count on a data attribute.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const body = document.body;
    const count = Number(body.dataset.scrollLockCount ?? "0");
    if (count === 0) {
      // Hiding the scrollbar widens the viewport, which slides centred content
      // sideways — the whole page visibly jumps right the moment an overlay
      // opens. Reserve the scrollbar's width so nothing moves. Browsers with
      // overlay scrollbars report 0 here and need no padding.
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      body.dataset.prevOverflow = body.style.overflow;
      body.dataset.prevPaddingRight = body.style.paddingRight;
      body.style.overflow = "hidden";
      if (scrollbar > 0) {
        const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
        body.style.paddingRight = `${current + scrollbar}px`;
      }
    }
    body.dataset.scrollLockCount = String(count + 1);

    return () => {
      const next = Number(body.dataset.scrollLockCount ?? "1") - 1;
      if (next <= 0) {
        body.style.overflow = body.dataset.prevOverflow ?? "";
        body.style.paddingRight = body.dataset.prevPaddingRight ?? "";
        delete body.dataset.scrollLockCount;
        delete body.dataset.prevOverflow;
        delete body.dataset.prevPaddingRight;
      } else {
        body.dataset.scrollLockCount = String(next);
      }
    };
  }, [active]);
}
