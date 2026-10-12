// Bottom-left caption: four words at most, in the site's type and tokens.
import React from "react";
import { useCurrentFrame } from "remotion";
import { easeInOut, mix, ramp } from "../motion";

export function Caption({
  text,
  from,
  to,
  x,
  y,
  size,
  at,
}: {
  /** Draw this frame instead of the current one (posters). */
  at?: number;
  text: string;
  from: number;
  to: number;
  x: number;
  /** Baseline. */
  y: number;
  size: number;
}) {
  const current = useCurrentFrame();
  const frame = at ?? current;
  const enter = ramp(frame, from, from + 15);
  const exit = ramp(frame, to - 9, to, easeInOut);
  const opacity = Math.min(enter, 1 - exit);
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y - size,
        height: size * 1.2,
        display: "flex",
        alignItems: "center",
        gap: size * 0.55,
        opacity,
        transform: `translateY(${mix(12, 0, enter)}px)`,
      }}
    >
      <span style={{ width: size * 0.75, height: 2, background: "var(--foreground-subtle)", display: "block" }} />
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: size,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          lineHeight: 1,
          color: "var(--foreground)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
    </div>
  );
}
