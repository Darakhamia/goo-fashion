// The builder on a phone, from src/app/builder/page.tsx (:1992-2338): the
// header ("New look", AI, Save), the board, the chips row and the catalogue
// strip; with the tab bar from src/components/layout/MobileBottomNav.tsx.
// Phone (max-md) classes only: the frame is wider than md, so the md: variants
// are left out rather than switched off.
import React from "react";
import { Img } from "remotion";
import type { Product } from "@/lib/types";
import { formatPrice } from "../../shims/currency-context";
import { BuilderBoard, type BoardPiece } from "./BuilderBoard";

const TABS = [
  { label: "Browse", d: "M17.5 11a6.5 6.5 0 1 1-13 0a6.5 6.5 0 1 1 13 0 M16 16l4 4" },
  { label: "Builder", d: "M7 4L3 8v2.5L5.5 9V20h13V9l2.5 1.5V8l-4-4S15.5 6 12 6 7 4 7 4Z" },
  {
    label: "Journal",
    d: "M5 5.5A2.5 2.5 0 0 1 7.5 3H19v14H7.5A2.5 2.5 0 0 0 5 19.5v-14Z M5 19.5A2.5 2.5 0 0 1 7.5 17H19v4H7.5A2.5 2.5 0 0 1 5 19.5Z M9 7.5h6M9 10.5h4",
  },
  { label: "My likes", d: "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" },
  { label: "Profile", d: "M16 8a4 4 0 1 1-8 0a4 4 0 1 1 8 0 M4.5 20.5c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5" },
];

export function MobileBottomNav({ active }: { active: string }) {
  return (
    <div className="absolute inset-x-3 bottom-[6px] z-40">
      <nav className="h-[50px] px-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-overlay-92)] flex items-center justify-between">
        {TABS.map(({ label, d }) => {
          const on = label === active;
          return (
            <span
              key={label}
              className={`relative h-11 rounded-full flex items-center justify-center ${
                on ? "pl-3 pr-3.5 gap-[7px] text-[var(--foreground)]" : "w-11 text-[var(--foreground-muted)]"
              }`}
            >
              {on && <span className="absolute inset-0 rounded-full bg-[var(--fg-overlay-08)]" />}
              <span className="relative">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 1.7 : 1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={d} />
                </svg>
              </span>
              {on && <span className="relative text-[12px] font-semibold leading-none">{label}</span>}
            </span>
          );
        })}
      </nav>
    </div>
  );
}

export const MOBILE_CHIPS = ["All", "Tops", "Bottoms", "Shoes", "Accessories"];

export function MobileHeader({ hasPieces }: { hasPieces: boolean }) {
  return (
    <div className="shrink-0 flex items-center gap-2 px-3 pt-2">
      <span className="w-11 h-11 shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--foreground)]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </span>
      <h1 className="flex-1 min-w-0 ml-1 truncate text-[17px] font-semibold text-[var(--foreground)]">New look</h1>
      <span className="shrink-0 h-11 px-4 rounded-full border text-[14px] font-semibold bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] flex items-center">AI</span>
      <span
        className={`shrink-0 h-11 px-[18px] rounded-full text-[14px] font-semibold flex items-center ${
          hasPieces ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--fg-overlay-08)] text-[var(--foreground-muted)]"
        }`}
      >
        Save
      </span>
    </div>
  );
}

export function MobileChips() {
  return (
    <div className="shrink-0 flex items-center gap-1.5 px-3 pt-3 pb-0.5 overflow-hidden">
      <span className="relative shrink-0 w-10 h-10 rounded-full border flex items-center justify-center bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)]">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M7 12h10M10 17h4" />
        </svg>
      </span>
      {MOBILE_CHIPS.map((label) => (
        <span
          key={label}
          className={`relative shrink-0 h-10 px-[15px] rounded-full text-[13px] whitespace-nowrap flex items-center ${
            label === "All" ? "bg-[var(--foreground)] text-[var(--background)] font-semibold" : "bg-[var(--fg-overlay-08)] text-[var(--foreground)]"
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export function MobileStrip({ strip, picked, stripScroll = 0 }: { strip: Product[]; picked: Set<string>; stripScroll?: number }) {
  return (
    <div className="shrink-0 overflow-hidden" style={{ minHeight: 204 }}>
      <div className="flex gap-2 px-3 pt-3 pb-1 items-start" style={{ transform: `translateX(${-stripScroll}px)` }}>
        {strip.map((product) => {
          const isSelected = picked.has(product.id);
          return (
            <div key={product.id} className="shrink-0 w-[124px] flex flex-col rounded-[14px] overflow-hidden bg-[var(--surface)]">
              <div className="relative overflow-hidden bg-white h-[140px]">
                <Img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-contain" />
                <span
                  aria-hidden="true"
                  className={`absolute right-2 bottom-2 w-[26px] h-[26px] rounded-full flex items-center justify-center ${
                    isSelected ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-white/90 text-black"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={isSelected ? "M5 12l5 5 9-10" : "M12 6v12M6 12h12"} />
                  </svg>
                </span>
              </div>
              <div className="px-2.5 pt-2 pb-2.5">
                <p className="text-[12px] font-semibold text-[var(--foreground)] truncate leading-snug">{product.brand}</p>
                <p className="text-[12px] text-[var(--foreground-muted)] leading-snug">{formatPrice(product.priceMin)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MobileBuilder({
  width,
  height,
  pieces,
  relayout,
  total,
  strip,
  picked,
  stripScroll = 0,
}: {
  width: number;
  height: number;
  pieces: BoardPiece[];
  relayout: number;
  total: number;
  strip: Product[];
  /** Strip cards already in the look. */
  picked: Set<string>;
  stripScroll?: number;
}) {
  const navSpace = 72; // the floating tab bar's strip
  const bottomPanel = 12 + 40 + 2 + 204 + 12;
  const header = 8 + 44;
  const boardH = height - header - 12 - bottomPanel - navSpace;
  return (
    <div className="relative bg-[var(--background)] text-[var(--foreground)] overflow-hidden" style={{ width, height }}>
      <div className="flex flex-col" style={{ height: height - navSpace }}>
        <MobileHeader hasPieces={pieces.length > 0} />
        <div className="mx-3 mt-3">
          <BuilderBoard width={width - 24} height={boardH} pieces={pieces} relayout={relayout} total={total} />
        </div>
        <div className="shrink-0 flex flex-col pb-3 mt-auto">
          <MobileChips />
          <MobileStrip strip={strip} picked={picked} stripScroll={stripScroll} />
        </div>
      </div>
      <MobileBottomNav active="Builder" />
    </div>
  );
}
