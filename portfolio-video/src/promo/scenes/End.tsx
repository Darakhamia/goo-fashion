// Beat 9: the end card. The site's real dark hero, cropped below its nav
// (public/captures/hero-dark.png), with GOO, "Build your look" and the button
// rising in over the same frame captured without them (hero-dark-bg.png).
// goo-fashion.com sets underneath, then everything fades to the type cards'
// black: frame 0 of the loop.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, mix, ramp } from "../../motion";
import { INK, LIGHT, M, Shot, type Format, SIZE, type Rect } from "../kit";
import { Sfx } from "../Sfx";

const HERO = M.hero.dark;

const CROP: Record<Format, Rect> = {
  "16x9": { x: 136, y: 95, w: 1172, h: 660 },
  "1x1": { x: 392, y: 95, w: 660, h: 660 },
  // Vertical: a square around GOO, set in the middle of the frame. Its top and
  // bottom edges fade into the type cards' black.
  "9x16": { x: 442, y: 100, w: 560, h: 560 },
};

// The hero's three elements, measured on the capture (CSS px).
const PARTS: { rect: Rect; at: number }[] = [
  { rect: { x: 575, y: 362, w: 296, h: 122 }, at: 6 }, // GOO
  { rect: { x: 660, y: 503, w: 121, h: 36 }, at: 17 }, // Build your look
  { rect: { x: 616, y: 557, w: 208, h: 68 }, at: 24 }, // Build your look ↗
];

export function End({ format, dur }: { format: Format; dur: number }) {
  const f = useCurrentFrame();
  const { W, H } = SIZE[format];
  const crop = CROP[format];
  const s = W / crop.w;
  const dy = Math.max(0, Math.round((H - crop.h * s) / 2));
  const FADE = 220;
  const push = mix(1, 1.05, ramp(f, 0, dur, easeInOut));
  const fromBlack = ramp(f, 0, 10, easeOut);
  const toBlack = ramp(f, dur - 14, dur - 1, easeInOut);
  const url = ramp(f, 34, 50, easeOut);

  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      {/* Sound: a soft, deep landing as GOO rises, a chime with the address. */}
      <Sfx at={6} name="impact" volume={0.42} />
      <Sfx at={34} name="chime" volume={0.24} />
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "50% 46%", opacity: fromBlack }}>
        <Shot src={HERO.background} size={HERO.size} crop={crop} scale={s} style={{ left: 0, top: dy }} />
        {dy > 0 && (
          <>
            <div style={{ position: "absolute", left: 0, top: dy - 2, width: W, height: FADE, background: `linear-gradient(${INK}, transparent)` }} />
            <div style={{ position: "absolute", left: 0, top: dy + crop.h * s - FADE + 2, width: W, height: FADE, background: `linear-gradient(transparent, ${INK})` }} />
          </>
        )}
        {PARTS.map(({ rect, at }, i) => {
          const t = ramp(f, at, at + 18, easeOut);
          return (
            <Shot
              key={i}
              src={HERO.image}
              size={HERO.size}
              crop={rect}
              scale={s}
              style={{
                left: (rect.x - crop.x) * s,
                top: (rect.y - crop.y) * s + dy,
                opacity: t,
                transform: `translateY(${(1 - t) * 34 * s}px)`,
                // The crop carries a little of the hero's background; lighten
                // keeps only what is brighter than what's under it.
                mixBlendMode: "lighten",
              }}
            />
          );
        })}
        <div
          style={{
            position: "absolute",
            left: 0,
            width: W,
            top: (650 - crop.y) * s + dy,
            textAlign: "center",
            fontFamily: "'Inter Tight', sans-serif",
            fontWeight: 600,
            fontSize: 64,
            letterSpacing: "-0.01em",
            color: LIGHT,
            opacity: url * 0.9,
            transform: `translateY(${(1 - url) * 30}px)`,
          }}
        >
          goo-fashion.com
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: INK, opacity: toBlack }} />
    </AbsoluteFill>
  );
}
