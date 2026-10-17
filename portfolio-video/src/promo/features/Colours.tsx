// "Every colour." Scenes of the film GOO-Colours, cut on a 120 BPM beat:
// - Swatches: the filter sheet's thirteen real swatches pop in, one by one.
// - Strobe: a colour a beat. The frame floods with the swatch's own colour
//   (its hex from the catalogue), the real swatch row shows it picked, and the
//   phone shows the real results for it; the name and the sheet's own count
//   ("Show 198 pieces") set huge above.
// - Tee: one tee in its eight colours, a tap on each swatch under the name.
// - Angles: the featured sneaker's ten photos, whipped through.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, ramp, settle } from "../../motion";
import { INK, LIGHT, M, PAPER, Shot, SIZE, type Rect } from "../kit";
import { Phone, Tap } from "../Device";
import { DirBlur, Flash, RGBSplit, hit, punch, shake } from "../fx";
import { Sfx, type SfxName } from "../Sfx";

const C = M.features.colours;
const SCREEN = C.size;
const W = SIZE["9x16"].W;
const H = SIZE["9x16"].H;
const FONT = "'Inter Tight', sans-serif";

/** The beat: 120 BPM at 30 fps. */
export const BEAT = 15;

const MULTI = "conic-gradient(from 0deg, #e53935, #fb8c00, #fdd835, #43a047, #1e88e5, #8e24aa, #e53935)";
const ground = (hex: string) => (hex === "#multicolor" ? MULTI : hex);
/** Light or dark type on a colour. */
const onColour = (hex: string) => {
  if (hex === "#multicolor") return LIGHT;
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? INK : LIGHT;
};

const ROW = C.sheet.row; // the swatch row, page CSS px
const rowS = 2.85; // video px per CSS px for the row card
const rowLeft = (W - ROW.w * rowS) / 2;

/** The real swatch row (`image`), as a floating card at `top`. */
function RowCard({ image, top, style }: { image: string; top: number; style?: React.CSSProperties }) {
  return (
    <Shot
      src={image}
      size={{ w: ROW.w, h: ROW.h }}
      scale={rowS}
      radius={34}
      style={{ left: rowLeft, top, boxShadow: "0 30px 70px rgba(0,0,0,0.22)", ...style }}
    />
  );
}

