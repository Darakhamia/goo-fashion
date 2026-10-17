// The homepage's gooey word, giant: the site's own animation (GOO → Outfits →
// Looks → …), recorded frame by frame from the dark hero at 30 fps
// (public/captures/morph-en.mp4, morph-uk.mp4; capture/shoot-features.cjs).
// The film plays it, then glitches across into the same animation in
// Ukrainian (Луки → Стиль → Мода) while the label decodes from English to
// Ukrainian.
import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, mix, ramp } from "../../motion";
import { INK, LIGHT, M, SIZE, Shot } from "../kit";
import { Glitch, RGBSplit, Flash, hit, punch, scramble, shake } from "../fx";
import { Sfx } from "../Sfx";

const MO = M.features.morph;
const CLIP = MO.clip; // 560 × 200 CSS px around the word

/** Film frame → recording frame: the film starts 50 frames into the recording, GOO holding. */
export const MORPH_OFFSET = 50;
/** The glitch across to Ukrainian, film frames. */
export const SWITCH = { from: 88, at: 92, to: 100 } as const;

const holdsAt = (lang: "en" | "uk") => MO[lang].holds.map((h) => h.frame - MORPH_OFFSET);

export function Morph({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const { W, H } = SIZE["9x16"];
  const s = W / (CLIP.w - 40); // the word fills the width
  const lang = f < SWITCH.at ? "en" : "uk";
  const zoom = mix(1, 1.14, ramp(f, 0, dur, easeInOut)) * punch(f, SWITCH.to, 0.07, 10);
  const landed = [...holdsAt("en").filter((h) => h > 0 && h < SWITCH.at), ...holdsAt("uk").filter((h) => h > SWITCH.at && h < dur)];
  const bump = Math.max(0, ...landed.map((h) => hit(f, h, 8))) * 0.035;
  const g = Math.max(hit(f, SWITCH.from, SWITCH.to - SWITCH.from + 2), 0);
  const sh = shake(f, SWITCH.at, 18, 10);
  const fadeIn = ramp(f, 0, 8, easeOut);

  // Where the clip sits; the hero's own background is laid under it at the
  // same scale and place, so the clip's edges meet the same dots and glow.
  const clipLeft = W / 2 - (CLIP.w * s) / 2;
  const clipTop = H / 2 - (CLIP.h * s) / 2 - 40;
  const HERO = M.hero.dark;

  // The word's clip, feathered into that background on every side.
  const word = (l: "en" | "uk") => (
    <div
      style={{
        position: "absolute",
        left: clipLeft,
        top: clipTop,
        width: CLIP.w * s,
        height: (CLIP.h - 26) * s, // stop above the hero's "Build your look" line
        overflow: "hidden",
        // Feathered on all four sides into the ground, which is the hero's own dark.
        WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 10%, #000 90%, transparent 100%), linear-gradient(transparent 0, #000 11%, #000 89%, transparent 100%)",
        WebkitMaskComposite: "source-in",
        maskComposite: "intersect",
      }}
    >
      <Sequence from={-MORPH_OFFSET} layout="none">
        <OffthreadVideo src={staticFile(MO[l].video)} muted style={{ position: "absolute", left: 0, top: 0, width: CLIP.w * s, height: CLIP.h * s }} />
      </Sequence>
    </div>
  );

  const label = f < SWITCH.at - 3 ? "ENGLISH" : scramble("УКРАЇНСЬКА", f, SWITCH.at - 3, 16, 7);

  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      {/* Sound: a soft rush as each word melts, a glitch across languages. */}
      {holdsAt("en").filter((h) => h - 30 >= 0 && h < SWITCH.from).map((h) => <Sfx key={`e${h}`} at={h - 30} name="whoosh-soft" volume={0.22} />)}
      {holdsAt("en").filter((h) => h > 0 && h < SWITCH.from).map((h) => <Sfx key={`l${h}`} at={h} name="kick" volume={0.32} />)}
      <Sfx at={SWITCH.from} name="glitch" volume={0.3} />
      {holdsAt("uk").filter((h) => h - 30 >= SWITCH.to - 4 && h - 30 < dur).map((h) => <Sfx key={`u${h}`} at={h - 30} name="whoosh-soft" volume={0.22} />)}
      {holdsAt("uk").filter((h) => h > SWITCH.to && h < dur).map((h) => <Sfx key={`m${h}`} at={h} name="kick" volume={0.32} />)}
      <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px) scale(${zoom + bump})` }}>
        <Shot src={HERO.background} size={HERO.size} scale={s} style={{ left: clipLeft - CLIP.x * s, top: clipTop - CLIP.y * s }} />
        {/* Down to the type cards' black above and below: the hero's nav and
            its scroll hint stay out of the frame. */}
        <AbsoluteFill style={{ background: `linear-gradient(${INK} 0%, ${INK} 9%, transparent 30%, transparent 70%, ${INK} 84%, ${INK} 100%)` }} />
        <RGBSplit px={g * 26}>
          <Glitch strength={g} seed={f} W={W} H={H} render={() => word(lang)} />
        </RGBSplit>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          width: W,
          top: H / 2 + 230,
          textAlign: "center",
          fontFamily: "'Inter Tight', sans-serif",
          fontWeight: 600,
          fontSize: 40,
          letterSpacing: "0.32em",
          color: LIGHT,
          opacity: 0.55 * ramp(f, 10, 24, easeOut),
        }}
      >
        {label}
      </div>
      <Flash at={SWITCH.at} dur={3} max={0.5} />
      {/* From the type cards' black, the loop's seam. */}
      <AbsoluteFill style={{ background: INK, opacity: 1 - fadeIn }} />
    </AbsoluteFill>
  );
}
