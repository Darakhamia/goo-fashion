"use client";

import { useEffect } from "react";

/**
 * Slides the layered light on a glass element horizontally to follow the
 * cursor. The glow itself is a fixed composite (core + small glow + large glow
 * + rim, in two parts — a big bottom one and a smaller top one shifted left);
 * this controller only translates that whole composite on one axis via the
 * `--glow-tx` CSS variable, easing it with a requestAnimationFrame lerp so the
 * light trails the cursor smoothly and returns to centre on leave.
 *
 * Targets both `.glass-btn` (buttons/chips/card feet) and `.glass-nav` (the
 * header bar). Global + delegated → works on every current/future element.
 */
export default function GlassGlow() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const SELECTOR = ".glass-btn, .glass-nav";
    const EASE = 0.18;
    const MAX_FRACTION = 0.42; // cap the shift to 42% of the half-width

    let el: HTMLElement | null = null;
    let tx = 0; // target shift (px)
    let cx = 0; // current shift (px)
    let raf = 0;
    let returning = false;

    const apply = () => {
      if (el) el.style.setProperty("--glow-tx", `${cx.toFixed(1)}px`);
    };

    const tick = () => {
      cx += (tx - cx) * EASE;
      apply();
      if (Math.abs(tx - cx) > 0.3) {
        raf = requestAnimationFrame(tick);
        return;
      }
      raf = 0;
      cx = tx;
      apply();
      if (returning && el) {
        el.style.removeProperty("--glow-tx");
        el = null;
        returning = false;
      }
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const target =
        e.target instanceof Element
          ? (e.target.closest(SELECTOR) as HTMLElement | null)
          : null;
      if (!target) return;
      if (target !== el) {
        if (el) el.style.removeProperty("--glow-tx");
        el = target;
        cx = 0;
      }
      returning = false;
      const r = target.getBoundingClientRect();
      if (!r.width) return;
      const half = r.width / 2;
      const cap = half * MAX_FRACTION;
      tx = Math.max(-cap, Math.min(cap, e.clientX - r.left - half));
      kick();
    };

    const onOut = (e: PointerEvent) => {
      const target =
        e.target instanceof Element
          ? (e.target.closest(SELECTOR) as HTMLElement | null)
          : null;
      if (target && target === el && !target.contains(e.relatedTarget as Node | null)) {
        tx = 0;
        returning = true;
        kick();
      }
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
