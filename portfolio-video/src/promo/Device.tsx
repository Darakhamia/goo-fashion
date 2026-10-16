// Frames around the captures: a minimal phone bezel, a light browser window
// and a touch mark. They are presentation, not the app's interface; what sits
// inside them is always a capture.
import React from "react";
import { useCurrentFrame } from "remotion";
import { easeOut, ramp } from "../motion";
import { FLOAT_SHADOW } from "./kit";

/**
 * Where a finger touches the screen, at frame `at`: a soft disc that lands and
 * lifts, and a ring that spreads. `x`, `y` in screen px, `s` video px per
 * screen px.
 */
export function Tap({ at, x, y, s }: { at: number; x: number; y: number; s: number }) {
  const f = useCurrentFrame();
  if (f < at - 3 || f > at + 18) return null;
  const down = ramp(f, at - 3, at + 1, easeOut);
  const lift = ramp(f, at + 5, at + 14, easeOut);
  const ring = ramp(f, at, at + 16, easeOut);
  const d = 46 * s;
  const disc: React.CSSProperties = { position: "absolute", left: x * s, top: y * s, width: d, height: d, borderRadius: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" };
  return (
    <>
      <div style={{ ...disc, background: "rgba(11, 11, 11, 0.16)", opacity: down * (1 - lift), transform: `translate(-50%, -50%) scale(${0.7 + 0.3 * down})` }} />
      <div style={{ ...disc, border: `${1.5 * s}px solid rgba(11, 11, 11, 0.22)`, opacity: 1 - ring, transform: `translate(-50%, -50%) scale(${0.8 + 0.9 * ring})` }} />
    </>
  );
}

/**
 * A phone of `w`×`h` screen px. Children are laid out in screen px. On a dark
 * ground (`ground="dark"`) a lighter rim and a faint glow keep its edge in view.
 */
export function Phone({ w, h, s, children, style, ground = "light" }: { w: number; h: number; s: number; children: React.ReactNode; style?: React.CSSProperties; ground?: "light" | "dark" }) {
  const bezel = 11 * s;
  const edge = ground === "dark" ? `0 0 ${120 * s}px rgba(240, 238, 232, 0.05), inset 0 0 0 ${1.5 * s}px #4a4844` : `${FLOAT_SHADOW}, inset 0 0 0 ${1.5 * s}px #2b2a28`;
  return (
    <div
      style={{
        position: "absolute",
        width: w + 2 * bezel,
        height: h + 2 * bezel,
        borderRadius: 58 * s,
        background: "#0e0e0d",
        boxShadow: edge,
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: bezel, top: bezel, width: w, height: h, borderRadius: 47 * s, overflow: "hidden", background: "#fff" }}>
        {children}
      </div>
    </div>
  );
}

/**
 * A browser window whose page area is `w`×`h` px. Children are laid out in
 * page px. `compact` puts the address next to the window buttons instead of
 * centring it, so a close-up of the page's right side never cuts it in half.
 */
export function Browser({ w, h, s, url, compact = false, children, style }: { w: number; h: number; s: number; url: string; compact?: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  const bar = 38 * s;
  return (
    <div
      style={{
        position: "absolute",
        width: w,
        height: h + bar,
        borderRadius: 14 * s,
        overflow: "hidden",
        background: "#fff",
        boxShadow: `${FLOAT_SHADOW}, 0 0 0 ${1 * s}px rgba(20, 18, 14, 0.08)`,
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: bar, background: "#e9e7e2", borderBottom: `${1 * s}px solid rgba(20,18,14,0.08)` }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ position: "absolute", left: (16 + i * 18) * s, top: bar / 2 - 5.5 * s, width: 11 * s, height: 11 * s, borderRadius: "50%", background: "#cfccc6" }} />
        ))}
        <div
          style={{
            position: "absolute",
            left: compact ? 76 * s : "50%",
            top: 7 * s,
            height: bar - 14 * s,
            width: (compact ? 300 : 360) * s,
            transform: compact ? undefined : "translateX(-50%)",
            borderRadius: 7 * s,
            background: "#f7f6f3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: 13 * s,
            fontWeight: 500,
            letterSpacing: "0.01em",
            color: "#55534f",
          }}
        >
          {url}
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, top: bar, width: w, height: h, overflow: "hidden" }}>{children}</div>
    </div>
  );
}
