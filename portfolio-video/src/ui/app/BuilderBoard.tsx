// The builder's board: the collage canvas from the phone layout of
// src/app/builder/page.tsx (:2034-2170). The app lays the pieces out with flex
// rows whose heights depend on how many pieces there are (1, 2, 3, 4, 5, 6);
// here the same rows are computed as boxes so a piece can glide to its new box
// when the next one lands. Remove buttons, the total pill and the clear button
// are the app's own markup.
import React from "react";
import { Img } from "remotion";
import type { Product } from "@/lib/types";
import { formatPrice } from "../../shims/currency-context";

type Box = { x: number; y: number; w: number; h: number };

/** The app's collage rows, in fractions of the canvas (gap-px seams). */
export function boardBoxes(n: number, W: number, H: number): Box[] {
  const g = 1;
  const row = (y: number, h: number, count: number): Box[] => {
    const w = (W - g * (count - 1)) / count;
    return Array.from({ length: count }, (_, i) => ({ x: i * (w + g), y, w, h }));
  };
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, y: 0, w: W, h: H }];
  if (n === 2) return row(0, H, 2);
  if (n === 3) {
    const h1 = (H - g) * 0.6;
    return [...row(0, h1, 2), { x: 0, y: h1 + g, w: W, h: H - h1 - g }];
  }
  if (n === 4) {
    const h1 = (H - g) / 2;
    return [...row(0, h1, 2), ...row(h1 + g, h1, 2)];
  }
  if (n === 5) {
    const h1 = (H - g) * 0.57;
    return [...row(0, h1, 2), ...row(h1 + g, H - h1 - g, 3)];
  }
  const h1 = (H - 2 * g) * 0.4;
  const h2 = (H - 2 * g) * 0.33;
  return [...row(0, h1, 2), ...row(h1 + g, h2, 3), { x: 0, y: h1 + h2 + 2 * g, w: W, h: H - h1 - h2 - 2 * g }];
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type BoardPiece = {
  product: Product;
  /** 0→1 spring for its landing. */
  land: number;
};

export function BuilderBoard({
  width,
  height,
  pieces,
  /** 0→1 spring of the re-layout after the latest landing. */
  relayout,
  total,
  emptyCopy = true,
}: {
  width: number;
  height: number;
  pieces: BoardPiece[];
  relayout: number;
  total: number;
  emptyCopy?: boolean;
}) {
  const n = pieces.length;
  const now = boardBoxes(n, width, height);
  const before = boardBoxes(Math.max(n - 1, 0), width, height);
  return (
    <div className="relative rounded-3xl overflow-hidden" style={{ width, height }}>
      {n === 0 ? (
        <div className="absolute inset-0 rounded-3xl bg-[var(--surface)] shadow-[inset_0_0_0_1px_var(--border)] flex flex-col items-center justify-center text-center px-10">
          <span className="w-14 h-14 rounded-full bg-[var(--fg-overlay-08)] flex items-center justify-center text-[var(--foreground-muted)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 4L3 8v2.5L5.5 9V20h13V9l2.5 1.5V8l-4-4S15.5 6 12 6 7 4 7 4Z" />
            </svg>
          </span>
          {emptyCopy && (
            <>
              <p className="mt-3.5 text-[16px] font-semibold text-[var(--foreground)]">Add pieces to build your look</p>
              <p className="mt-1 text-[14px] leading-snug text-[var(--foreground-muted)]">Tap any piece below, or ask the AI stylist to start one for you.</p>
            </>
          )}
        </div>
      ) : (
        <div className="absolute inset-0 bg-white">
          {pieces.map((p, i) => {
            const to = now[i];
            const from = i < n - 1 ? before[i] : to;
            const b = {
              x: lerp(from.x, to.x, relayout),
              y: lerp(from.y, to.y, relayout),
              w: lerp(from.w, to.w, relayout),
              h: lerp(from.h, to.h, relayout),
            };
            const pad = n === 1 ? 12 : 8;
            return (
              <div
                key={p.product.id}
                className="absolute overflow-hidden bg-white"
                style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
              >
                <Img
                  src={p.product.imageUrl}
                  alt={p.product.name}
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{
                    padding: pad,
                    opacity: p.land,
                    transform: `translateY(${(1 - p.land) * -26}px) scale(${1 + (1 - p.land) * 0.06})`,
                  }}
                />
                <span
                  className="absolute top-0 right-0 w-11 h-11 flex items-center justify-center z-10"
                  style={{ opacity: p.land }}
                >
                  <span className="w-7 h-7 rounded-full bg-white/85 flex items-center justify-center text-black">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {n > 0 && (
        <>
          <span className="absolute left-3 bottom-3 z-10 h-8 px-3 rounded-full bg-white/85 text-black flex items-center gap-1 text-[13px]">
            <b className="font-semibold">{formatPrice(total)}</b> · {n} {n === 1 ? "piece" : "pieces"}
          </span>
          <span className="absolute right-1 bottom-1 z-10 w-12 h-12 flex items-center justify-center">
            <span className="w-8 h-8 rounded-full bg-white/85 flex items-center justify-center text-black">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
              </svg>
            </span>
          </span>
        </>
      )}
    </div>
  );
}
