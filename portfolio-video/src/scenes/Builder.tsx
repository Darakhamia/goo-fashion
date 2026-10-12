// Scene 3: the builder. The board (the builder's collage canvas) and the
// "In this look" column side by side: each piece lands on the board with a soft
// spring, its slot fills, "N pieces" ticks and the total counts up.
import React from "react";
import { useCurrentFrame } from "remotion";
import type { Layout } from "../layout";
import { easeInOut, easeOut, mix, ramp, settle } from "../motion";
import { BuilderBoard } from "../ui/app/BuilderBoard";
import { LookPanel, type FilledSlot } from "../ui/app/LookPanel";
import { LOOK, type SlotId } from "../fixtures/story";
import { BUILDER_PICKS } from "../timeline";

// Slot card heights in the column (p-3 + content): two-line names make 120.
const SLOT_H = [104, 104, 120, 120, 120, 104];

export function builderState(f: number) {
  const landed = LOOK.map((piece, k) => ({ ...piece, at: BUILDER_PICKS[k] })).filter((p) => f >= p.at);
  const pieces = landed.map((p) => ({ product: p.product, land: Math.min(1, settle(f, p.at, { damping: 15, stiffness: 120 })) }));
  const last = landed[landed.length - 1];
  const relayout = last ? Math.min(1, settle(f, last.at, { damping: 20, stiffness: 110 })) : 1;
  let total = 0;
  landed.forEach((p) => {
    total += p.product.priceMin * ramp(f, p.at, p.at + 14, easeOut);
  });
  const filled: Partial<Record<SlotId, FilledSlot>> = {};
  landed.forEach((p) => {
    filled[p.slot] = { product: p.product, enter: Math.min(1, settle(f, p.at + 2)) };
  });
  const count = landed.filter((p) => f >= p.at + 3).length;
  return { pieces, relayout, total, filled, count, landedCount: landed.length };
}

/** Keep the newest slot in view: the column scrolls as the list fills, and
 *  stops on a card's top edge so no card is left half under the header. */
function listScroll(f: number, visible: number) {
  const tops = SLOT_H.map((_, j) => 12 + SLOT_H.slice(0, j).reduce((a, h) => a + h + 12, 0));
  const targets = BUILDER_PICKS.map((_, k) => {
    const need = tops[k] + SLOT_H[k] + 12 - visible;
    if (need <= 0) return 0;
    const snap = tops.find((t) => t - 12 >= need);
    return snap !== undefined ? snap - 12 : need;
  });
  let scroll = 0;
  BUILDER_PICKS.forEach((at, k) => {
    scroll = mix(scroll, targets[k], ramp(f, at, at + 16, easeInOut));
  });
  return scroll;
}

export function BuilderScene({ L, poster = false, at }: { L: Layout; poster?: boolean; at?: number }) {
  const current = useCurrentFrame();
  const f = at ?? current;
  const B = L.builder;
  const enter = ramp(f, 0, 18);
  const leave = poster ? 0 : ramp(f, 132, 147, easeInOut);
  const s = builderState(f);
  const listH = B.list.h / B.listScale;
  const visible = listH - 110 - 112 - 62;
  const push = mix(1, 1.035, ramp(f, 12, 147, easeInOut));
  const cx = (B.board.x + B.list.x + B.list.w) / 2;
  const cy = B.board.y + B.board.h / 2;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: enter * (1 - leave),
        transform: `translateY(${mix(30, 0, enter)}px) scale(${push})`,
        transformOrigin: `${cx}px ${cy}px`,
      }}
    >
      <div style={{ position: "absolute", left: B.board.x, top: B.board.y, width: B.board.w, height: B.board.h }}>
        <div style={{ transform: `scale(${B.boardScale})`, transformOrigin: "0 0" }}>
          <BuilderBoard
            width={B.board.w / B.boardScale}
            height={B.board.h / B.boardScale}
            pieces={s.pieces}
            relayout={s.relayout}
            total={s.total}
          />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: B.list.x,
          top: B.list.y,
          width: B.list.w,
          height: B.list.h,
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 0 0 1px var(--border)",
        }}
      >
        <div style={{ transform: `scale(${B.listScale})`, transformOrigin: "0 0" }}>
          <LookPanel height={listH} filled={s.filled} count={s.count} total={s.total} listScroll={listScroll(f, visible)} />
        </div>
      </div>
    </div>
  );
}
