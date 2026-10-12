// From src/components/ui/etheral-shadow.tsx. The app animates the three blobs
// with CSS @keyframes (20 s, 26 s, 30 s loops); here the same keyframes are
// evaluated at the frame's time, so every frame is reproducible.
import React from "react";

type Key = { at: number; x: number; y: number; s: number };
const ETH_A: Key[] = [
  { at: 0, x: 0, y: 0, s: 1 },
  { at: 0.33, x: 7, y: -10, s: 1.07 },
  { at: 0.66, x: -6, y: 8, s: 0.95 },
  { at: 1, x: 0, y: 0, s: 1 },
];
const ETH_B: Key[] = [
  { at: 0, x: 0, y: 0, s: 1 },
  { at: 0.4, x: -9, y: 8, s: 1.09 },
  { at: 0.75, x: 6, y: -6, s: 0.93 },
  { at: 1, x: 0, y: 0, s: 1 },
];
const ETH_C: Key[] = [
  { at: 0, x: 0, y: 0, s: 1 },
  { at: 0.5, x: 8, y: 10, s: 1.05 },
  { at: 1, x: 0, y: 0, s: 1 },
];

// CSS `ease-in-out`, applied per keyframe segment as a CSS animation does.
function cssEaseInOut(t: number) {
  // cubic-bezier(0.42, 0, 0.58, 1), solved for x by bisection.
  let lo = 0, hi = 1, u = t;
  for (let i = 0; i < 24; i++) {
    u = (lo + hi) / 2;
    const x = 3 * (1 - u) * (1 - u) * u * 0.42 + 3 * (1 - u) * u * u * 0.58 + u * u * u;
    if (x < t) lo = u; else hi = u;
  }
  return 3 * (1 - u) * u * u + u * u * u;
}

function sample(keys: Key[], period: number, seconds: number) {
  const p = ((seconds % period) + period) % period / period;
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].at) i++;
  const a = keys[i], b = keys[i + 1];
  const t = cssEaseInOut((p - a.at) / (b.at - a.at));
  return {
    transform: `translate(${a.x + (b.x - a.x) * t}%, ${a.y + (b.y - a.y) * t}%) scale(${a.s + (b.s - a.s) * t})`,
  };
}

const blob: React.CSSProperties = {
  position: "absolute",
  borderRadius: "50%",
  filter: "blur(80px)",
  background: "radial-gradient(ellipse at center, var(--fg-overlay-08) 0%, transparent 70%)",
};

export function EtherealShadow({ seconds, opacity = 1 }: { seconds: number; opacity?: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity }}>
      <div style={{ ...blob, width: "70%", height: "65%", top: "5%", left: "10%", ...sample(ETH_A, 20, seconds) }} />
      <div style={{ ...blob, width: "55%", height: "60%", top: "25%", left: "38%", opacity: 0.75, ...sample(ETH_B, 26, seconds) }} />
      <div style={{ ...blob, width: "50%", height: "55%", bottom: "0%", left: "5%", opacity: 0.6, ...sample(ETH_C, 30, seconds) }} />
      {/* Static grain texture, as in the app. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, var(--fg-overlay-05) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />
    </div>
  );
}
