// Scene 1: the end card opens into the home hero; the CTA gets a soft press.
import React from "react";
import { Easing, useCurrentFrame } from "remotion";
import type { Layout } from "../layout";
import { easeInOut, mix, ramp } from "../motion";
import { Cursor } from "../ui/Cursor";
import { ctaCenter, END_AT_REST, HeroEnd } from "./HeroEnd";

const PRESS = 62;

export function HeroScene({ L }: { L: Layout }) {
  const f = useCurrentFrame();
  const zoom = mix(1, 1.03, ramp(f, 0, 96, Easing.linear));
  const d = f - PRESS;
  const press = d >= 0 && d <= 5 ? (d <= 2 ? d / 2 : 1 - (d - 2) / 3) : 0;
  const leave = ramp(f, 76, 96, easeInOut);
  const st = {
    ...END_AT_REST,
    endLineIn: 1 - ramp(f, 4, 14),
    endUrlIn: 1 - ramp(f, 6, 16),
    heroLineIn: ramp(f, 10, 31),
    ctaIn: ramp(f, 14, 35),
    shadow: ramp(f, 4, 40) * (1 - leave),
    zoom,
    press,
    lift: -24 * leave,
    opacity: 1 - ramp(f, 80, 96, easeInOut),
    seconds: f / 30,
  };
  const cta = ctaCenter(L, zoom);
  const s = L.cursorSize;
  return (
    <>
      <HeroEnd L={L} st={st} />
      <Cursor
        size={s}
        appear={34}
        vanish={84}
        presses={[PRESS]}
        path={[
          { f: 34, x: L.W * 0.66, y: L.H * 0.9 },
          { f: 56, x: cta.x + 20, y: cta.y + 4 },
          { f: 84, x: cta.x + 26, y: cta.y + 10 },
        ]}
      />
    </>
  );
}
