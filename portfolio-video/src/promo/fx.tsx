// Effects for the feature films (src/promo/features/). They act on how the
// captures are shown, not on what they show: a cut can punch in, split its
// colour channels, glitch, blur along its motion; type can scramble or be cut
// out of a capture; a tap can burst. All of it is a function of the frame.
import React from "react";
import { useCurrentFrame } from "remotion";
import { easeInOut, easeOut, ramp } from "../motion";
import { rand } from "./kit";

/** A punch-in on a cut: `amount` over scale 1 at frame `at`, settling over `dur`. */
export function punch(f: number, at: number, amount = 0.08, dur = 9) {
  if (f < at) return 1;
  return 1 + amount * (1 - ramp(f, at, at + dur, easeOut));
}

/** How hard a cut at `at` still hits: 1 on the cut, gone after `dur` frames. */
export function hit(f: number, at: number, dur = 6) {
  if (f < at || f >= at + dur) return 0;
  return 1 - (f - at) / dur;
}

/** The strongest of several hits. */
export const hits = (f: number, ats: number[], dur = 6) => Math.max(0, ...ats.map((a) => hit(f, a, dur)));

/** A small camera shake: x, y in px, decaying from `at` over `dur`. */
export function shake(f: number, at: number, amp = 14, dur = 10) {
  const k = hit(f, at, dur);
  if (!k) return { x: 0, y: 0 };
  return { x: (rand(f * 7 + 1) - 0.5) * 2 * amp * k, y: (rand(f * 13 + 5) - 0.5) * 2 * amp * k };
}

let filterSeq = 0;

/**
 * Splits the red and blue channels of its children sideways by `px` (video px),
 * the way a lens fringes on a hard cut. 0 renders the children as they are.
 */
export function RGBSplit({ px, children, style }: { px: number; children: React.ReactNode; style?: React.CSSProperties }) {
  const id = React.useMemo(() => `rgb${++filterSeq}`, []);
  if (Math.abs(px) < 0.25) return <div style={{ position: "absolute", inset: 0, ...style }}>{children}</div>;
  return (
    <div style={{ position: "absolute", inset: 0, filter: `url(#${id})`, ...style }}>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx={px} dy="0" result="r2" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
          <feOffset in="b" dx={-px} dy="0" result="b2" />
          <feBlend in="r2" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="b2" mode="screen" />
        </filter>
      </svg>
      {children}
    </div>
  );
}

/**
 * Blur along one axis only (video px), for fast moves: a reel spinning, a whip.
 * 0 renders the children as they are.
 */
export function DirBlur({ x = 0, y = 0, children, style }: { x?: number; y?: number; children: React.ReactNode; style?: React.CSSProperties }) {
  const id = React.useMemo(() => `dir${++filterSeq}`, []);
  if (x < 0.3 && y < 0.3) return <div style={{ position: "absolute", inset: 0, ...style }}>{children}</div>;
  return (
    <div style={{ position: "absolute", inset: 0, filter: `url(#${id})`, ...style }}>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={`${x} ${y}`} />
        </filter>
      </svg>
      {children}
    </div>
  );
}

/**
 * A glitch: the picture cut into horizontal bands, each pushed sideways, for
 * `strength` 0–1. `render` draws the picture; it is drawn once per band.
 */
export function Glitch({ strength, seed, W, H, render }: { strength: number; seed: number; W: number; H: number; render: () => React.ReactNode }) {
  if (strength <= 0.01) return <>{render()}</>;
  const bands = 9;
  const cuts = [0, ...Array.from({ length: bands - 1 }, (_, i) => (i + 1) / bands + (rand(seed * 31 + i) - 0.5) * 0.08), 1];
  return (
    <>
      {cuts.slice(0, -1).map((top, i) => {
        const bottom = cuts[i + 1];
        const dx = (rand(seed * 17 + i * 3) - 0.5) * 2 * 90 * strength * (rand(seed + i) > 0.35 ? 1 : 0.15);
        return (
          <div key={i} style={{ position: "absolute", inset: 0, clipPath: `inset(${top * H}px 0 ${(1 - bottom) * H}px 0)`, transform: `translateX(${dx}px)` }}>
            {render()}
          </div>
        );
      })}
    </>
  );
}

