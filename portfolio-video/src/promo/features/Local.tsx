// "Any language. Any currency." Two scenes of the film GOO-Local:
// - LangSplit: the phone homepage in English and in Ukrainian (two captures of
//   the same screen), split by a divider that sweeps across, after a tap on the
//   footer's real language switch, shown big above the phone.
// - CurrencyReel: the featured sneaker's stores in the switcher's currencies.
//   Each price is a slot reel: the price cut from one currency's capture rolls
//   out as the next currency's rolls in, row by row.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, mix, ramp, settle } from "../../motion";
import { INK, M, PAPER, Shot, SIZE, type Rect } from "../kit";
import { Phone, Tap } from "../Device";
import { DirBlur, Flash, hit, punch, scramble } from "../fx";
import { Sfx, type SfxName } from "../Sfx";

const L = M.features.local;
const SCREEN = L.size; // 390 × 844

const W = SIZE["9x16"].W;
const H = SIZE["9x16"].H;

/** The phone, centred, screen top at `top`, `s` video px per screen px. */
const phoneBox = (s: number, top: number) => ({ s, left: (W - SCREEN.w * s) / 2, top });

// ── LangSplit ────────────────────────────────────────────────────────────────
export const SPLIT = { tap: 16, sweep: [22, 56] as const, back: [66, 82] as const, again: [90, 104] as const };

export function LangSplit({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { s, left, top } = phoneBox(1.74, 392);
  const sw = SCREEN.w * s;
  const sh = SCREEN.h * s;
  // The divider, in screen px: the English page left of it, the Ukrainian right.
  const x = SCREEN.w * (1 - ramp(f, SPLIT.sweep[0], SPLIT.sweep[1], easeInOut) + 0.5 * ramp(f, SPLIT.back[0], SPLIT.back[1], easeInOut) - 0.5 * ramp(f, SPLIT.again[0], SPLIT.again[1], easeInOut));
  const showLine = x > 0.5 && x < SCREEN.w - 0.5;
  const enter = ramp(f, 0, 16, easeOut);

  const sw0 = L.home.en.switch!;
  const swS = 3.1;
  const swW = sw0.size.w * swS;
  const swH = sw0.size.h * swS;
  const tapped = ramp(f, SPLIT.tap + 1, SPLIT.tap + 4, (t) => t);
  const swPunch = punch(f, SPLIT.tap + 1, 0.08, 10);

  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      <Sfx at={SPLIT.tap} name="pop" volume={0.34} />
      <Sfx at={SPLIT.sweep[0]} name="whoosh" volume={0.24} />
      <Sfx at={SPLIT.back[0]} name="whoosh-soft" volume={0.2} />
      <Sfx at={SPLIT.again[0]} name="whoosh-soft" volume={0.2} />
      <Sfx at={SPLIT.again[1]} name="tick-2" volume={0.26} />
      {/* The site's language switch, from its footer. */}
      <div style={{ position: "absolute", left: (W - swW) / 2, top: 120, width: swW, height: swH, transform: `translateY(${(1 - enter) * -60}px) scale(${swPunch})`, opacity: enter }}>
        <Shot src={L.home.en.switch!.image} size={sw0.size} scale={swS} radius={swH / 2} style={{ left: 0, top: 0, opacity: 1 - tapped }} />
        <Shot src={L.home.uk.switch!.image} size={sw0.size} scale={swS} radius={swH / 2} style={{ left: 0, top: 0, opacity: tapped }} />
        <Tap at={SPLIT.tap} x={sw0.size.w * 0.72} y={sw0.size.h / 2} s={swS} />
      </div>
      <Phone w={sw} h={sh} s={s} style={{ left: left - 11 * s, top: top - 11 * s, transform: `translateY(${(1 - enter) * 200}px)`, opacity: enter }}>
        <Shot src={L.home.uk.how.image} size={SCREEN} scale={s} style={{ left: 0, top: 0 }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: x * s, height: sh, overflow: "hidden" }}>
          <Shot src={L.home.en.how.image} size={SCREEN} scale={s} style={{ left: 0, top: 0 }} />
        </div>
        {showLine && (
          <>
            <div style={{ position: "absolute", left: x * s - 2, top: 0, width: 4, height: sh, background: INK, boxShadow: "0 0 30px rgba(0,0,0,0.35)" }} />
            <div
              style={{
                position: "absolute",
                left: x * s,
                top: sh * 0.42,
                width: 92,
                height: 92,
                marginLeft: -46,
                borderRadius: "50%",
                background: INK,
                color: PAPER,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 700,
                fontSize: 34,
                letterSpacing: "-0.02em",
                boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
              }}
            >
              ‹ ›
            </div>
          </>
        )}
      </Phone>
    </AbsoluteFill>
  );
}

// ── CurrencyReel ─────────────────────────────────────────────────────────────
type Cur = keyof typeof L.currency;
export const REEL_ORDER: Cur[] = ["USD", "EUR", "GBP", "CZK", "JPY", "TRY", "UAH"];
const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", CZK: "Kč", JPY: "¥", TRY: "₺", UAH: "₴" };
/** Frame at which the reels start for each currency after the first. */
export const REEL_AT = [0, 12, 28, 44, 60, 76, 94];
const SPIN = 8; // frames a reel takes to roll over
const STAGGER = 2; // between reels

