"use client";

import { useEffect, useState } from "react";

/** Time one photo rests before sliding to the next. Browse's own figure. */
export const CYCLE_INTERVAL_MS = 5000;
/** The slide itself, for the caller's CSS transition. */
export const CYCLE_SLIDE_MS = 500;
/** How long a pointer must rest on a card before the photos start moving. */
const START_DELAY_MS = 3000;

/**
 * Cycle a card's photos while the pointer is on it.
 *
 * Lifted out of the catalogue card so the builder's grid behaves the same way
 * rather than approximating it: hovering pauses for a moment, then walks the
 * photos back and forth, and leaving puts the first one back.
 *
 * `resetKey` restarts the walk — pass whatever identifies the set of photos
 * (the chosen colour variant, say), so switching colours starts from that
 * colour's first photo rather than the third photo of the previous one.
 */
export function useHoverImageCycle(count: number, isHovered: boolean, resetKey?: unknown): number {
  // Position and direction together, so a step is one update and they can never
  // disagree. No ref: the only thing that moves them is the timer callback,
  // which is allowed to set state.
  const [walk, setWalk] = useState({ idx: 0, dir: 1 });

  // Going back to the first photo is a *reaction to a prop changing*, not
  // synchronisation with anything outside React, so it is adjusted during the
  // render that noticed rather than in an effect afterwards. React documents
  // this shape, and it costs one less render than an effect would.
  const [seen, setSeen] = useState({ hovered: isHovered, key: resetKey });
  if (seen.hovered !== isHovered || !Object.is(seen.key, resetKey)) {
    setSeen({ hovered: isHovered, key: resetKey });
    setWalk({ idx: 0, dir: 1 });
  }

  useEffect(() => {
    if (!isHovered || count <= 1) return;

    const step = () =>
      setWalk((w) => {
        let dir = w.dir;
        let next = w.idx + dir;
        // Turn around at both ends rather than jumping back to the start, so
        // the photos read as one continuous sweep.
        if (next >= count) { dir = -1; next = w.idx + dir; }
        else if (next < 0) { dir = 1; next = w.idx + dir; }
        return { idx: next, dir };
      });

    let interval: ReturnType<typeof setInterval> | null = null;
    const startDelay = setTimeout(() => {
      step();
      interval = setInterval(step, CYCLE_INTERVAL_MS);
    }, START_DELAY_MS);

    // Covers unmounting mid-walk too — a card scrolled out or filtered away
    // must not leave its interval running.
    return () => {
      clearTimeout(startDelay);
      if (interval) clearInterval(interval);
    };
  }, [isHovered, count, resetKey]);

  // The photo list can shrink under a walk in progress; never point past its end.
  return Math.min(walk.idx, Math.max(count - 1, 0));
}

/** The progress pips under a cycling card. */
export function ImageCycleDots({ count, activeIdx }: { count: number; activeIdx: number }) {
  if (count <= 1) return null;
  return (
    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`h-[3px] rounded-full transition-colors duration-300 ${
            i === activeIdx ? "bg-white w-3" : "bg-white/40 w-[3px]"
          }`}
        />
      ))}
    </div>
  );
}
