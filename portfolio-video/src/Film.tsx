// The whole loop for one format.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { LAYOUTS, type Format } from "./layout";
import { CAPTIONS, SCENES } from "./timeline";
import { Caption } from "./ui/Caption";
import { MatchCut } from "./ui/MatchCut";
import { HeroScene } from "./scenes/Hero";
import { BrowseScene } from "./scenes/Browse";
import { BuilderScene } from "./scenes/Builder";
import { StylistScene } from "./scenes/Stylist";
import { ProductScene } from "./scenes/Product";
import { PhoneScene } from "./scenes/Phone";
import { EndScene } from "./scenes/EndCard";
import { FEATURED } from "./fixtures/story";

const seq = (k: keyof typeof SCENES) => ({ from: SCENES[k].from, durationInFrames: SCENES[k].to - SCENES[k].from });

export function Film({ format }: { format: Format }) {
  const L = LAYOUTS[format];
  return (
    <AbsoluteFill className="dark" style={{ background: "var(--background)", fontFamily: "var(--font-body)" }}>
      <Sequence {...seq("hero")} name="1 Hero"><HeroScene L={L} /></Sequence>
      <Sequence {...seq("browse")} name="2 Browse"><BrowseScene L={L} /></Sequence>
      <Sequence {...seq("builder")} name="3 Builder"><BuilderScene L={L} /></Sequence>
      <Sequence {...seq("stylist")} name="4 Stylist"><StylistScene L={L} /></Sequence>
      <Sequence {...seq("product")} name="5 Product"><ProductScene L={L} /></Sequence>
      <Sequence {...seq("phone")} name="6 Phone"><PhoneScene L={L} /></Sequence>
      <Sequence {...seq("end")} name="7 End"><EndScene L={L} /></Sequence>
      <MatchCut src={FEATURED.imageUrl} start={454} end={472} />
      {CAPTIONS.map((c) => (
        <Caption key={c.text} text={c.text} from={c.from} to={c.to} x={L.caption.x} y={L.caption.y} size={L.caption.size} />
      ))}
    </AbsoluteFill>
  );
}
