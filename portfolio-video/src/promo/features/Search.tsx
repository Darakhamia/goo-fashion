// "Find it." Scenes of the film GOO-Search, all on the real phone browse:
// - Typing: "jacket" typed into search a key at a time (a capture per key),
//   the query set huge above the phone and the app's own count rolling down
//   554 → 148 → 44 → 26.
// - Sort: the real Sort & filter sheet rises, "Price: low to high" is tapped,
//   and the cards fly from their places in one order to their places in the
//   other (each card is its own capture, from the order it lands in).
// - Filter: black is picked in the sheet ("Show 26 pieces" → "Show 14
//   pieces"), the cards that are not black drop out, the rest close up.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeDrawer, easeInOut, easeOut, mix, ramp } from "../../motion";
import { INK, M, PAPER, Shot, SIZE, type Rect } from "../kit";
import { Phone, Tap } from "../Device";
import { DirBlur, Flash, punch } from "../fx";
import { Sfx, type SfxName } from "../Sfx";

const S = M.features.search;
const SCREEN = S.size;
const SHEET = M.features.colours.sheet.rect; // the phone sheet: below the 56 px header strip
const W = SIZE["9x16"].W;
const FONT = "'Inter Tight', sans-serif";
const PHONE = { s: 1.74, top: 392 };
const SEARCH_BTN = { x: 299, y: 90 }; // the toolbar's search and filter buttons (screen px)
const FILTER_BTN = { x: 345, y: 90 };
const TABS_TOP = 784; // the tab bar's layer starts here (pocket capture)

/** All pieces before a query: the sheet's own count with nothing picked (colours-sheet.jpg, "Show 554 pieces"). */
const ALL = 554;
const num = (t: string | null | undefined) => (t ? parseInt(t.replace(/[^\d]/g, ""), 10) : ALL);

