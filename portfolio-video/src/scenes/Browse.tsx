// Scene 2: the browse page plays in the panel. The cards land the way
// ProductCard's whileInView does (opacity, 16 px rise, 8 px blur, spring), the
// active filter chip switches from Outerwear to Footwear, the grid swaps as
// AnimatePresence swaps it (fade + 8 px), and the page scrolls.
import React from "react";
import { useCurrentFrame } from "remotion";
import type { Layout } from "../layout";
import { easeInOut, mix, ramp, settle } from "../motion";
import { Panel } from "../ui/Panel";
import { BrowsePage, type CardState } from "../ui/app/BrowsePage";
import { BROWSE_FOOTWEAR, BROWSE_OUTERWEAR } from "../fixtures/story";

const SWITCH = 44;

function cardIn(f: number, start: number): CardState {
  // ProductCard: spring, bounce 0.2, 0.8 s.
  const t = Math.min(settle(f, start, { damping: 16, stiffness: 120, mass: 0.9 }), 1.02);
  const v = Math.max(0, Math.min(1, t));
  return { opacity: v, y: 16 * (1 - t), blur: 8 * (1 - v) };
}

/** The browse page in its end state, reused dimmed behind the stylist. */
export function browseAt(L: Layout, f: number) {
  const before = f < SWITCH + 6;
  const products = before ? BROWSE_OUTERWEAR : BROWSE_FOOTWEAR;
  const base = before ? 8 : SWITCH + 6;
  const grid = products.map((product, i) => ({ product, state: cardIn(f, base + i * 2) }));
  const outT = ramp(f, SWITCH, SWITCH + 6, easeInOut);
  const gridShift = before ? { opacity: 1 - outT, y: -8 * outT } : { opacity: 1, y: 0 };
  const chipOut = ramp(f, SWITCH, SWITCH + 5);
  const chipIn = ramp(f, SWITCH + 4, SWITCH + 9);
  const chips = [
    { label: "Outerwear", opacity: 1 - chipOut, scale: mix(1, 0.85, chipOut) },
    { label: "Footwear", opacity: chipIn, scale: mix(0.85, 1, chipIn) },
  ].filter((c) => c.opacity > 0.001);
  const scrollY = L.browseScroll * ramp(f, 64, 118, easeInOut);
  return { grid, gridShift, chips, scrollY };
}

export function BrowseScene({ L }: { L: Layout }) {
  const f = useCurrentFrame();
  const enter = ramp(f, 0, 20);
  const leave = ramp(f, 116, 132, easeInOut);
  const b = browseAt(L, f);
  return (
    <Panel
      rect={L.panel}
      scale={L.panelScale}
      scrollY={b.scrollY}
      opacity={enter * (1 - leave)}
      translateY={mix(40, 0, enter) - 20 * leave}
      outerScale={mix(0.985, 1, enter) - 0.015 * leave}
      zoom={mix(1, 1.025, ramp(f, 0, 132, easeInOut))}
    >
      <BrowsePage width={L.panel.w / L.panelScale} chips={b.chips} grid={b.grid} gridShift={b.gridShift} />
    </Panel>
  );
}
