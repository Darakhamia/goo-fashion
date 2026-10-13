// Kinetic type: short lines in the site's face, Inter Tight 800, on near-black.
// Words rise in from behind each line's mask, one after another, hold, then
// leave upward the same way.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, ramp } from "../motion";
import { INK, LIGHT } from "./kit";

export function TypeCard({
  lines,
  dur,
  size,
  x,
  exit = true,
}: {
  lines: string[];
  dur: number;
  size: number;
  x: number;
  exit?: boolean;
}) {
  const f = useCurrentFrame();
  const IN = 13; // frames for one word to rise
  const WORD = 2.5; // stagger between words
  const LINE = 4; // extra stagger between lines
  const OUT = 9;
  const outFrom = dur - OUT - 1;
  let n = 0;
  // A slow drift keeps the card alive while it holds.
  const drift = 1 + 0.03 * ramp(f, 0, dur, (t) => t);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: "50%",
          transform: `translateY(-50%) scale(${drift})`,
          transformOrigin: `0 50%`,
          fontFamily: "'Inter Tight', sans-serif",
          fontWeight: 800,
          fontSize: size,
          lineHeight: 1.0,
          letterSpacing: "-0.04em",
          color: LIGHT,
        }}
      >
        {lines.map((line, li) => (
          // Each line is its own mask: words travel in and out of view behind its edge.
          <div key={li} style={{ overflow: "hidden", padding: "0.04em 0 0.14em", marginBottom: "-0.12em" }}>
            {line.split(" ").map((word, wi) => {
              const i = n++;
              const start = 4 + li * LINE + i * WORD;
              const t = ramp(f, start, start + IN, easeOut);
              const o = exit ? ramp(f, outFrom + i * 1.2, outFrom + i * 1.2 + OUT, easeInOut) : 0;
              const y = (1 - t) * 1.15 - o * 1.15;
              return (
                <span key={wi} style={{ display: "inline-block", transform: `translateY(${y}em)`, whiteSpace: "pre" }}>
                  {word}
                  {wi < line.split(" ").length - 1 ? " " : ""}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
