"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Below this width the homepage layouts stack into tall single columns that
 * can't be squeezed into one screen without becoming unreadable, so the page
 * keeps its normal height and normal scrolling there.
 */
const FIT_FROM = 1024;

/** Scaling further than this stops reading as "smaller" and starts reading as broken. */
const MIN_SCALE = 0.72;

interface HomeSectionProps {
  /** Shown in the section dots on the right. */
  label: string;
  /** Applied to the full-screen wrapper — put the section background here so it
   *  covers the whole screen, not just the content. */
  className?: string;
  children: React.ReactNode;
}

/**
 * One stop of the homepage's one-screen-per-section scroll.
 *
 * The wrapper always claims a full screen (minus the sticky nav). Content that
 * would overflow is scaled down to fit rather than pushed off-screen, so every
 * section stays exactly one scroll away from the next one.
 */
export default function HomeSection({ label, className = "", children }: HomeSectionProps) {
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

      if (window.innerWidth < FIT_FROM || height === 0) {
        setScale(1);
        return;
      }

      const nav =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--home-nav-h")
        ) || 0;
      const available = window.innerHeight - nav;
      setScale(height <= available ? 1 : Math.max(MIN_SCALE, available / height));
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
    <div data-home-section data-home-label={label} className={`home-section ${className}`}>
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
