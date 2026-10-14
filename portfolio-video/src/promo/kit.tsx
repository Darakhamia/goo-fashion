// Shared pieces for the promo: the captures and their geometry, the palette,
// and <Shot>, which shows part of a capture. Nothing here draws interface: the
// video only crops, moves and layers screenshots of the real app (STORYBOARD.md §1).
import React from "react";
import { Img, staticFile } from "remotion";
import manifest from "../../public/captures/manifest.json";

export type Rect = { x: number; y: number; w: number; h: number };
export type Format = "16x9" | "1x1" | "9x16";
export const SIZE: Record<Format, { W: number; H: number }> = {
  "16x9": { W: 1920, H: 1080 },
  "1x1": { W: 1080, H: 1080 },
  "9x16": { W: 1080, H: 1920 },
};

export const M = manifest;

/** The type cards' ground: the dark hero's own near-black (sampled 10–21). */
export const INK = "#0b0b0b";
/** The site's light page colour, behind every product shot. */
export const PAPER = "rgb(244, 242, 238)";
/** The site's light text on dark (--foreground in .dark). */
export const LIGHT = "#F0EEE8";

/** Soft shadow for a capture floating on PAPER. */
export const FLOAT_SHADOW = "0 40px 90px rgba(20, 18, 14, 0.16), 0 12px 28px rgba(20, 18, 14, 0.10)";

/**
 * Part of a capture. `size` is the capture in CSS px, `crop` the part to show
 * (CSS px), `scale` the video px per CSS px. The PNGs are deviceScaleFactor 2,
 * so up to scale 2 a capture is shown at or below its own resolution.
 */
export function Shot({
  src,
  size,
  crop,
  scale = 1,
  style,
  radius,
}: {
  src: string;
  size: { w: number; h: number };
  crop?: Rect;
  scale?: number;
  style?: React.CSSProperties;
  radius?: number | string;
}) {
  const c = crop ?? { x: 0, y: 0, w: size.w, h: size.h };
  return (
    <div
      style={{
        position: "absolute",
        width: c.w * scale,
        height: c.h * scale,
        overflow: "hidden",
        borderRadius: radius,
        ...style,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          left: -c.x * scale,
          top: -c.y * scale,
          width: size.w * scale,
          height: size.h * scale,
          maxWidth: "none",
        }}
      />
    </div>
  );
}

/** A rect grown by `d` on every side. */
export const grow = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });

/** Deterministic pseudo-random in [0, 1) from an integer seed. */
export function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
