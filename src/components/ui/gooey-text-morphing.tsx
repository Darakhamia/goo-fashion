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
 *
 * Crispness comes from two things working together:
 *   1. The goo threshold filter is only applied *while morphing*. CSS
 *      `filter: url(#svg)` rasterises an HTML element at CSS-pixel resolution,
 *      which is what made even the settled (static) word look pixelated. Once a
 *      word settles we drop the filter entirely, so it renders as crisp native
 *      antialiased text.
 *   2. While morphing, the filtered layer is supersampled (rendered larger,
 *      scaled back down) at a factor matched to the device pixel ratio, so the
 *      goo rasterises at the screen's real resolution on Retina/mobile.
 *
 * The RAF loop pauses while the tab is hidden, and users with
 * prefers-reduced-motion get a GPU-composited opacity crossfade instead.
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
 * Default/SSR supersample factor for the goo filter. CSS `filter: url(#svg)`
 * rasterises an HTML element at CSS-pixel resolution (Chromium ignores
 * devicePixelRatio here), so on hi-DPI screens the threshold edges looked
 * pixelated/blocky. We render the filtered layer SS× larger and scale it back
 * down, so the filter rasterises at SS× the resolution — crisp edges, identical
 * gooey morph. At runtime this is bumped to match the device pixel ratio.
 */
const DEFAULT_SUPERSAMPLE = 2;
/** Cap so very high-DPR phones don't pay for an oversized rasterised layer. */
const MAX_SUPERSAMPLE = 4;

/**
 * Font size the morph blur was tuned at (the lg desktop hero size). The blur
 * scales relative to this so the gooey effect has the same relative strength
 * at every responsive size — the desktop look is the reference and is left
 * pixel-identical, smaller breakpoints melt by the same proportion.
 */
const REFERENCE_FONT_PX = 128;

/** Gooey morph: SVG alpha-threshold filter + per-frame blur, driven by RAF. */
function MorphText({
  texts,
  morphTime = 1,
  cooldownTime = 0.25,
  firstTextCooldown,
  className,
  textClassName,
}: GooeyTextProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const text1Ref = React.useRef<HTMLSpanElement>(null);
  const text2Ref = React.useRef<HTMLSpanElement>(null);
  const layerRef = React.useRef<HTMLDivElement>(null);

  // Match the supersample factor to the screen's pixel density so the goo
  // rasterises at real resolution on Retina / mobile. Resolved after mount to
  // stay SSR-safe (devicePixelRatio is undefined on the server).
  const [supersample, setSupersample] = React.useState(DEFAULT_SUPERSAMPLE);
  React.useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    // One step above the device pixel ratio so the goo threshold has resolution
    // headroom to antialias against, instead of rasterising at bare parity.
    setSupersample(Math.min(MAX_SUPERSAMPLE, Math.max(DEFAULT_SUPERSAMPLE, Math.ceil(dpr) + 1)));
  }, []);

  // The morph blur is a *pixel* radius, but the hero text shrinks responsively
  // (128px on desktop down to 64px on mobile). A fixed pixel blur would melt a
  // 64px glyph twice as hard as a 128px one, so the goo looks like a different,
  // blobbier effect on phones. We scale the blur by the live glyph size so the
  // morph keeps the same *relative* strength — identical feel — at every
  // breakpoint, while the responsive sizes themselves stay untouched.
  const fontScaleRef = React.useRef(1);
  React.useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const px = parseFloat(getComputedStyle(el).fontSize) || REFERENCE_FONT_PX;
      fontScaleRef.current = px / REFERENCE_FONT_PX;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  React.useEffect(() => {
    const SS = supersample;
    let textIndex = texts.length - 1;
    let time = new Date();
    let morph = 0;
    let cooldown = cooldownTime;
    let animationId: number;

    const setMorph = (fraction: number) => {
      if (text1Ref.current && text2Ref.current) {
        // The goo threshold is only meaningful while the two layers overlap, so
        // it's applied during the morph and dropped on cooldown (crisp native
        // text when settled).
        if (layerRef.current) layerRef.current.style.filter = "url(#goo-threshold)";
        // Blur is multiplied by SS because the layer is scaled down by 1/SS,
        // which would otherwise halve the visual blur radius, and by fontScale
        // so the morph melts each glyph by the same fraction of its size on
        // every screen (identical effect on mobile and desktop).
        const FS = fontScaleRef.current;
        text2Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100) * SS * FS}px)`;
        text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

        fraction = 1 - fraction;
        text1Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100) * SS * FS}px)`;
        text1Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
      }
    };

    const doCooldown = () => {
      morph = 0;
      if (text1Ref.current && text2Ref.current) {
        // Settled word: drop the SVG threshold filter so the text rasterises as
        // crisp native antialiased glyphs instead of through the filter graph.
        if (layerRef.current) layerRef.current.style.filter = "none";
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
  }, [texts, morphTime, cooldownTime, firstTextCooldown, supersample]);

  // `textClassName` (the responsive font-size) goes on the outer box so it acts
  // as the base em; the spans render at `supersample` em inside an SS×-larger,
  // scaled-down layer, so the goo filter rasterises at SS× resolution.
  return (
    <div ref={containerRef} className={cn("relative", className, textClassName)}>
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
              result="threshold"
            />
            {/* The hard alpha threshold above snaps glyph edges into a binary
                staircase, which reads as pixelated/jagged while the morph is
                playing. A small final blur re-antialiases that edge back to a
                ~1px soft edge (like native font antialiasing) without touching
                the blob-merge behaviour the threshold drives, so the goo stays
                crisp in motion. stdDeviation is in the SS×-scaled layer's local
                units, so after the 1/SS downscale it lands at roughly one
                on-screen pixel. */}
            <feGaussianBlur in="threshold" stdDeviation="1" edgeMode="none" />
          </filter>
        </defs>
      </svg>

      <div
        ref={layerRef}
        className="absolute flex items-center justify-center"
        style={{
          width: `${supersample * 100}%`,
          height: `${supersample * 100}%`,
          left: `${-(supersample - 1) * 50}%`,
          top: `${-(supersample - 1) * 50}%`,
          // Starts filtered (first frame is mid-cooldown → swapped to "none" by
          // the RAF loop); only re-applied while actively morphing.
          filter: "url(#goo-threshold)",
          transform: `scale(${1 / supersample})`,
          transformOrigin: "center",
        }}
      >
        <span
          ref={text1Ref}
          style={{ fontSize: `${supersample}em` }}
          className={cn(
            "absolute inline-block select-none text-center font-bold tracking-[-0.04em]",
            "text-[var(--foreground)] [will-change:filter,opacity]"
          )}
        />
        <span
          ref={text2Ref}
          style={{ fontSize: `${supersample}em` }}
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