// ── Swatches (intro) ─────────────────────────────────────────────────────────
export function Swatches({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const sw = C.sheet.swatches;
  const top = 560;
  const card = ramp(f, 0, 12, easeOut);
  const words = ramp(f, 22, 36, easeOut);
  const hex = C.groups.map((g) => (g.hex === "#multicolor" ? "#888" : g.hex));
  const slide = ((f * 9) % (W * 2)) - W;
  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      <Sfx at={0} name="whoosh-soft" volume={0.22} />
      {sw.map((_, i) => (
        <Sfx key={i} at={6 + i * 2} name={(["tick-0", "tick-1", "tick-2"] as SfxName[])[i % 3]} volume={0.12} />
      ))}
      <Sfx at={30} name="riser" volume={0.22} />
      {/* The row's white card, then each real swatch popping into it. */}
      <div style={{ position: "absolute", left: rowLeft, top, width: ROW.w * rowS, height: ROW.h * rowS, borderRadius: 34, background: "#fff", boxShadow: "0 30px 70px rgba(0,0,0,0.16)", transform: `scale(${0.9 + 0.1 * card})`, opacity: card }} />
      {sw.map((s, i) => {
        const p = settle(f, 6 + i * 2, { damping: 11, stiffness: 190, mass: 0.6 });
        const r: Rect = { x: s.rect.x - ROW.x, y: s.rect.y - ROW.y, w: s.rect.w, h: s.rect.h };
        return (
          <Shot
            key={i}
            src={C.sheet.rowNone}
            size={{ w: ROW.w, h: ROW.h }}
            crop={r}
            scale={rowS}
            radius={999}
            style={{ left: rowLeft + r.x * rowS, top: top + r.y * rowS, transform: `scale(${p})`, opacity: Math.min(1, p * 2) }}
          />
        );
      })}
      <div style={{ position: "absolute", left: 84, top: 1000, fontFamily: FONT, fontWeight: 800, fontSize: 196, lineHeight: 1, letterSpacing: "-0.04em", color: INK }}>
        <div style={{ overflow: "hidden", paddingBottom: "0.12em" }}>
          <div style={{ transform: `translateY(${(1 - words) * 1.1}em)` }}>Every</div>
        </div>
        <div style={{ overflow: "hidden", paddingBottom: "0.14em" }}>
          {/* "colour." cut out of the thirteen colours, sliding through it. */}
          <div
            style={{
              transform: `translateY(${(1 - ramp(f, 26, 40, easeOut)) * 1.1}em)`,
              backgroundImage: `linear-gradient(90deg, ${[...hex, ...hex].join(", ")})`,
              backgroundSize: `${W * 2}px 100%`,
              backgroundPosition: `${slide}px 0`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            colour.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Strobe ───────────────────────────────────────────────────────────────────
export const STROBE_ORDER = ["Black", "White", "Grey", "Blue", "Green", "Red", "Brown", "Beige", "Pink", "Violet", "Orange", "Yellow", "Multicolor"];
/** Cut frames: a colour a beat, the last five on every half beat. */
export const STROBE_CUTS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 128, 135, 143, 150];
export const STROBE_DUR = 172;

export function Strobe({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  let k = 0;
  while (k + 1 < STROBE_CUTS.length && f >= STROBE_CUTS[k + 1]) k++;
  const g = C.groups.find((x) => x.name === STROBE_ORDER[k])!;
  const at = STROBE_CUTS[k];
  const ink = onColour(g.hex);
  const count = g.show.replace(/^Show /, "");
  const sw = C.sheet.swatches.find((s) => s.name === g.name)!;
  const split = hit(f, at, 6) * 22;
  const sh = shake(f, at, k >= 8 ? 10 : 5, 6);
  const s = 1.5;
  const sw0 = SCREEN.w * s;
  const sh0 = SCREEN.h * s;
  const top = 640;
  const pz = punch(f, at, k >= 8 ? 0.1 : 0.06, 8);
  const last = k === STROBE_CUTS.length - 1;
  return (
    <AbsoluteFill style={{ background: ground(g.hex), overflow: "hidden" }}>
      {/* Sound: the beat under the cuts. */}
      {STROBE_CUTS.map((c, i) => (
        <React.Fragment key={i}>
          <Sfx at={c} name="kick" volume={0.34} />
          {i < 8 && <Sfx at={c + 7} name="hat" volume={0.12} />}
          <Sfx at={c + 1} name="tick" volume={0.14} />
        </React.Fragment>
      ))}
      <Sfx at={STROBE_CUTS[STROBE_CUTS.length - 1]} name="impact" volume={0.34} />
      <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <RGBSplit px={split}>
          {/* The colour's name and its count, huge. */}
          <div style={{ position: "absolute", left: 0, width: W, top: 70, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: g.name.length > 7 ? 180 : 230, lineHeight: 1, letterSpacing: "-0.05em", color: ink, transform: `scale(${pz})` }}>
            {g.name}
          </div>
          <div style={{ position: "absolute", left: 0, width: W, top: 300, textAlign: "center", fontFamily: FONT, fontWeight: 600, fontSize: 52, letterSpacing: "-0.01em", color: ink, opacity: 0.85 }}>
            {count}
          </div>
          <RowCard image={g.row} top={420} style={{ transform: `scale(${0.96 + 0.04 * (pz - 1) / 0.06})` }} />
          {/* Tap takes screen px × s; here s is the row card's scale. */}
          <div style={{ position: "absolute", left: rowLeft, top: 420 }}>
            <Tap at={at} x={sw.rect.x - ROW.x + sw.rect.w / 2} y={sw.rect.y - ROW.y + sw.rect.h / 2} s={rowS} />
          </div>
          <div style={{ position: "absolute", left: 0, top: 0, transform: `scale(${pz})`, transformOrigin: `${W / 2}px ${top + sh0 / 2}px`, width: W, height: H }}>
            <Phone w={sw0} h={sh0} s={s} ground={ink === LIGHT ? "dark" : "light"} style={{ left: (W - sw0) / 2 - 11 * s, top: top - 11 * s }}>
              <Shot src={g.grid!} size={SCREEN} scale={s} style={{ left: 0, top: 0 }} />
            </Phone>
          </div>
        </RGBSplit>
      </AbsoluteFill>
      {last && <Flash at={at} dur={5} max={0.6} />}
    </AbsoluteFill>
  );
}

// ── Tee ──────────────────────────────────────────────────────────────────────
export const TEE_EVERY = 11;
export function Tee({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const T = C.tee;
  // The first colour shows from the start; each next one after a tap on its swatch.
  const switchAt = (i: number) => 8 + i * TEE_EVERY;
  let idx = 0;
  while (idx + 1 < T.length && f >= switchAt(idx + 1)) idx++;
  const v = T[idx];
  const s = 1.7;
  const sw0 = SCREEN.w * s;
  const sh0 = SCREEN.h * s;
  const top = 418;
  const enter = ramp(f, 0, 10, easeOut);
  const pz = punch(f, switchAt(idx), 0.04, 8);
  return (
    <AbsoluteFill style={{ background: v.color ?? "#888", overflow: "hidden" }}>
      {T.map((_, i) => (i > 0 ? <Sfx key={i} at={switchAt(i) - 1} name={`pop-${(i - 1) % 5}` as SfxName} volume={0.26} /> : null))}
      <div style={{ position: "absolute", left: 0, width: W, top: 74, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 132, lineHeight: 1.02, letterSpacing: "-0.04em", color: onColour(rgbHex(v.color)), opacity: enter }}>
        One tee.
        <br />
        {T.length} colours.
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${pz})`, transformOrigin: `${W / 2}px ${top + 400}px` }}>
        <Phone w={sw0} h={sh0} s={s} style={{ left: (W - sw0) / 2 - 11 * s, top: top - 11 * s, transform: `translateY(${(1 - enter) * 200}px)`, opacity: enter }}>
          <Shot src={v.image} size={SCREEN} scale={s} style={{ left: 0, top: 0 }} />
          {T.map((t, i) => (i > 0 ? <Tap key={i} at={switchAt(i) - 1} x={v.swatches[i].x + v.swatches[i].w / 2} y={v.swatches[i].y + v.swatches[i].h / 2} s={s} /> : null))}
        </Phone>
      </div>
    </AbsoluteFill>
  );
}

/** "rgb(r, g, b)" → "#rrggbb". */
function rgbHex(c: string | null): string {
  const m = c?.match(/\d+/g);
  if (!m) return "#888888";
  return "#" + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, "0")).join("");
}

// ── Angles ───────────────────────────────────────────────────────────────────
export const ANGLE_EVERY = 8;
export function Angles({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const G = C.gallery;
  const card = G.card;
  const s = 2.6;
  const cw = card.w * s;
  const ch = card.h * s;
  const left = (W - cw) / 2;
  const top = 560;
  const n = G.photos.length;
  const i = Math.min(n - 1, Math.max(0, Math.floor((f - 10) / ANGLE_EVERY)));
  const at = 10 + i * ANGLE_EVERY;
  const p = i === 0 && f < 10 ? 1 : ramp(f, at, at + 5, easeInOut);
  const blur = Math.sin(Math.PI * p) * 18;
  const enter = ramp(f, 0, 10, easeOut);
  const words = ramp(f, 4, 18, easeOut);
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      {G.photos.map((_, k) => (k > 0 ? <Sfx key={k} at={10 + k * ANGLE_EVERY} name="hat" volume={0.18} /> : null))}
      {G.photos.map((_, k) => (k > 0 ? <Sfx key={`w${k}`} at={10 + k * ANGLE_EVERY} name="whoosh-soft" volume={0.08} /> : null))}
      <div style={{ position: "absolute", left: 84, top: 150, fontFamily: FONT, fontWeight: 800, fontSize: 168, lineHeight: 1, letterSpacing: "-0.04em", color: LIGHT }}>
        <div style={{ overflow: "hidden", paddingBottom: "0.12em" }}>
          <div style={{ transform: `translateY(${(1 - words) * 1.1}em)` }}>Every</div>
        </div>
        <div style={{ overflow: "hidden", paddingBottom: "0.12em" }}>
          <div style={{ transform: `translateY(${(1 - ramp(f, 8, 22, easeOut)) * 1.1}em)` }}>angle.</div>
        </div>
      </div>
      <div style={{ position: "absolute", left, top, width: cw, height: ch, borderRadius: 26 * s * 0.6, overflow: "hidden", opacity: enter, transform: `translateY(${(1 - enter) * 120}px)`, boxShadow: "0 40px 100px rgba(0,0,0,0.5)" }}>
        <DirBlur x={blur}>
          {i > 0 && p < 1 && <Shot src={G.photos[i - 1]} size={{ w: card.w, h: card.h }} scale={s} style={{ left: -p * cw, top: 0 }} />}
          <Shot src={G.photos[i]} size={{ w: card.w, h: card.h }} scale={s} style={{ left: i > 0 ? (1 - p) * cw : 0, top: 0 }} />
        </DirBlur>
      </div>
    </AbsoluteFill>
  );
}

