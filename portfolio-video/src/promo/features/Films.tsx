// The three feature films: vertical (1080×1920), quiet sound, each about
// something else the site does (STORYBOARD.md, "Feature films").
//   Local:   the gooey word in two languages, the homepage switching to
//            Ukrainian, the stores' prices rolling through seven currencies.
//   Colours: the filter's thirteen colours cut on the beat, one tee in eight
//            colours, one sneaker's ten photos.
//   Search:  "jacket" typed into search, the results sorted and narrowed.
// Each loops through its first frame.
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { easeInOut, ramp } from "../../motion";
import { INK, PAPER, SIZE } from "../kit";
import { TypeCard } from "../TypeCard";
import { End } from "../scenes/End";
import { Sfx, SoundOn, type SfxName } from "../Sfx";
import { Morph } from "./Morph";
import { CurrencyReel, LangSplit } from "./Local";
import { Angles, STROBE_DUR, Strobe, Swatches, Tee } from "./Colours";
import { SheetScene, Typing } from "./Search";

export type Film = "local" | "colours" | "search";
type Beat = { from: number; dur: number };

export const FILMS = {
  local: {
    morph: { from: 0, dur: 196 }, // GOO → Outfits → Looks ⟶ glitch ⟶ Луки → Стиль → Мода
    split: { from: 178, dur: 128 }, // the homepage, English | Ukrainian
    any: { from: 306, dur: 46 }, // "Any / currency."
    reel: { from: 352, dur: 136 }, // prices roll through seven currencies
    end: { from: 488, dur: 96 },
  },
  colours: {
    swatches: { from: 0, dur: 60 }, // the thirteen swatches, "Every colour."
    strobe: { from: 60, dur: STROBE_DUR }, // a colour a beat
    tee: { from: 232, dur: 104 }, // one tee, eight colours
    angles: { from: 336, dur: 100 }, // ten photos
    end: { from: 436, dur: 96 },
  },
  search: {
    typing: { from: 0, dur: 96 }, // "jacket", 554 → 26
    sort: { from: 96, dur: 110 }, // Price: low to high, the cards fly
    filter: { from: 206, dur: 100 }, // Black: 26 → 14
    find: { from: 306, dur: 54 }, // "Find it. / Fast."
    end: { from: 360, dur: 96 },
  },
} satisfies Partial<Record<Film, Record<string, Beat>>>;

export const filmDuration = (name: Film) => {
  const beats = Object.values((FILMS as Record<string, Record<string, Beat>>)[name]);
  return Math.max(...beats.map((b) => b.from + b.dur));
};

/** Frames for checking each film's key moments. */
export const FILM_STILLS: Partial<Record<Film, number[]>> = {
  local: [30, 70, 94, 130, 186, 220, 262, 330, 380, 420, 470, 560],
  colours: [20, 50, 64, 100, 160, 200, 222, 245, 290, 330, 350, 380, 420, 500],
  search: [10, 30, 50, 80, 110, 140, 160, 175, 200, 230, 250, 280, 300, 330, 420],
};

const PAD: Record<Film, SfxName> = { local: "pad-local", colours: "pad-colours", search: "pad-search" };

const seq = (b: Beat, node: React.ReactNode) => (
  <Sequence from={b.from} durationInFrames={b.dur}>
    {node}
  </Sequence>
);

/** Reveals its children through a circle growing from the frame's centre over `dur` frames. */
function CircleIn({ dur = 18, children }: { dur?: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const { W, H } = SIZE["9x16"];
  const r = ramp(f, 0, dur, easeInOut) * Math.hypot(W / 2, H / 2);
  return <AbsoluteFill style={{ clipPath: f >= dur ? undefined : `circle(${r}px at 50% 50%)` }}>{children}</AbsoluteFill>;
}

const card = (b: Beat, lines: string[], tone: "dark" | "light", size = 196) => seq(b, <TypeCard lines={lines} dur={b.dur} size={size} x={84} tone={tone} />);

export function Films({ name }: { name: Film }) {
  let body: React.ReactNode = null;
  let ground = INK;
  if (name === "local") {
    const B = FILMS.local;
    body = (
      <>
        {seq(B.morph, <Morph dur={B.morph.dur} />)}
        {seq(
          B.split,
          <CircleIn>
            <LangSplit dur={B.split.dur} />
          </CircleIn>,
        )}
        <Sequence from={B.split.from} durationInFrames={20}>
          <Sfx at={0} name="whoosh" volume={0.24} />
        </Sequence>
        {card(B.any, ["Any", "currency."], "light")}
        {seq(B.reel, <CurrencyReel dur={B.reel.dur} />)}
        {seq(B.end, <End format="9x16" dur={B.end.dur} theme="dark" />)}
      </>
    );
  }
  if (name === "colours") {
    const B = FILMS.colours;
    ground = PAPER;
    body = (
      <>
        {seq(B.swatches, <Swatches dur={B.swatches.dur} />)}
        {seq(B.strobe, <Strobe dur={B.strobe.dur} />)}
        {seq(B.tee, <Tee dur={B.tee.dur} />)}
        {seq(B.angles, <Angles dur={B.angles.dur} />)}
        {seq(B.end, <End format="9x16" dur={B.end.dur} theme="light" />)}
      </>
    );
  }
  if (name === "search") {
    const B = FILMS.search;
    ground = PAPER;
    body = (
      <>
        {seq(B.typing, <Typing dur={B.typing.dur} />)}
        {seq(B.sort, <SheetScene mode="sort" dur={B.sort.dur} />)}
        {seq(B.filter, <SheetScene mode="filter" dur={B.filter.dur} />)}
        {card(B.find, ["Find it.", "Fast."], "light")}
        {seq(B.end, <End format="9x16" dur={B.end.dur} theme="light" />)}
      </>
    );
  }
  return (
    <SoundOn.Provider value>
      <AbsoluteFill style={{ background: ground }}>
        <Sfx at={0} name={PAD[name]} volume={0.14} />
        {body}
      </AbsoluteFill>
    </SoundOn.Provider>
  );
}
