"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/app/goo-studio/_i18n";
import { BTN_ICON_OUTLINE } from "@/app/goo-studio/_ui/recipes";
import { useOverlayPresence } from "@/lib/hooks/useOverlayPresence";

/*
 * "Back to top" (2026-10-27): an arrow in the bottom right corner once a long
 * list has been scrolled more than two screens down; it goes away at the top.
 * The admin scrolls <main>, not the window, so it watches and scrolls that.
 *
 * On a phone it sits above the page's pinned main action (PageHeader), and it
 * steps aside while the BulkBar holds the bottom of the screen. Put it
 * anywhere in the page.
 */

/** How far down it shows, in screens. */
const AFTER_SCREENS = 2;

export function BackToTop() {
  const t = useT();
  const anchor = useRef<HTMLSpanElement>(null);
  const [far, setFar] = useState(false);
  const ov = useOverlayPresence(far);

  useEffect(() => {
    const main = anchor.current?.closest("main");
    if (!main) return;
    const onScroll = () => setFar(main.scrollTop > main.clientHeight * AFTER_SCREENS);
    onScroll();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => {
    const main = anchor.current?.closest("main");
    if (!main) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    main.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
    // The button goes away at the top: the keyboard carries on from the
    // page's title rather than from nowhere.
    const title = main.querySelector<HTMLElement>("h1");
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  };

  return (
    <>
      <span ref={anchor} hidden />
      {ov.rendered && (
        <div
          className={`${ov.cls("ov-pop ov-pop-up")} fixed z-30 right-4 bottom-4 max-md:[body:has([data-pinned-action])_&]:bottom-[calc(3.75rem+max(1rem,env(safe-area-inset-bottom)))] md:right-6 md:bottom-6 [body:has([data-bulk-bar])_&]:hidden rounded-lg bg-[var(--surface)] shadow-[0_8px_24px_rgba(0,0,0,0.12)]`}
          onTransitionEnd={ov.onTransitionEnd}
        >
          <button
            type="button"
            onClick={toTop}
            aria-label={t("table.backToTop")}
            title={t("table.backToTop")}
            className={BTN_ICON_OUTLINE}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