const GLYPHS = "ABCDEFGHJKLMNOPQRSTUVWXYZ0123456789#$%&@*+=/<>ЖЗИЙКЛМНПФЦЧШЩЮЯ";

/**
 * Text that decodes: each character shows random glyphs until its turn, from
 * frame `from`, over `dur` frames, left to right. Spaces stay spaces.
 */
export function scramble(text: string, f: number, from: number, dur: number, seed = 1): string {
  const n = text.length;
  return [...text]
    .map((ch, i) => {
      if (ch === " ") return " ";
      const settleAt = from + (dur * (i + 1)) / n;
      if (f >= settleAt) return ch;
      if (f < from - 2) return " ";
      return GLYPHS[Math.floor(rand(seed * 101 + i * 7 + Math.floor(f / 2) * 13) * GLYPHS.length)];
    })
    .join("");
}

/** The site's heart (the card's like button), as a path in a 16×16 box. */
export const HEART = "M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z";

/**
 * A burst from (x, y) at frame `at`: small hearts and dots flying out and
 * fading. `size` scales it; `color` fills it.
 */
export function Burst({ at, x, y, size = 1, color = "#0b0b0b", count = 12, seed = 1 }: { at: number; x: number; y: number; size?: number; color?: string; count?: number; seed?: number }) {
  const f = useCurrentFrame();
  if (f < at || f > at + 26) return null;
  const t = ramp(f, at, at + 22, easeOut);
  const fade = 1 - ramp(f, at + 10, at + 26, easeInOut);
  return (
    <>
      {/* A ring that spreads. */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 120 * size,
          height: 120 * size,
          borderRadius: "50%",
          border: `${4 * size * (1 - t) + 0.5}px solid ${color}`,
          transform: `translate(-50%, -50%) scale(${0.2 + 1.1 * t})`,
          opacity: (1 - t) * 0.8,
        }}
      />
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (rand(seed * 19 + i) - 0.5) * 0.5;
        const dist = (70 + rand(seed * 7 + i) * 70) * size * t;
        const s = (0.5 + rand(seed * 3 + i) * 0.6) * size;
        const heart = i % 3 === 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.cos(a) * dist,
              top: y + Math.sin(a) * dist,
              transform: `translate(-50%, -50%) scale(${s * (1 - 0.4 * t)}) rotate(${(rand(i + seed) - 0.5) * 60}deg)`,
              opacity: fade,
            }}
          >
            {heart ? (
              <svg width={26} height={26} viewBox="0 0 16 16">
                <path d={HEART} fill={color} />
              </svg>
            ) : (
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
            )}
          </div>
        );
      })}
    </>
  );
}

/** A white (or `color`) flash over everything on a cut, for `dur` frames. */
export function Flash({ at, dur = 4, color = "#fff", max = 0.85 }: { at: number; dur?: number; color?: string; max?: number }) {
  const f = useCurrentFrame();
  const k = hit(f, at, dur);
  if (!k) return null;
  return <div style={{ position: "absolute", inset: 0, background: color, opacity: k * max, pointerEvents: "none" }} />;
}

/** A soft light sweeping diagonally across, from `at` over `dur` frames. */
export function Sheen({ at, dur = 22, W, H, strength = 0.35 }: { at: number; dur?: number; W: number; H: number; strength?: number }) {
  const f = useCurrentFrame();
  if (f < at || f > at + dur) return null;
  const t = ramp(f, at, at + dur, easeInOut);
  const x = -W + t * W * 2.4;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: -H * 0.2,
        width: W * 0.5,
        height: H * 1.4,
        transform: "rotate(18deg)",
        background: `linear-gradient(90deg, transparent, rgba(255,255,255,${strength}), transparent)`,
        mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
}