/** A number that rolls to its next value: `steps` are [frame, text]. */
function Roll({ steps, size, style }: { steps: [number, string][]; size: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame();
  let k = 0;
  while (k + 1 < steps.length && f >= steps[k + 1][0]) k++;
  const [at, cur] = steps[k];
  const prev = k > 0 ? steps[k - 1][1] : cur;
  const p = k > 0 && prev !== cur ? ramp(f, at, at + 7, easeInOut) : 1;
  const line = size * 1.1;
  return (
    <div style={{ position: "absolute", height: line, overflow: "hidden", fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: `${line}px`, letterSpacing: "-0.04em", ...style }}>
      <DirBlur y={Math.sin(Math.PI * p) * 10}>
        {p < 1 && <div style={{ position: "absolute", left: 0, right: 0, top: -p * line }}>{prev}</div>}
        <div style={{ position: "absolute", left: 0, right: 0, top: (1 - p) * line }}>{cur}</div>
      </DirBlur>
    </div>
  );
}

const phoneStyle = (enter: number): React.CSSProperties => ({
  left: (W - SCREEN.w * PHONE.s) / 2 - 11 * PHONE.s,
  top: PHONE.top - 11 * PHONE.s,
  transform: `translateY(${(1 - enter) * 200}px)`,
  opacity: enter,
});

// ── Typing ───────────────────────────────────────────────────────────────────
export const TYPE_KEYS = [26, 32, 38, 44, 50, 56];
export function Typing({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const s = PHONE.s;
  const enter = ramp(f, 0, 14, easeOut);
  const open = f >= 16;
  const chars = TYPE_KEYS.filter((k) => f >= k).length;
  const shot = !open ? "captures/search-0.jpg" : S.typed[chars].image;
  const caretOn = Math.floor(f / 8) % 2 === 0 || (f >= TYPE_KEYS[0] && f < TYPE_KEYS[TYPE_KEYS.length - 1] + 4);
  const q = S.query.slice(0, chars);
  const steps: [number, string][] = [[0, String(ALL)], ...TYPE_KEYS.map((k, i) => [k + 1, String(num(S.typed[i + 1].count))] as [number, string])];
  const out = ramp(f, dur - 12, dur, easeInOut);
  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      <Sfx at={16} name="pop" volume={0.3} />
      {TYPE_KEYS.map((k, i) => <Sfx key={i} at={k} name={`key-${i % 3}` as SfxName} volume={0.34} />)}
      {[1, 2, 3].map((i) => <Sfx key={`t${i}`} at={TYPE_KEYS[i - 1] + 1} name={`tick-${i - 1}` as SfxName} volume={0.2} />)}
      <Sfx at={dur - 12} name="whoosh" volume={0.24} />
      {/* The query, huge, with the app's count under it. */}
      <div style={{ position: "absolute", left: 0, width: W, top: 70, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 168, lineHeight: 1, letterSpacing: "-0.04em", color: INK, transform: `scale(${1 + out * 0.6})`, opacity: 1 - out }}>
        {q || " "}
        <span style={{ display: "inline-block", width: 10, height: 140, marginLeft: 8, background: INK, verticalAlign: "-14px", opacity: caretOn ? ramp(f, 2, 6) : 0 }} />
      </div>
      <Roll steps={steps} size={84} style={{ left: 0, width: W / 2 + 10, top: 262, textAlign: "right", color: INK, opacity: (1 - out) * ramp(f, 4, 14) }} />
      <div style={{ position: "absolute", left: W / 2 + 30, top: 262, fontFamily: FONT, fontWeight: 600, fontSize: 84 * 0.6, lineHeight: `${84 * 1.1}px`, color: INK, opacity: 0.55 * (1 - out) * ramp(f, 4, 14) }}>pieces</div>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${1 + out * 0.25})`, transformOrigin: `${W / 2}px ${PHONE.top + 200}px`, opacity: 1 - out }}>
        <Phone w={SCREEN.w * s} h={SCREEN.h * s} s={s} style={phoneStyle(enter)}>
          <Shot src={shot} size={SCREEN} scale={s} style={{ left: 0, top: 0 }} />
          <Tap at={14} x={SEARCH_BTN.x} y={SEARCH_BTN.y} s={s} />
        </Phone>
      </div>
      <Flash at={dur - 2} dur={3} max={0.6} />
    </AbsoluteFill>
  );
}

// ── The sheet over a page ────────────────────────────────────────────────────
/** The phone sheet risen by `up` (0 hidden, 1 open), its scrim with it; `b` crossfades `a` to `b` by `t`. */
function Sheet({ a, b, t, up, s }: { a: string; b: string; t: number; up: number; s: number }) {
  if (up <= 0) return null;
  const top = (SHEET.y + (1 - up) * (SCREEN.h - SHEET.y + 10)) * s;
  const r = `${24 * s}px ${24 * s}px 0 0`;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: `blur(${4 * s}px)`, opacity: up }} />
      <Shot src={b} size={SCREEN} crop={SHEET} scale={s} radius={r} style={{ left: 0, top }} />
      {t < 1 && <Shot src={a} size={SCREEN} crop={SHEET} scale={s} radius={r} style={{ left: 0, top, opacity: 1 - t }} />}
    </>
  );
}

type State = typeof S.listed;

/**
 * The cards of one state flying to their places in another. The header
 * crossfades, the grid is redrawn card by card, the tab bar stays on top.
 */
function Flip({ from, to, t0, t1, s }: { from: State; to: State; t0: number; t1: number; s: number }) {
  const f = useCurrentFrame();
  if (f < t0) return <Shot src={from.image} size={SCREEN} scale={s} style={{ left: 0, top: 0 }} />;
  if (f >= t1 + 10) return <Shot src={to.image} size={SCREEN} scale={s} style={{ left: 0, top: 0 }} />;
  const vis = (st: State) => st.cards.filter((c) => c.rect.y < SCREEN.h);
  const hrefs = [...new Set([...vis(from), ...vis(to)].map((c) => c.href))];
  const card = (st: State, h: string | null) => st.cards.find((c) => c.href === h);
  const at = (st: State, h: string | null) => card(st, h)?.rect ?? null;
  const top = Math.min(from.cards[0].rect.y, to.cards[0].rect.y) - 8;
  const head = ramp(f, t0, t1, easeInOut);
  return (
    <>
      <Shot src={to.image} size={SCREEN} scale={s} style={{ left: 0, top: 0 }} />
      <Shot src={from.image} size={SCREEN} crop={{ x: 0, y: 0, w: SCREEN.w, h: top }} scale={s} style={{ left: 0, top: 0, opacity: 1 - head }} />
      <div style={{ position: "absolute", left: 0, top: top * s, width: SCREEN.w * s, height: (TABS_TOP - top) * s, background: PAPER }} />
      {hrefs.map((h) => {
        // Staggered in the order of the screen each card belongs to.
        const i = Math.max(0, vis(to).findIndex((c) => c.href === h));
        const o = Math.max(0, vis(from).findIndex((c) => c.href === h));
        const a = at(from, h);
        const b = at(to, h);
        const aOn = !!a && a.y < SCREEN.h;
        const bOn = !!b && b.y < SCREEN.h;
        if (aOn && bOn) {
          // On screen in both orders: it flies across, lifted.
          const t = ramp(f, t0 + 2 + i, t0 + 20 + i, easeInOut);
          const lift = Math.sin(Math.PI * t);
          return (
            <Shot
              key={h}
              src={card(to, h)!.image}
              size={{ w: b!.w, h: b!.h }}
              scale={s}
              radius={16 * s}
              style={{ left: mix(a!.x, b!.x, t) * s, top: mix(a!.y, b!.y, t) * s, transform: `scale(${1 + 0.06 * lift})`, boxShadow: `0 ${20 * lift}px ${50 * lift}px rgba(0,0,0,${0.25 * lift})`, zIndex: Math.round(lift * 10) }}
            />
          );
        }
        if (aOn) {
          // Leaves the screen: it drops out where it was.
          const k = ramp(f, t0 + o, t0 + 9 + o, easeOut);
          return <Shot key={h} src={card(from, h)!.image} size={{ w: a!.w, h: a!.h }} scale={s} radius={16 * s} style={{ left: a!.x * s, top: a!.y * s, transform: `scale(${1 - 0.3 * k})`, opacity: 1 - k }} />;
        }
        // Comes on screen: dealt in from below.
        const k = ramp(f, t0 + 2 + i * 2, t0 + 15 + i * 2, easeOut);
        return (
          <Shot
            key={h}
            src={card(to, h)!.image}
            size={{ w: b!.w, h: b!.h }}
            scale={s}
            radius={16 * s}
            style={{ left: b!.x * s, top: (b!.y + (1 - k) * 280) * s, opacity: Math.min(1, k * 1.6), transform: `rotate(${(1 - k) * (i % 2 ? 6 : -6)}deg)`, boxShadow: `0 ${24 * (1 - k)}px ${60 * (1 - k)}px rgba(0,0,0,${0.2 * (1 - k)})` }}
          />
        );
      })}
      <Shot src={to.image} size={SCREEN} crop={{ x: 0, y: TABS_TOP, w: SCREEN.w, h: SCREEN.h - TABS_TOP }} scale={s} style={{ left: 0, top: TABS_TOP * s }} />
    </>
  );
}

// ── Sort and Filter ──────────────────────────────────────────────────────────
type Step = { open: number; pick: number; show: number; flip: [number, number] };
export const SORT: Step = { open: 10, pick: 40, show: 58, flip: [72, 96] };
export const FILTER: Step = { open: 8, pick: 36, show: 56, flip: [70, 92] };

export function SheetScene({ mode, dur }: { mode: "sort" | "filter"; dur: number }) {
  const f = useCurrentFrame();
  const s = PHONE.s;
  const T = mode === "sort" ? SORT : FILTER;
  const from = mode === "sort" ? S.listed : S.sorted;
  const to = mode === "sort" ? S.sorted : S.black;
  const sheetBefore = mode === "sort" ? S.sheet.open : S.sheet.sorted;
  const sheetAfter = mode === "sort" ? S.sheet.sorted : S.sheet.black;
  const target: Rect = mode === "sort" ? S.sheet.chip : S.sheet.swatch;
  const up = ramp(f, T.open + 2, T.open + 16, easeDrawer) - ramp(f, T.show + 2, T.show + 14, easeInOut);
  const picked = ramp(f, T.pick + 1, T.pick + 4, (t) => t);
  const enter = mode === "sort" ? ramp(f, 0, 10, easeOut) : 1;
  const word = mode === "sort" ? "Sort." : "Filter.";
  const pz = punch(f, T.pick + 1, 0.08, 10);
  const counts: [number, string][] = [[0, String(num(S.sheet.showBefore))], [T.pick + 1, String(num(S.sheet.showAfter))]];
  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      <Sfx at={T.open} name="pop" volume={0.28} />
      <Sfx at={T.open + 2} name="whoosh-soft" volume={0.2} />
      <Sfx at={T.pick} name="snap" volume={0.34} />
      <Sfx at={T.show} name="pop" volume={0.28} />
      <Sfx at={T.flip[0]} name="whoosh" volume={0.22} />
      {[0, 1, 2].map((i) => <Sfx key={i} at={T.flip[1] - 6 + i * 3} name={`tick-${i}` as SfxName} volume={0.18} />)}
      <div style={{ position: "absolute", left: mode === "sort" ? 0 : 84, width: mode === "sort" ? W : undefined, top: 96, textAlign: mode === "sort" ? "center" : "left", fontFamily: FONT, fontWeight: 800, fontSize: 196, lineHeight: 1, letterSpacing: "-0.04em", color: INK, transform: `scale(${pz})`, transformOrigin: "50% 60%", opacity: ramp(f, 0, 8) }}>
        {word}
      </div>
      {mode === "filter" && (
        <>
          <Roll steps={counts} size={150} style={{ right: 84, width: 400, top: 112, textAlign: "right", color: INK, opacity: ramp(f, T.pick - 6, T.pick) }} />
        </>
      )}
      <Phone w={SCREEN.w * s} h={SCREEN.h * s} s={s} style={phoneStyle(enter)}>
        <Flip from={from} to={to} t0={T.flip[0]} t1={T.flip[1]} s={s} />
        <Sheet a={sheetBefore} b={sheetAfter} t={picked} up={up} s={s} />
        <Tap at={T.open} x={FILTER_BTN.x} y={FILTER_BTN.y} s={s} />
        <Tap at={T.pick} x={target.x + target.w / 2} y={target.y + target.h / 2} s={s} />
        <Tap at={T.show} x={S.sheet.show.x + S.sheet.show.w / 2} y={S.sheet.show.y + S.sheet.show.h / 2} s={s} />
      </Phone>
    </AbsoluteFill>
  );
}
