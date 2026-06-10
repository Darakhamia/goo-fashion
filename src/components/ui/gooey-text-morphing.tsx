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
 * Cycles through `texts` with the signature gooey morph: an SVG alpha-threshold
 * filter over two cross-blurring text layers, so words melt into one another.
 * The filtered layer is supersampled (rendered larger, scaled down) so the goo
 * stays crisp on hi-DPI screens instead of looking pixelated. The RAF loop
 * pauses while the tab is hidden, and users with prefers-reduced-motion get a
 * GPU-composited opacity crossfade instead of the filter-heavy morph.
 */
export function GooeyText({
  texts,
  morphTime = 1,
  cooldownTime = 0.25,
  firstTextCooldown,
  className,
  textClassName,
}: GooeyTextProps) {
  const [reduceMotion, setReduceMotion] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq?.matches ?? false);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq?.addEventListener?.("change", onChange);
    return () => mq?.removeEventListener?.("change", onChange);
  }, []);

  if (reduceMotion) {
    return (
      <CrossfadeText
        texts={texts}
        morphTime={morphTime}
        cooldownTime={cooldownTime}
        className={className}
        textClassName={textClassName}
      />
    );
  }

  return (
    <MorphText
      texts={texts}
      morphTime={morphTime}
      cooldownTime={cooldownTime}
      firstTextCooldown={firstTextCooldown}
      className={className}
      textClassName={textClassName}
    />
  );
}

/**
 * Supersample factor for the goo filter. CSS `filter: url(#svg)` rasterises an
 * HTML element at CSS-pixel resolution (Chromium ignores devicePixelRatio
 * here), so on hi-DPI screens the threshold edges looked pixelated/blocky. We
 * render the filtered layer SS× larger and scale it back down, so the filter
 * rasterises at SS× the resolution — crisp edges, identical gooey morph.
 */
const SUPERSAMPLE = 2;

/** Gooey morph: SVG alpha-threshold filter + per-frame blur, driven by RAF. */
function MorphText({
  texts,
  morphTime = 1,
  cooldownTime = 0.25,
  firstTextCooldown,
  className,
  textClassName,
}: GooeyTextProps) {
  const text1Ref = React.useRef<HTMLSpanElement>(null);
  const text2Ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    let textIndex = texts.length - 1;
    let time = new Date();
    let morph = 0;
    let cooldown = cooldownTime;
    let animationId: number;

    const setMorph = (fraction: number) => {
      if (text1Ref.current && text2Ref.current) {
        // Blur is multiplied by SUPERSAMPLE because the layer is scaled down by
        // 1/SUPERSAMPLE, which would otherwise halve the visual blur radius.
        text2Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100) * SUPERSAMPLE}px)`;
        text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

        fraction = 1 - fraction;
        text1Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100) * SUPERSAMPLE}px)`;
        text1Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
      }
    };

    const doCooldown = () => {
      morph = 0;
      if (text1Ref.current && text2Ref.current) {
        text2Ref.current.style.filter = "";
        text2Ref.current.style.opacity = "100%";
        text1Ref.current.style.filter = "";
        text1Ref.current.style.opacity = "0%";
      }
    };

    const doMorph = () => {
      morph -= cooldown;
      cooldown = 0;
      let fraction = morph / morphTime;

      if (fraction > 1) {
        // When textIndex wraps to last position, text2 becomes texts[0] — use firstTextCooldown
        const isFirstText = textIndex === texts.length - 1;
        cooldown = isFirstText && firstTextCooldown != null ? firstTextCooldown : cooldownTime;
        fraction = 1;
      }

      setMorph(fraction);
    };

    function animate() {
      animationId = requestAnimationFrame(animate);
      if (document.hidden) return; // pause when tab is not visible
      const newTime = new Date();
      const shouldIncrementIndex = cooldown > 0;
      const dt = (newTime.getTime() - time.getTime()) / 1000;
      time = newTime;

      cooldown -= dt;

      if (cooldown <= 0) {
        if (shouldIncrementIndex) {
          textIndex = (textIndex + 1) % texts.length;
          if (text1Ref.current && text2Ref.current) {
            text1Ref.current.textContent = texts[textIndex % texts.length];
            text2Ref.current.textContent = texts[(textIndex + 1) % texts.length];
          }
        }
        doMorph();
      } else {
        doCooldown();
      }
    }

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [texts, morphTime, cooldownTime, firstTextCooldown]);

  // `textClassName` (the responsive font-size) goes on the outer box so it acts
  // as the base em; the spans render at SUPERSAMPLE em inside an SS×-larger,
  // scaled-down layer, so the goo filter rasterises at SS× resolution.
  return (
    <div className={cn("relative", className, textClassName)}>
      <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <filter
            id="goo-threshold"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>

      <div
        className="absolute flex items-center justify-center"
        style={{
          width: `${SUPERSAMPLE * 100}%`,
          height: `${SUPERSAMPLE * 100}%`,
          left: `${-(SUPERSAMPLE - 1) * 50}%`,
          top: `${-(SUPERSAMPLE - 1) * 50}%`,
          filter: "url(#goo-threshold)",
          transform: `scale(${1 / SUPERSAMPLE})`,
          transformOrigin: "center",
        }}
      >
        <span
          ref={text1Ref}
          style={{ fontSize: `${SUPERSAMPLE}em` }}
          className={cn(
            "absolute inline-block select-none text-center font-bold tracking-[-0.04em]",
            "text-[var(--foreground)] [will-change:filter,opacity]"
          )}
        />
        <span
          ref={text2Ref}
          style={{ fontSize: `${SUPERSAMPLE}em` }}
          className={cn(
            "absolute inline-block select-none text-center font-bold tracking-[-0.04em]",
            "text-[var(--foreground)] [will-change:filter,opacity]"
          )}
        />
      </div>
    </div>
  );
}

/** Reduced-motion fallback: opacity-only crossfade on a slow timer. */
function CrossfadeText({
  texts,
  morphTime = 1,
  cooldownTime = 0.25,
  className,
  textClassName,
}: GooeyTextProps) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (texts.length <= 1) return;
    const stepMs = Math.max(600, (morphTime + cooldownTime) * 1000) * 2;
    const id = setInterval(() => {
      if (document.hidden) return; // don't advance while tab is backgrounded
      setIndex((i) => (i + 1) % texts.length);
    }, stepMs);
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
