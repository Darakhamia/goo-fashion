"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

/*
 * What every admin dialog does (GS4-9), for Modal and SidePanel alike:
 * - focus goes to the first field, or else to the first button, and back to
 *   whatever opened the dialog when it closes;
 * - Escape closes it;
 * - Tab stays inside;
 * - the page under it does not scroll.
 *
 * Keys are heard on window, after the document: a ConfirmDialog or a menu
 * opened on top listens on the document and marks the key it handled, so its
 * Escape closes only itself.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const FIELD = "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])";

export function useDialog(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose);
  useScrollLock(open);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // A field in a folded section cannot take focus: only what is shown counts.
    const shown = (selector: string) =>
      [...(panel?.querySelectorAll<HTMLElement>(selector) ?? [])].find((el) => el.offsetParent !== null);
    const focusFirst = () => (shown(FIELD) ?? shown(FOCUSABLE) ?? panel)?.focus({ preventScroll: true });
    focusFirst();
    // An editor fills its form a moment after it opens, and the field that had
    // focus is replaced: try once more when it has settled.
    const retry = window.setTimeout(() => {
      if (!panelRef.current?.contains(document.activeElement)) focusFirst();
    }, 80);

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const el = panelRef.current;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      // Kept inside only while focus is inside: a dialog on top keeps its own.
      if (e.key !== "Tab" || !el || !el.contains(document.activeElement)) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(retry);
      window.removeEventListener("keydown", onKey);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, panelRef]);
}
