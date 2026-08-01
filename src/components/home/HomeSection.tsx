"use client";

import { useEffect, useRef, useState } from "react";

/** Where the wide layouts take over — below it the sections stack. */
const FIT_FROM = 1024;

/** Scaling further than this stops reading as "smaller" and starts reading as broken. */
const MIN_SCALE = 0.72;

/**
 * Phones have far less room to give, and their layouts are already the compact
 * ones, so they're allowed a little further down before a block is simply let
 * out of its screen — past this point the text stops being worth reading.
 */
const MIN_SCALE_NARROW = 0.66;

/**
 * Breathing room kept between the content and the top/bottom edges.
 *
 * Fitting to exactly 100% of the available height leaves no tolerance: the
 * measured nav height, sub-pixel rounding and the moment `fit` happens to run
 * all have to agree perfectly, and when they don't the last row of a section
 * is clipped by the viewport edge. Reserving a gutter absorbs that, and stops
 * a section from sitting flush against the nav.
 */
const GUTTER = 24;

/** A phone screen can't spare that much, and it has less rounding to absorb. */
const GUTTER_NARROW = 12;

interface HomeSectionProps {
  /** Applied to the full-screen wrapper — put the section background here so it
   *  covers the whole screen, not just the content. */
  className?: string;
  children: React.ReactNode;
}

/**
 * The `100svh` the section CSS is sized in.
 *
 * `window.innerHeight` follows the mobile browser's collapsing toolbars, so
 * fitting to it would let a section overflow the moment they slide back in.
 */
function smallViewportHeight() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
  document.documentElement.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height || window.innerHeight;
}

/**
 * One stop of the homepage's one-screen-per-section scroll.
 *
 * The wrapper always claims a full screen, minus the strips the sticky nav and
 * — on phones — the floating bottom nav sit over. Content that would overflow
 * is scaled down to fit rather than pushed off-screen, so every section stays
 * exactly one scroll away from the next one.
 */
export default function HomeSection({ className = "", children }: HomeSectionProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [natural, setNatural] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const fit = () => {
      // offsetHeight is the layout box, which a transform doesn't touch — so
      // this stays the unscaled height no matter what scale is already applied.
      const height = el.offsetHeight;
      setNatural(height);

      if (height === 0) {
        setScale(1);
        return;
      }

      // The wrapper's own padding is what reserves the nav strips, so reading
      // it back keeps this in step with the CSS instead of restating it here.
      const outer = outerRef.current;
      const style = outer ? getComputedStyle(outer) : null;
      const padding = style
        ? (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)
        : 0;

      const narrow = window.innerWidth < FIT_FROM;
      const gutter = narrow ? GUTTER_NARROW : GUTTER;
      const available = Math.max(0, smallViewportHeight() - padding - gutter);
      const min = narrow ? MIN_SCALE_NARROW : MIN_SCALE;
      setScale(height <= available ? 1 : Math.max(min, available / height));
    };

    fit();

    // Images and fonts settle after the first paint, and the grid reflows on
    // width changes — both move the natural height.
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  return (
    <div ref={outerRef} data-home-section className={`home-section ${className}`}>
      <div
        ref={innerRef}
        style={
          scale < 1
            ? {
                transform: `scale(${scale})`,
                transformOrigin: "top center",
                // A transform leaves the layout box at full height. Pull the
                // difference back so the section still occupies exactly one screen.
                marginBottom: -Math.round(natural * (1 - scale)),
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