// The cells that roll: each store row's price and the buy bar's "From …",
// wide enough for the widest currency, right- (rows) or left-aligned (bar).
function cells(): Rect[] {
  const all = REEL_ORDER.map((c) => L.currency[c]);
  const rows = all[0].rows.map((_, i) => {
    const ps = all.map((a) => a.rows[i].price);
    const right = Math.max(...ps.map((p) => p.x + p.w));
    const lft = Math.min(...ps.map((p) => p.x));
    return { x: lft - 6, y: ps[0].y - 4, w: right - lft + 10, h: ps[0].h + 8 };
  });
  const bp = all.map((a) => a.price);
  const barL = Math.min(...bp.map((p) => p.x));
  const barR = Math.max(...bp.map((p) => p.x + p.w));
  return [...rows, { x: barL - 4, y: bp[0].y - 4, w: barR - barL + 8, h: bp[0].h + 8 }];
}

export function CurrencyReel({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { s, left, top } = phoneBox(1.74, 392);
  const sw = SCREEN.w * s;
  const sh = SCREEN.h * s;
  const C = cells();
  // Which currency is settled, and the reel in flight.
  let k = 0;
  while (k + 1 < REEL_AT.length && f >= REEL_AT[k + 1]) k++;
  const cur = REEL_ORDER[k];
  const prev = REEL_ORDER[Math.max(0, k - 1)];
  const T = REEL_AT[k];
  const last = k === REEL_ORDER.length - 1;
  const enter = ramp(f, 0, 14, easeOut);
  const cam = mix(1, 1.06, ramp(f, 0, dur, easeInOut)) * punch(f, REEL_AT[REEL_AT.length - 1] + SPIN + 3 * STAGGER, 0.05, 12);

  const code = k === 0 ? cur : scramble(cur, f, T, 8, k);
  const symPop = settle(f, T, { damping: 12, stiffness: 160 });

  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      {REEL_AT.slice(1).map((at, i) => (
        <React.Fragment key={i}>
          <Sfx at={at} name="reel" volume={0.22} />
          {[0, 1, 2, 3].map((j) => (
            <Sfx key={j} at={at + SPIN + j * STAGGER} name={(["tick-0", "tick-1", "tick-2", "tick"] as SfxName[])[j]} volume={0.16} />
          ))}
        </React.Fragment>
      ))}
      <Sfx at={REEL_AT[REEL_AT.length - 1] + SPIN + 3 * STAGGER} name="impact" volume={0.3} />
      {/* The currency's symbol, huge, behind everything. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          width: W,
          top: H * 0.5 - 520,
          textAlign: "center",
          fontFamily: "'Inter Tight', sans-serif",
          fontWeight: 800,
          fontSize: SYMBOL[cur].length > 1 ? 640 : 900,
          lineHeight: 1,
          letterSpacing: "-0.06em",
          color: INK,
          opacity: 0.07,
          transform: `scale(${0.8 + 0.2 * symPop})`,
        }}
      >
        {SYMBOL[cur]}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          width: W,
          top: 150,
          textAlign: "center",
          fontFamily: "'Inter Tight', sans-serif",
          fontWeight: 800,
          fontSize: 150,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          color: INK,
          opacity: enter,
        }}
      >
        {code}
      </div>
      <AbsoluteFill style={{ transform: `scale(${cam})`, transformOrigin: `${W / 2}px ${top + 200 * s}px` }}>
        <Phone w={sw} h={sh} s={s} style={{ left: left - 11 * s, top: top - 11 * s, transform: `translateY(${(1 - enter) * 200}px)`, opacity: enter }}>
          <Shot src={L.currency[f >= T + SPIN + 3 * STAGGER || k === 0 ? cur : prev].stores} size={SCREEN} scale={s} style={{ left: 0, top: 0 }} />
          {k > 0 &&
            C.map((c, j) => {
              const start = T + j * STAGGER;
              const p = ramp(f, start, start + SPIN, easeInOut);
              if (p <= 0 || p >= 1) return null;
              const blur = Math.sin(Math.PI * p) * 7;
              return (
                <div key={j} style={{ position: "absolute", left: c.x * s, top: c.y * s, width: c.w * s, height: c.h * s, overflow: "hidden" }}>
                  <DirBlur y={blur}>
                    <Shot src={L.currency[prev].stores} size={SCREEN} crop={c} scale={s} style={{ left: 0, top: -p * c.h * s }} />
                    <Shot src={L.currency[cur].stores} size={SCREEN} crop={c} scale={s} style={{ left: 0, top: (1 - p) * c.h * s }} />
                  </DirBlur>
                </div>
              );
            })}
          {/* Rows already landed keep the new currency while later ones still roll. */}
          {k > 0 &&
            C.map((c, j) => {
              const start = T + j * STAGGER;
              if (f < start + SPIN || f >= T + SPIN + 3 * STAGGER) return null;
              return <Shot key={`d${j}`} src={L.currency[cur].stores} size={SCREEN} crop={c} scale={s} style={{ left: c.x * s, top: c.y * s }} />;
            })}
        </Phone>
      </AbsoluteFill>
      {last && <Flash at={REEL_AT[REEL_AT.length - 1] + SPIN + 3 * STAGGER} dur={4} max={0.35} />}
    </AbsoluteFill>
  );
}
