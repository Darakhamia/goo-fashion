"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface GooeyTextProps {
  texts: string[];
  morphTime?: number;
  cooldownTime?: number;
  firstTextCooldown?: number;
  className?: string;
  textClassName?: string;
}

/**
 * Cycles through `texts` with a lightweight opacity crossfade.
 *
 * Previously this used an SVG "goo" threshold filter plus a per-frame
 * `filter: blur()` driven by requestAnimationFrame — both force a full repaint
 * of the text every frame and showed up as the dominant Paint/Graphics cost in
 * profiling. The crossfade below is GPU-composited (opacity only), uses a timer
 * instead of a continuous RAF loop, pauses on a hidden tab, and honours
 * prefers-reduced-motion.
 */
export function GooeyText({
  texts,
  morphTime = 1,
  cooldownTime = 0.25,
  className,
  textClassName,
}: GooeyTextProps) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (texts.length <= 1) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const stepMs = Math.max(600, (morphTime + cooldownTime) * 1000);
    const id = setInterval(() => {
      if (document.hidden) return; // don't advance while tab is backgrounded
      setIndex((i) => (i + 1) % texts.length);
    }, reduce ? stepMs * 2 : stepMs);
    return () => clearInterval(id);
  }, [texts, morphTime, cooldownTime]);

  return (
    <div className={cn("relative", className)}>
      {texts.map((t, i) => (
        <span
          key={i}
          aria-hidden={i !== index}
          className={cn(
            "absolute inset-0 inline-flex items-center justify-center select-none text-center font-bold tracking-[-0.04em]",
            "text-[var(--foreground)] transition-opacity ease-in-out",
            textClassName
          )}
          style={{ opacity: i === index ? 1 : 0, transitionDuration: `${morphTime}s` }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
