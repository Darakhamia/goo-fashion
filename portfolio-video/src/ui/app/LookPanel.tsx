// "In this look": the builder's right panel on desktop, from
// src/app/builder/page.tsx:1692-1985 (slot cards, Total footer, and the action
// bar that sits under the column). The slot list scrolls inside the column as
// it does in the app; the scene sets how far.
import React from "react";
import { Img } from "remotion";
import type { Product } from "@/lib/types";
import { photoBackdrop } from "@/lib/image";
import { formatPrice } from "../../shims/currency-context";
import { SLOTS, type SlotId } from "../../fixtures/story";
import { SlotIcon } from "./SlotIcon";

export type FilledSlot = { product: Product; enter: number };

export function LookPanel({
  height,
  filled,
  count,
  total,
  listScroll = 0,
}: {
  height: number;
  filled: Partial<Record<SlotId, FilledSlot>>;
  count: number;
  total: number;
  listScroll?: number;
}) {
  return (
    <div className="flex flex-col bg-[var(--background)] overflow-hidden" style={{ width: 300, height }}>
      <aside className="flex flex-col border-l border-[var(--border)] bg-[var(--background)] min-h-0 flex-1 overflow-hidden">
        <div className="px-6 h-[60px] shrink-0 flex items-center">
          <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">In this look</p>
        </div>
        <div className="px-6 h-[50px] shrink-0 border-b border-[var(--border)] flex items-center">
          <p className="text-2xl font-bold text-[var(--foreground)]">
            {count > 0 ? `${count} piece${count !== 1 ? "s" : ""}` : "0 pieces"}
          </p>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="px-4 py-3 flex flex-col gap-3" style={{ transform: `translateY(${-listScroll}px)` }}>
            {SLOTS.map((slot) => {
              const f = filled[slot.id];
              const empty = (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-3 flex items-center gap-3 text-left w-full">
                  <div className="w-16 h-20 rounded-lg bg-[var(--surface)] flex items-center justify-center shrink-0 text-[var(--foreground-subtle)] opacity-40">
                    <SlotIcon id={slot.id} size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] tracking-[0.14em] uppercase font-medium text-[var(--foreground-subtle)] mb-1">{slot.label}</p>
                    <p className="text-[11px] text-[var(--foreground-subtle)] italic">Click to add</p>
                  </div>
                </div>
              );
              if (!f || f.enter <= 0) return <div key={slot.id}>{empty}</div>;
              const p = f.product;
              return (
                <div key={slot.id} className="grid">
                  <div style={{ gridArea: "1 / 1", opacity: 1 - f.enter }}>{empty}</div>
                  <div
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-sm p-3 flex items-start gap-3 relative"
                    style={{
                      gridArea: "1 / 1",
                      opacity: f.enter,
                      transform: `translateY(${(1 - f.enter) * -10}px) scale(${0.97 + 0.03 * f.enter})`,
                    }}
                  >
                    <div
                      className="w-16 h-20 rounded-lg overflow-hidden bg-white border border-[var(--border)] shrink-0 flex items-center justify-center"
                      style={photoBackdrop(p.bgColor)}
                    >
                      <Img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" />
                    </div>
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--surface)] flex items-center justify-center text-[var(--foreground-muted)]">
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-[9px] tracking-[0.14em] uppercase font-medium text-[var(--foreground-subtle)] mb-1">{slot.label}</p>
                      <p className="text-[12px] font-semibold text-[var(--foreground)] leading-snug line-clamp-2">{p.name}</p>
                      <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">{p.brand}</p>
                      <p className="text-[13px] font-bold text-[var(--foreground)] mt-1">{formatPrice(p.priceMin)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="shrink-0 border-t border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">Total</p>
            <p className={`text-2xl font-bold ${count > 0 ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"}`}>
              {count > 0 ? formatPrice(total) : "—"}
            </p>
          </div>
          <div className="flex gap-2">
            {["Share look", "Clear look"].map((label, i) => (
              <span
                key={label}
                className={`flex-1 flex items-center justify-center gap-1.5 border border-[var(--border-strong)] rounded-lg py-2.5 text-[10px] tracking-[0.1em] uppercase font-bold text-[var(--foreground-muted)] ${i === 1 && count === 0 ? "opacity-30" : ""}`}
              >
                {i === 0 ? (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
                    <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.3" />
                    <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                    <line x1="10.3" y1="5" x2="5.7" y2="7" stroke="currentColor" strokeWidth="1.3" />
                    <line x1="5.7" y1="9" x2="10.3" y2="11" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M3 6H13L12 14H4L3 6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M1 3H15M6 3V2H10V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                )}
                {label}
              </span>
            ))}
          </div>
        </div>
      </aside>
      {/* Desktop bottom action bar, the part under the look column. */}
      <div className="shrink-0 border-t border-l border-[var(--border)] flex items-center gap-2 px-4 py-3">
        <span className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 border border-[var(--border-strong)] text-[var(--foreground-muted)] px-3 py-2.5 rounded-xl text-[11px] font-semibold whitespace-nowrap ${count === 0 ? "opacity-30" : ""}`}>
          <span>Shop{count > 0 ? ` ${formatPrice(total)}` : " the look"}</span>
          {count > 0 && <span>→</span>}
        </span>
        <span className={`flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] ${count === 0 ? "opacity-30" : ""}`}>
          Save
        </span>
      </div>
    </div>
  );
}
