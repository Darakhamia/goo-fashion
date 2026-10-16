// The three shorts: vertical (1080×1920), with quiet sound, 15–16 s each, built
// from the same captures and scenes as the promo (STORYBOARD.md, "Shorts").
//   Night:  the dark theme. A dark outerwear wall, a darker look on the builder.
//   Ask:    the stylist answers a question; "Build this look" fills the builder.
//   Pocket: the phone site in the hand: results, the sneaker, its stores, the bag.
// Each one loops: it ends on its type cards' ground, which is its frame 0.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { easeDrawer, ramp } from "../motion";
import { INK, M, PAPER, Shot } from "./kit";
import { TypeCard } from "./TypeCard";
import { Catalogue } from "./scenes/Catalogue";
import { Builder } from "./scenes/Builder";
import { Stylist } from "./scenes/Stylist";
import { Pocket } from "./scenes/Pocket";
import { End } from "./scenes/End";
import { Sfx, SoundOn, type SfxName } from "./Sfx";

export type Short = "night" | "ask" | "pocket";
type Beat = { from: number; dur: number };

const FORMAT = "9x16" as const;
const TYPE = { size: 196, x: 84 };

// In frames at 30 fps.
export const SHORTS = {
  night: {
    open: { from: 0, dur: 60 }, // "Dress for / tonight."
    catalogue: { from: 60, dur: 120 }, // the dark outerwear wall
    snap: { from: 180, dur: 54 }, // "Snap it / together."
    builder: { from: 234, dur: 135 }, // five pieces, $1,779
    end: { from: 369, dur: 96 },
  },
  ask: {
    open: { from: 0, dur: 66 }, // "Not sure / what to / wear?"
    stylist: { from: 66, dur: 154 }, // the question, the answer, a tap on "Build this look"
    builder: { from: 220, dur: 112 }, // the sheet goes; four pieces, $1,126
    done: { from: 332, dur: 54 }, // "Ask. / Build. / Wear."
    end: { from: 386, dur: 96 },
  },
  pocket: {
    open: { from: 0, dur: 72 }, // "Every / store. / In your / pocket."
    phone: { from: 72, dur: 225 }, // results → the sneaker → its stores → the bag
    tap: { from: 297, dur: 60 }, // "Best price. / One tap."
    end: { from: 357, dur: 96 },
  },
} satisfies Record<Short, Record<string, Beat>>;

export const shortDuration = (name: Short) => {
  const beats = Object.values(SHORTS[name]) as Beat[];
  return Math.max(...beats.map((b) => b.from + b.dur));
};

/** Frames for checking each short's key beats. */
export const SHORT_STILLS: Record<Short, number[]> = {
  night: [40, 60 + 112, 180 + 40, 234 + 128, 369 + 76],
  ask: [46, 66 + 40, 66 + 140, 220 + 8, 220 + 100, 332 + 40, 386 + 76],
  pocket: [52, 72 + 30, 72 + 92, 72 + 116, 72 + 180, 72 + 215, 297 + 40, 357 + 76],
};

const PAD: Record<Short, SfxName> = { night: "pad-night", ask: "pad-ask", pocket: "pad-pocket" };

const seq = (b: Beat, node: React.ReactNode) => (
  <Sequence from={b.from} durationInFrames={b.dur}>
    {node}
  </Sequence>
);

// "Ask": the stylist's sheet leaving as "Build this look" opens the builder.
// At its first frame this is the stylist scene's last: the reply capture,
// whole. It hands over at once to its parts: the sheet, cropped from the same
// capture, slides down, and the app's scrim over the builder (StylistDrawer:
// bg-black/60 backdrop-blur-sm) clears.
const S = M.ask.stylist;
function SheetLeaves(f: number, s: number) {
  const sheet = S.sheet;
  const slide = ramp(f, 1, 17, easeDrawer);
  const scrim = 1 - ramp(f, 2, 14);
  if (slide >= 1) return null;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.6)", backdropFilter: `blur(${4 * s}px)`, opacity: scrim }} />
      <Shot src={S.reply} size={S.size} crop={sheet} scale={s} style={{ left: sheet.x * s, top: (sheet.y + slide * (S.size.h - sheet.y + 20)) * s }} />
      <Shot src={S.reply} size={S.size} scale={s} style={{ left: 0, top: 0, opacity: f < 1 ? 1 : 0 }} />
    </>
  );
}

export function Shorts({ name }: { name: Short }) {
  const card = (b: Beat, lines: string[], tone: "dark" | "light") => seq(b, <TypeCard lines={lines} dur={b.dur} size={TYPE.size} x={TYPE.x} tone={tone} />);
  let body: React.ReactNode;
  if (name === "night") {
    const B = SHORTS.night;
    const dark = M.night.catalogue.background; // the site's dark page, rgb(10, 10, 10)
    body = (
      <>
        {card(B.open, ["Dress for", "tonight."], "dark")}
        {seq(B.catalogue, <Catalogue format={FORMAT} dur={B.catalogue.dur} data={M.night.catalogue} bg={dark} />)}
        {card(B.snap, ["Snap it", "together."], "dark")}
        {seq(B.builder, <Builder format={FORMAT} dur={B.builder.dur} data={M.night.builder} bg={dark} ground="dark" />)}
        {seq(B.end, <End format={FORMAT} dur={B.end.dur} theme="dark" />)}
      </>
    );
  } else if (name === "ask") {
    const B = SHORTS.ask;
    body = (
      <>
        {card(B.open, ["Not sure", "what to", "wear?"], "light")}
        {/* Ends framed exactly as the builder starts: the whole phone, s 2.1. */}
        {seq(B.stylist, <Stylist format={FORMAT} dur={B.stylist.dur} data={M.ask.stylist} zoom={{ z0: 2.7, z1: 2.0, z2: 2.1, endY: 422 }} tap={B.stylist.dur - 12} />)}
        {seq(
          B.builder,
          <Builder format={FORMAT} dur={B.builder.dur} data={M.ask.builder} landings={[30, 46, 62, 78]} rise={false} fly="below" camera={[1, 1.04]} overlay={SheetLeaves} />,
        )}
        {card(B.done, ["Ask.", "Build.", "Wear."], "light")}
        {seq(B.end, <End format={FORMAT} dur={B.end.dur} theme="light" />)}
      </>
    );
  } else {
    const B = SHORTS.pocket;
    body = (
      <>
        {card(B.open, ["Every", "store.", "In your", "pocket."], "light")}
        {seq(B.phone, <Pocket format={FORMAT} dur={B.phone.dur} />)}
        {card(B.tap, ["Best price.", "One tap."], "light")}
        {seq(B.end, <End format={FORMAT} dur={B.end.dur} theme="light" />)}
      </>
    );
  }
  return (
    <SoundOn.Provider value>
      <AbsoluteFill style={{ background: name === "night" ? INK : PAPER }}>
        <Sfx at={0} name={PAD[name]} volume={0.16} />
        {body}
      </AbsoluteFill>
    </SoundOn.Provider>
  );
}
