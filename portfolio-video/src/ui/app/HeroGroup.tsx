// The home hero's centre block, from src/components/home/HeroSection.tsx: the
// big "GOO" (GooeyText's settled word: Inter Tight bold, tracking −0.04em,
// 128px at lg), "Build your look" and the CTA. The end card is the same block
// with the line and the CTA swapped for the tagline and the address, so the
// loop seam is one layout in two states.
import React from "react";

/** CSS px of the block, for placing the cursor on the CTA. */
export const HERO_BLOCK = { goo: 148, gapInner: 12, line: 25.6, gapOuter: 32, cta: 52 };
export const HERO_BLOCK_H = HERO_BLOCK.goo + HERO_BLOCK.gapInner + HERO_BLOCK.line + HERO_BLOCK.gapOuter + HERO_BLOCK.cta;

export function HeroGroup({
  heroLineIn,
  ctaIn,
  endLineIn,
  endUrlIn,
  press = 0,
}: {
  heroLineIn: number;
  ctaIn: number;
  endLineIn: number;
  endUrlIn: number;
  press?: number;
}) {
  const slot: React.CSSProperties = { position: "relative", display: "grid", placeItems: "center" };
  const layer = (o: number, y: number): React.CSSProperties => ({
    gridArea: "1 / 1",
    opacity: o,
    transform: `translateY(${y}px)`,
  });
  return (
    <div className="flex flex-col items-center px-6 text-center" style={{ gap: HERO_BLOCK.gapOuter }}>
      <div className="flex flex-col items-center w-full" style={{ gap: HERO_BLOCK.gapInner }}>
        <div className="h-[148px] w-[640px] text-[128px]">
          <svg width="100%" height="100%" aria-hidden="true">
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="central"
              className="select-none font-bold tracking-[-0.04em] fill-[var(--foreground)]"
            >
              GOO
            </text>
          </svg>
        </div>
        <div style={{ ...slot, height: HERO_BLOCK.line }}>
          <p
            className="text-base tracking-[-0.01em] text-[var(--foreground-muted)] whitespace-nowrap"
            style={layer(heroLineIn, (1 - heroLineIn) * 8)}
          >
            Build your look
          </p>
          <p
            className="text-base tracking-[-0.01em] text-[var(--foreground-muted)] whitespace-nowrap"
            style={layer(endLineIn, (1 - endLineIn) * 8)}
          >
            Your look, found and priced.
          </p>
        </div>
      </div>
      <div style={{ ...slot, height: HERO_BLOCK.cta }}>
        <div style={layer(ctaIn, (1 - ctaIn) * 12)}>
          <span
            className="group relative inline-flex items-center gap-2.5 bg-[var(--foreground)] text-[var(--background)] rounded-full px-8 py-3.5 text-[15px] font-semibold tracking-[-0.01em]"
            style={{ transform: `scale(${1 - press * 0.03})` }}
          >
            Build your look
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--background)]/15">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 8L8 2M8 2H3M8 2V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </span>
        </div>
        <p
          className="text-[15px] tracking-[0.02em] text-[var(--foreground)] whitespace-nowrap"
          style={layer(endUrlIn, (1 - endUrlIn) * 8)}
        >
          goo-fashion.com
        </p>
      </div>
    </div>
  );
}
