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
 * The morph is rendered as real SVG `<text>` so the filter pipeline runs in
 * every engine — WebKit ignores `filter: url(#…)` on HTML elements, which made
 * phones silently lose the goo. The threshold filter is only applied *while
 * morphing*; once a word settles every filter is dropped so it renders as
 * crisp native antialiased text. Blur radii scale with the live font size so
 * the effect has the same relative strength at every responsive breakpoint.
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
 * Font size the morph blur was tuned at (the lg desktop hero size). The blur
 * scales relative to this so the gooey effect has the same relative strength
 * at every responsive size — the desktop look is the reference and is left
 * pixel-identical, smaller breakpoints melt by the same proportion.
 */
const REFERENCE_FONT_PX = 128;

/**
 * Gooey morph: SVG alpha-threshold filter + per-frame blur, driven by RAF.
 *
 * Rendered as real SVG `<text>` rather than filtered HTML because WebKit (all
 * iOS browsers) ignores `filter: url(#…)` on HTML elements — on phones the
 * threshold never ran and the morph silently degraded into a plain blurry
 * crossfade, a visibly different effect from desktop. SVG filters applied to
 * SVG content work in every engine and rasterise at device resolution, which
 * also retires the DPR-supersampling workaround the HTML version needed.
 */
function MorphText({
  texts,
  morphTime = 1,
  cooldownTime = 0.25,
  firstTextCooldown,
  className,
  textClassName,
}: GooeyTextProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const gooGroupRef = React.useRef<SVGGElement>(null);
  const text1Ref = React.useRef<SVGTextElement>(null);
  const text2Ref = React.useRef<SVGTextElement>(null);
  const blur1Ref = React.useRef<SVGFEGaussianBlurElement>(null);
  const blur2Ref = React.useRef<SVGFEGaussianBlurElement>(null);

  // The morph blur is a *pixel* radius, but the hero text shrinks responsively
  // (128px on desktop down to 64px on mobile). A fixed pixel blur would melt a
  // 64px glyph twice as hard as a 128px one, so the goo would read blobbier on
  // phones. We scale the blur by the live glyph size so the morph keeps the
  // same *relative* strength — identical feel — at every breakpoint, while the
  // responsive sizes themselves stay untouched.
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
    let textIndex = texts.length - 1;
    let time = new Date();
    let morph = 0;
    let cooldown = cooldownTime;
    let animationId: number;

    const setMorph = (fraction: number) => {
      if (text1Ref.current && text2Ref.current && blur1Ref.current && blur2Ref.current) {
        // The goo threshold is only meaningful while the two layers overlap, so
        // it's applied during the morph and dropped on cooldown (crisp native
        // text when settled).
        gooGroupRef.current?.setAttribute("filter", "url(#goo-threshold)");
        text1Ref.current.setAttribute("filter", "url(#goo-blur-1)");
        text2Ref.current.setAttribute("filter", "url(#goo-blur-2)");
        // Scaled by fontScale so the morph melts each glyph by the same
        // fraction of its size on every screen (identical effect on mobile
        // and desktop). stdDeviation matches CSS blur() radius 1:1.
        const FS = fontScaleRef.current;
        blur2Ref.current.setAttribute("stdDeviation", String(Math.min(8 / fraction - 8, 100) * FS));
        text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

        fraction = 1 - fraction;
        blur1Ref.current.setAttribute("stdDeviation", String(Math.min(8 / fraction - 8, 100) * FS));
        text1Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
      }
    };

    const doCooldown = () => {
      morph = 0;
      if (text1Ref.current && text2Ref.current) {
        // Settled word: drop every filter so the text rasterises as crisp
        // native antialiased glyphs instead of through the filter graph.
        gooGroupRef.current?.removeAttribute("filter");
        text2Ref.current.removeAttribute("filter");
        text2Ref.current.style.opacity = "100%";
        text1Ref.current.removeAttribute("filter");
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

  // `textClassName` (the responsive font-size) goes on the outer box; the SVG
  // <text> elements inherit it through the CSS cascade, so the words render at
  // the same responsive size as before.
  return (
    <div ref={containerRef} className={cn("relative", className, textClassName)}>
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
        focusable="false"
      >
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
                soft sub-pixel edge (like native font antialiasing) without
                touching the blob-merge behaviour the threshold drives, so the
                goo stays crisp in motion. */}
            <feGaussianBlur in="threshold" stdDeviation="0.5" edgeMode="none" />
          </filter>
          {/* Per-layer cross-blur, updated every frame by the RAF loop. The
              filter region is oversized so large blur radii aren't clipped. */}
          <filter id="goo-blur-1" x="-150%" y="-150%" width="400%" height="400%" colorInterpolationFilters="sRGB">
            <feGaussianBlur ref={blur1Ref} stdDeviation="0" edgeMode="none" />
          </filter>
          <filter id="goo-blur-2" x="-150%" y="-150%" width="400%" height="400%" colorInterpolationFilters="sRGB">
            <feGaussianBlur ref={blur2Ref} stdDeviation="0" edgeMode="none" />
          </filter>
        </defs>

        {/* Starts filtered (first frame is mid-cooldown → removed by the RAF
            loop); only re-applied while actively morphing. */}
        <g ref={gooGroupRef} filter="url(#goo-threshold)">
          <text
            ref={text1Ref}
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="select-none font-bold tracking-[-0.04em] fill-[var(--foreground)] [will-change:opacity]"
          />
          <text
            ref={text2Ref}
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="select-none font-bold tracking-[-0.04em] fill-[var(--foreground)] [will-change:opacity]"
          />
        </g>
      </svg>
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
