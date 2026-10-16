// Beat 4: the outfit builder. The phone builder's real screen, one capture per
// state (public/captures/builder-0…5.png: the same page with 0–5 pieces of the
// look). Each piece, cropped from the state it arrives in, flies in from the
// side and lands exactly where the app put it; the screen then crossfades to
// that state, so the board reflows the way the app laid it out, and the real
// total pill counts up to $1,945 · 5 pieces. The lower half of the phone, with
// the catalogue strip, runs out of frame.
//
// The shorts reuse it with their own looks (`data`, `landings`): "Night" on the
// dark theme, "Ask" with the stylist's four pieces arriving from below, where
// the stylist's sheet has just gone (`overlay` draws that sheet leaving).
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, mix, ramp, settle } from "../../motion";
import { M, PAPER, Shot, rand, type Format, SIZE } from "../kit";
import { Phone } from "../Device";
import { Sfx, type SfxName } from "../Sfx";

type BuilderData = typeof M.builder;

/** Landing frame of each piece (local frames). */
export const LANDINGS = [32, 52, 72, 92, 112];

const LAYOUT: Record<Format, { s: number; top: number }> = {
  "16x9": { s: 2.0, top: 44 },
  "1x1": { s: 1.96, top: 42 },
  // Vertical: the whole phone, top bar to tab bar.
  "9x16": { s: 2.1, top: 74 },
};

export function Builder({
  format,
  dur,
  data = M.builder,
  landings = LANDINGS,
  bg = PAPER,
  ground = "light",
  rise = true,
  fly = "sides",
  camera = [0.96, 1.02],
  overlay,
}: {
  format: Format;
  dur: number;
  data?: BuilderData;
  landings?: number[];
  bg?: string;
  ground?: "light" | "dark";
  /** The phone rises into the frame; off when it is already there (after the stylist). */
  rise?: boolean;
  /** Where the pieces fly in from. */
  fly?: "sides" | "below";
  /** The slow push-in on the board, start and end scale. */
  camera?: [number, number];
  /** Drawn on the phone's screen above the board, in screen px × `s`. */
  overlay?: (f: number, s: number) => React.ReactNode;
}) {
  const f = useCurrentFrame();
  const B = data;
  const SCREEN = B.size; // 390 × 844 CSS px
  const LANDINGS = landings;
  const { W, H } = SIZE[format];
  const { s, top } = LAYOUT[format];
  const sw = SCREEN.w * s;
  const sh = SCREEN.h * s;
  const left = (W - sw) / 2;

  // Which state is on screen, and how far into the next.
  const shown = (k: number) => {
    if (k === 0) return 1 - ramp(f, LANDINGS[0] - 3, LANDINGS[0] + 5);
    const inK = ramp(f, LANDINGS[k - 1] - 3, LANDINGS[k - 1] + 5);
    const outK = k < LANDINGS.length ? ramp(f, LANDINGS[k] - 3, LANDINGS[k] + 5) : 0;
    return Math.min(inK, 1 - outK);
  };

  const enter = rise ? ramp(f, 0, 18, easeOut) : 1;
  const board = B.states[B.states.length - 1].canvas;
  const push = mix(camera[0], camera[1], ramp(f, 0, dur, easeInOut));
  const ox = left + (board.x + board.w / 2) * s;
  const oy = top + (board.y + board.h / 2) * s;

  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      {/* Sound: each piece flies in, lands with a snap, and the total ticks up a tone. */}
      {LANDINGS.map((L, i) => (
        <React.Fragment key={i}>
          <Sfx at={L - 16} name="whoosh" volume={0.24} />
          <Sfx at={L} name="snap" volume={0.42} />
          <Sfx at={L + 1} name={`pop-${i}` as SfxName} volume={0.26} />
        </React.Fragment>
      ))}
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: `${ox}px ${oy}px` }}>
        <Phone
          w={sw}
          h={sh}
          s={s}
          ground={ground}
          style={{
            left: left - 11 * s,
            top: top - 11 * s,
            transform: `translateY(${(1 - enter) * 160}px) perspective(2000px) rotateX(${(1 - enter) * 10}deg)`,
            opacity: enter,
          }}
        >
          {B.states.map((st, k) => {
            const o = shown(k);
            return o > 0 ? <Shot key={k} src={st.image} size={SCREEN} scale={s} style={{ left: 0, top: 0, opacity: o }} /> : null;
          })}
          {/* The total pill pops as it changes. */}
          {LANDINGS.map((L, i) => {
            const st = B.states[i + 1];
            const next = LANDINGS[i + 1] ?? Infinity;
            if (!st.pill || f < L + 1 || f >= next - 3) return null;
            const bump = Math.sin(Math.PI * ramp(f, L + 1, L + 11, (t) => t)) * 0.12;
            return (
              <Shot
                key={`pill${i}`}
                src={st.image}
                size={SCREEN}
                crop={st.pill}
                scale={s}
                radius={999}
                style={{ left: st.pill.x * s, top: st.pill.y * s, transform: `scale(${1 + bump})`, transformOrigin: "0% 50%" }}
              />
            );
          })}
          {overlay?.(f, s)}
        </Phone>
        {/* The pieces in flight, in screen coordinates of the phone. */}
        <div style={{ position: "absolute", left, top, width: sw, height: sh, transform: `translateY(${(1 - enter) * 160}px)` }}>
          {LANDINGS.map((L, i) => {
            const st = B.states[i + 1];
            const cell = st.cells[i].cell;
            const start = L - 16;
            if (f < start || f > L + 7) return null;
            const t = settle(f, start, { damping: 14, stiffness: 150, mass: 0.8 });
            const k = 1 - t;
            const fromLeft = i % 2 === 0;
            const dx = fly === "sides" ? (fromLeft ? -1 : 1) * (W * 0.62 + rand(i + 5) * 120) : (rand(i + 5) - 0.5) * 240;
            const dy = fly === "sides" ? (rand(i + 9) - 0.5) * 360 : H * 0.62 + rand(i + 9) * 160;
            const rot = (fromLeft ? -1 : 1) * (fly === "sides" ? 14 + rand(i + 2) * 10 : 6 + rand(i + 2) * 8);
            const fade = 1 - ramp(f, L + 4, L + 7, (x) => x);
            const isFull = i === 0;
            return (
              <Shot
                key={i}
                src={st.image}
                size={SCREEN}
                crop={cell}
                scale={s}
                radius={isFull ? 24 * s : 2 * s}
                style={{
                  left: cell.x * s,
                  top: cell.y * s,
                  opacity: fade,
                  transform: `translate(${dx * k}px, ${dy * k}px) rotate(${rot * k}deg) scale(${1 + 0.16 * k})`,
                  boxShadow: `0 ${30 * k + 4}px ${70 * k + 10}px rgba(20, 18, 14, ${0.08 + 0.14 * Math.min(1, k * 2)})`,
                }}
              />
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
