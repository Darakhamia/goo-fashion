// Motion vocabulary. The curves are the app's own tokens (src/app/globals.css):
// --ease-out for entrances and exits, --ease-in-out for moving what's already
// on screen, --ease-drawer for panels. Everything is a function of the frame.
import { Easing, interpolate, spring } from "remotion";

export const FPS = 30;
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);
export const easeInOut = Easing.bezier(0.77, 0, 0.175, 1);
export const easeDrawer = Easing.bezier(0.32, 0.72, 0, 1);

/** 0→1 between two frames along a curve, clamped. */
export function ramp(frame: number, from: number, to: number, easing = easeOut): number {
  return interpolate(frame, [from, to], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Map 0–1 progress onto a range. */
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** A soft settle with little overshoot: pieces landing. */
export function settle(frame: number, start: number, opts: { damping?: number; mass?: number; stiffness?: number } = {}): number {
  return spring({
    frame: frame - start,
    fps: FPS,
    config: { damping: opts.damping ?? 18, mass: opts.mass ?? 0.8, stiffness: opts.stiffness ?? 140 },
  });
}

/** The site's segmented-toggle spring (BrowseClient: stiffness 500, damping 42, mass 0.8). */
export function toggleSpring(frame: number, start: number): number {
  return spring({ frame: frame - start, fps: FPS, config: { stiffness: 500, damping: 42, mass: 0.8 } });
}

/** Fade in over `inDur` from `start`, fade out over `outDur` ending at `end`. */
export function window(frame: number, start: number, end: number, inDur = 12, outDur = 10): number {
  return Math.min(ramp(frame, start, start + inDur), 1 - ramp(frame, end - outDur, end, easeInOut));
}
