"use client";

import { useEffect } from "react";

/**
 * Makes the soft white light on every `.glass-btn` follow the cursor.
 *
 * One delegated `pointermove` listener on the document finds the glass button
 * under the pointer and drives its `--gx` / `--gy` CSS variables (the radial
 * light's centre, in %). A requestAnimationFrame lerp eases the light toward
 * the pointer so it trails smoothly instead of snapping, and eases back to the
 * bottom-centre rest position when the pointer leaves. The light itself is a
 * clipped radial gradient (see `.glass-btn::after` in globals.css), so it hugs
 * the rounded edges without ever crossing them.
 *
 * Global + delegated = it works on every current and future glass button
 * without wiring anything into individual components.
 */
export default function GlassGlow() {
  useEffect(() => {
    // Respect reduced-motion: leave the static rest glow, skip the follow.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const REST_X = 50;
    const REST_Y = 100;
    const EASE = 0.2;

    let el: HTMLElement | null = null;
    let tx = REST_X;
    let ty = REST_Y;
    let cx = REST_X;
    let cy = REST_Y;
    let raf = 0;
    let returning = false;

    const apply = () => {
      if (!el) return;
      el.style.setProperty("--gx", `${cx.toFixed(2)}%`);
      el.style.setProperty("--gy", `${cy.toFixed(2)}%`);
    };

    const tick = () => {
      cx += (tx - cx) * EASE;
      cy += (ty - cy) * EASE;
      apply();
      if (Math.abs(tx - cx) > 0.15 || Math.abs(ty - cy) > 0.15) {
        raf = requestAnimationFrame(tick);
        return;
      }
      raf = 0;
      cx = tx;
      cy = ty;
      apply();
      // Settled back at rest → drop the inline vars so the element falls back
      // to the CSS default without any visible jump.
      if (returning && el) {
        el.style.removeProperty("--gx");
        el.style.removeProperty("--gy");
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
          ? (e.target.closest(".glass-btn") as HTMLElement | null)
          : null;
      if (!target) return;
      if (target !== el) {
        if (el) {
          el.style.removeProperty("--gx");
          el.style.removeProperty("--gy");
        }
        el = target;
        cx = REST_X;
        cy = REST_Y;
      }
      returning = false;
      const r = target.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // Project the cursor onto the button's border: the light rides the edge
      // at the point that lies in the cursor's direction from the centre, so it
      // travels along the rim (never inside, never outside) as the cursor moves.
      let dx = e.clientX - r.left - r.width / 2;
      let dy = e.clientY - r.top - r.height / 2;
      if (dx === 0 && dy === 0) dy = 0.0001;
      const scale = 1 / Math.max(Math.abs(dx) / (r.width / 2), Math.abs(dy) / (r.height / 2));
      tx = ((r.width / 2 + dx * scale) / r.width) * 100;
      ty = ((r.height / 2 + dy * scale) / r.height) * 100;
      kick();
    };

    const onOut = (e: PointerEvent) => {
      const target =
        e.target instanceof Element
          ? (e.target.closest(".glass-btn") as HTMLElement | null)
          : null;
      if (target && target === el && !target.contains(e.relatedTarget as Node | null)) {
        tx = REST_X;
        ty = REST_Y;
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
