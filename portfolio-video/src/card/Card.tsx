// Portrait card for the portfolio carousel (3:4). The builder with its board
// filled, recomposed from the builder's own phone layout: "New look" header,
// the board with its total pill, the chips row and the catalogue strip, on
// the site's background. No caption, no logo.
//
// The carousel clips unfocused cards to their top half with object-position
// 50% 26%, which shows roughly y 208–1008 of 1600. The board, its five pieces
// and the "$1,740 · 5 pieces" pill sit inside that band; the header is above
// it and the strip below, so both halves of the card read.
//
// As a loop (7 s): hold the full look → "Clear look" → the five pieces land
// again, each strip badge turning to ✓ → hold. Frame 0 and the last frame are
// the same settled state, and frame 0 is the still.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, ramp, settle } from "../motion";
import { BuilderBoard } from "../ui/app/BuilderBoard";
import { MobileChips, MobileHeader, MobileStrip } from "../ui/app/MobileBuilder";
import { LOOK, MOBILE_STRIP } from "../fixtures/story";

export const CARD = { W: 1200, H: 1600, fps: 30, frames: 210 };

const S = 2.35; // video px per CSS px
const CSS_W = CARD.W / S; // ≈ 511
const PAD_TOP = 24;
// Board: y ≈ 207–987 px, so the clipped band (≈ 208–1008) ends in the gap
// above the chips; the strip's cards end ~9 px above the bottom edge.
const BOARD_H = 332;

// Loop timing.
const CLEAR = 40; // "Clear look": the look lifts off
const LANDS = [72, 88, 104, 120, 136];

export function cardState(f: number) {
  const cleared = ramp(f, CLEAR, CLEAR + 12, easeInOut); // 0 → 1 as the old look leaves
  const landed = LOOK.filter((_, k) => f >= LANDS[k]);
  const building = f >= LANDS[0];
  // Before the clear the full look holds; after the first landing the new look builds.
  const pieces = building
    ? landed.map((p, k) => ({ product: p.product, land: Math.min(1, settle(f, LANDS[k], { damping: 15, stiffness: 130 })) }))
    : LOOK.map((p) => ({ product: p.product, land: 1 - cleared })); // the canvas stays white while they leave
  const last = landed.length - 1;
  const relayout = building ? Math.min(1, settle(f, LANDS[last], { damping: 20, stiffness: 120 })) : 1;
  let total = 0;
  if (building) {
    landed.forEach((p, k) => {
      total += p.product.priceMin * ramp(f, LANDS[k], LANDS[k] + 14, easeOut);
    });
  } else {
    total = LOOK.reduce((a, p) => a + p.product.priceMin, 0);
  }
  const picked = new Set((building ? landed : cleared < 0.5 ? LOOK : []).map((p) => p.product.id));
  // The empty board shows between the clear and the first landing.
  const empty = building ? 1 - ramp(f, LANDS[0], LANDS[0] + 10) : ramp(f, CLEAR + 12, CLEAR + 22);
  const pill = building ? 1 : 1 - cleared;
  return { pieces, relayout, total, picked, empty, pill, hasPieces: building || cleared < 0.5 };
}

export function Card({ at }: { at?: number }) {
  const current = useCurrentFrame();
  const f = at ?? current;
  const st = cardState(f);
  const boardW = CSS_W - 24;
  return (
    <AbsoluteFill className="dark" style={{ background: "var(--background)", fontFamily: "var(--font-body)" }}>
      <div style={{ width: CSS_W, transform: `scale(${S})`, transformOrigin: "0 0", paddingTop: PAD_TOP }} className="text-[var(--foreground)]">
        <MobileHeader hasPieces={st.hasPieces} />
        <div className="mx-3 mt-3 relative" style={{ height: BOARD_H }}>
          <div className="absolute inset-0">
            <BuilderBoard
              width={boardW}
              height={BOARD_H}
              pieces={st.pieces}
              relayout={st.relayout}
              total={st.total}
              pillOpacity={st.pill}
            />
          </div>
          {st.empty > 0 && (
            <div className="absolute inset-0" style={{ opacity: st.empty }}>
              <BuilderBoard width={boardW} height={BOARD_H} pieces={[]} relayout={1} total={0} />
            </div>
          )}
        </div>
        <MobileChips />
        <MobileStrip strip={MOBILE_STRIP} picked={st.picked} />
      </div>
    </AbsoluteFill>
  );
}
