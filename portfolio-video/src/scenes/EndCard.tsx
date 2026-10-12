// Scene 7: black, then the big "GOO", the line and the address. From frame 681
// it holds still, so the last frame equals the first.
import React from "react";
import { useCurrentFrame } from "remotion";
import type { Layout } from "../layout";
import { ramp } from "../motion";
import { END_AT_REST, HeroEnd } from "./HeroEnd";

export function EndScene({ L }: { L: Layout }) {
  const f = useCurrentFrame();
  return (
    <HeroEnd
      L={L}
      st={{
        ...END_AT_REST,
        opacity: ramp(f, 0, 10),
        gooIn: ramp(f, 8, 30),
        endLineIn: ramp(f, 18, 36),
        endUrlIn: ramp(f, 23, 41),
        seconds: 0,
      }}
    />
  );
}
