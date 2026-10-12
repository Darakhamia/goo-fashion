// A quiet pointer that appears only to press or pick something.
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, mix, ramp } from "../motion";

export type CursorKey = { f: number; x: number; y: number };

export function Cursor({
  path,
  presses = [],
  appear,
  vanish,
  size,
}: {
  /** Keyframes in video px; the pointer glides between them. */
  path: CursorKey[];
  /** Frames at which it clicks. */
  presses?: number[];
  appear: number;
  vanish: number;
  size: number;
}) {
  const frame = useCurrentFrame();
  const opacity = Math.min(ramp(frame, appear, appear + 8), 1 - ramp(frame, vanish - 8, vanish, easeInOut));
  if (opacity <= 0) return null;
  const fs = path.map((k) => k.f);
  const x = interpolate(frame, fs, path.map((k) => k.x), { easing: easeInOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, fs, path.map((k) => k.y), { easing: easeInOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let press = 0;
  let ring = -1;
  for (const p of presses) {
    const d = frame - p;
    if (d >= 0 && d <= 5) press = Math.max(press, d <= 2 ? d / 2 : 1 - (d - 2) / 3);
    if (d >= 0 && d <= 14) ring = d / 14;
  }
  return (
    <>
      {ring >= 0 && (
        <div
          style={{
            position: "absolute",
            left: x - size * 0.9,
            top: y - size * 0.9,
            width: size * 1.8,
            height: size * 1.8,
            borderRadius: "50%",
            border: "2px solid rgba(240,238,232,0.55)",
            opacity: (1 - easeOut(ring)) * opacity,
            transform: `scale(${mix(0.3, 1, easeOut(ring))})`,
          }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: x - size * 0.17,
          top: y - size * 0.08,
          opacity,
          transform: `scale(${1 - press * 0.12})`,
          transformOrigin: "17% 8%",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
        }}
      >
        <path
          d="M4.5 2.2v17.4l4.6-4.4 3 6.6 3-1.3-3-6.5h6.4L4.5 2.2Z"
          fill="#fff"
          stroke="#0a0a0a"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}

/** A soft touch dot for the phone. */
export function TouchDot({ x, y, at, size }: { x: number; y: number; at: number; size: number }) {
  const frame = useCurrentFrame();
  const d = frame - at;
  if (d < -4 || d > 14) return null;
  const inT = ramp(frame, at - 4, at);
  const outT = ramp(frame, at + 2, at + 14);
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(240,238,232,0.32)",
        boxShadow: "0 0 0 1.5px rgba(240,238,232,0.5)",
        opacity: inT * (1 - outT),
        transform: `scale(${mix(0.7, 1.15, outT)})`,
      }}
    />
  );
}
