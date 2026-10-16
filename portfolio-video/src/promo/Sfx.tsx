// Sound for the vertical promo and the shorts. The effects are synthesised by
// scripts/make-sfx.py (no third-party samples) into public/audio/. Each scene
// places its own cues next to the motion they belong to, so sound and picture
// share one clock. Only a composition rendered with sound on plays them: the
// 16:9 and 1:1 loops stay silent.
import React, { createContext, useContext } from "react";
import { Audio, Sequence, staticFile } from "remotion";

export const SoundOn = createContext(false);

export type SfxName =
  | "whoosh" | "whoosh-soft" | "whoosh-down"
  | "tick" | "tick-0" | "tick-1" | "tick-2"
  | "key-0" | "key-1" | "key-2"
  | "snap" | "pop" | "pop-0" | "pop-1" | "pop-2" | "pop-3" | "pop-4"
  | "chime" | "swell" | "impact" | "pad"
  | "pad-night" | "pad-ask" | "pad-pocket";

/** One sound, starting at frame `at` of the enclosing sequence. */
export function Sfx({ at, name, volume = 0.5 }: { at: number; name: SfxName; volume?: number }) {
  const on = useContext(SoundOn);
  if (!on || at < 0) return null;
  return (
    <Sequence from={Math.round(at)} layout="none">
      <Audio src={staticFile(`audio/${name}.wav`)} volume={volume} />
    </Sequence>
  );
}
