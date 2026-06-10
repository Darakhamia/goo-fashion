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
      body.dataset.prevOverflow = body.style.overflow;
      body.style.overflow = "hidden";
    }
    body.dataset.scrollLockCount = String(count + 1);

    return () => {
      const next = Number(body.dataset.scrollLockCount ?? "1") - 1;
      if (next <= 0) {
        body.style.overflow = body.dataset.prevOverflow ?? "";
        delete body.dataset.scrollLockCount;
        delete body.dataset.prevOverflow;
      } else {
        body.dataset.scrollLockCount = String(next);
      }
    };
  }, [active]);
}
