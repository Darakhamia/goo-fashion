// Shim for framer-motion. framer-motion animates on wall-clock time, which a
// frame-by-frame render would catch at random points. Here a motion.* element
// renders as its plain tag in the settled state; the video animates the
// surroundings itself, from the frame number.
import React from "react";

const MOTION_ONLY = new Set([
  "initial", "animate", "exit", "transition", "variants", "whileInView", "whileHover",
  "whileTap", "whileFocus", "whileDrag", "viewport", "layout", "layoutId", "drag",
  "dragConstraints", "onAnimationStart", "onAnimationComplete", "custom",
]);

const cache = new Map<string, React.ComponentType<Record<string, unknown>>>();

function plain(tag: string) {
  let C = cache.get(tag);
  if (!C) {
    const Comp = React.forwardRef<unknown, Record<string, unknown>>(function MotionShim(props, ref) {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(props)) if (!MOTION_ONLY.has(k)) clean[k] = v;
      return React.createElement(tag, { ...clean, ref });
    });
    C = Comp as unknown as React.ComponentType<Record<string, unknown>>;
    cache.set(tag, C);
  }
  return C;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const motion: any = new Proxy({}, { get: (_t, tag: string) => plain(tag) });

export function AnimatePresence({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
