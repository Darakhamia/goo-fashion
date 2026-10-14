// The promo: type cards and product shots, cut on the beat (STORYBOARD.md §2).
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BEATS } from "./timeline";
import { INK, type Format } from "./kit";
import { TypeCard } from "./TypeCard";
import { Catalogue } from "./scenes/Catalogue";
import { Builder } from "./scenes/Builder";
import { Stylist } from "./scenes/Stylist";
import { Product } from "./scenes/Product";
import { End } from "./scenes/End";
import { Sfx, SoundOn } from "./Sfx";

/** The words, set per format: 1:1 and 9:16 get their own line breaks. */
const TYPE: Record<Format, { size: number; x: number; every: string[]; build: string[]; ask: string[]; find: string[]; findSize: number }> = {
  "16x9": {
    size: 172,
    x: 128,
    every: ["Every store.", "One wardrobe."],
    build: ["Build the look."],
    ask: ["Ask the AI stylist."],
    find: ["Find where to buy", "every piece."],
    findSize: 164,
  },
  "1x1": {
    size: 144,
    x: 84,
    every: ["Every store.", "One wardrobe."],
    build: ["Build", "the look."],
    ask: ["Ask the", "AI stylist."],
    find: ["Find where", "to buy", "every piece."],
    findSize: 128,
  },
  "9x16": {
    size: 196,
    x: 84,
    every: ["Every", "store.", "One", "wardrobe."],
    build: ["Build", "the look."],
    ask: ["Ask the", "AI stylist."],
    find: ["Find where", "to buy", "every piece."],
    findSize: 168,
  },
};

/** `sound`: the vertical cut carries sound effects and a quiet pad; the 16:9
 *  and 1:1 loops are silent. */
export function Promo({ format, sound = false }: { format: Format; sound?: boolean }) {
  const T = TYPE[format];
  const seq = (b: { from: number; dur: number }, node: React.ReactNode) => (
    <Sequence from={b.from} durationInFrames={b.dur}>
      {node}
    </Sequence>
  );
  return (
    <SoundOn.Provider value={sound}>
      <AbsoluteFill style={{ background: INK }}>
        <Sfx at={0} name="pad" volume={0.16} />
        {seq(BEATS.every, <TypeCard lines={T.every} dur={BEATS.every.dur} size={T.size} x={T.x} />)}
        {seq(BEATS.catalogue, <Catalogue format={format} dur={BEATS.catalogue.dur} />)}
        {seq(BEATS.build, <TypeCard lines={T.build} dur={BEATS.build.dur} size={T.size} x={T.x} />)}
        {seq(BEATS.builder, <Builder format={format} dur={BEATS.builder.dur} />)}
        {seq(BEATS.ask, <TypeCard lines={T.ask} dur={BEATS.ask.dur} size={T.size} x={T.x} />)}
        {seq(BEATS.stylist, <Stylist format={format} dur={BEATS.stylist.dur} />)}
        {seq(BEATS.find, <TypeCard lines={T.find} dur={BEATS.find.dur} size={T.findSize} x={T.x} />)}
        {seq(BEATS.product, <Product format={format} dur={BEATS.product.dur} />)}
        {seq(BEATS.end, <End format={format} dur={BEATS.end.dur} />)}
      </AbsoluteFill>
    </SoundOn.Provider>
  );
}
