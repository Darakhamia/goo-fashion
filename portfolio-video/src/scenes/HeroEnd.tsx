// Scene 1 (home hero) and scene 7 (end card) share one block, so the last
// frame of the end card and the first frame of the hero are the same picture.
import React from "react";
import { AbsoluteFill } from "remotion";
import { HeroGroup, HERO_BLOCK, HERO_BLOCK_H } from "../ui/app/HeroGroup";
import { EtherealShadow } from "../ui/app/EtherealShadow";
import type { Layout } from "../layout";

export type HeroState = {
  heroLineIn: number;
  ctaIn: number;
  endLineIn: number;
  endUrlIn: number;
  gooIn: number;
  press: number;
  /** Background blobs and grain. */
  shadow: number;
  /** Push-in. */
  zoom: number;
  /** Lift when the hero leaves. */
  lift: number;
  opacity: number;
  seconds: number;
};

/** Where the CTA's centre lands in the frame, for the cursor. */
export function ctaCenter(L: Layout, zoom: number) {
  const s = L.heroScale * zoom;
  const top = L.H / 2 - (HERO_BLOCK_H * s) / 2;
  const y = top + (HERO_BLOCK_H - HERO_BLOCK.cta / 2) * s;
  return { x: L.W / 2, y };
}

export function HeroEnd({ L, st }: { L: Layout; st: HeroState }) {
  return (
    <AbsoluteFill style={{ background: "var(--background)", opacity: st.opacity }}>
      {st.shadow > 0 && <EtherealShadow seconds={st.seconds} opacity={st.shadow} />}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `translateY(${st.lift}px) scale(${L.heroScale * st.zoom})`,
            opacity: st.gooIn,
          }}
        >
          <HeroGroup
            heroLineIn={st.heroLineIn}
            ctaIn={st.ctaIn}
            endLineIn={st.endLineIn}
            endUrlIn={st.endUrlIn}
            press={st.press}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** The end card at rest: frame 0 and frame 719 both draw this. */
export const END_AT_REST: Omit<HeroState, "seconds"> = {
  heroLineIn: 0,
  ctaIn: 0,
  endLineIn: 1,
  endUrlIn: 1,
  gooIn: 1,
  press: 0,
  shadow: 0,
  zoom: 1,
  lift: 0,
  opacity: 1,
};
