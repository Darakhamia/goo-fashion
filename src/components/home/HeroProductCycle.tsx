"use client";

import { useState, useEffect } from "react";
import Image from "@/components/ui/Image";
import type { Product } from "@/lib/types";

interface Props {
  products: Product[];
  totalPrice: number;
}

export default function HeroProductCycle({ products, totalPrice }: Props) {
  const [active, setActive] = useState(0);
  const [opacity, setOpacity] = useState(1);

  const count = products.length;

  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => {
      setOpacity(0);
      const swap = setTimeout(() => {
        setActive((a: number) => (a + 1) % count);
        setOpacity(1);
      }, 350);
      return () => clearTimeout(swap);
    }, 3000);
    return () => clearInterval(id);
  }, [count]);

  const current = products[active] ?? null;

  if (!count) {
    return (
      <div className="w-full h-[560px] bg-[var(--surface)] rounded-3xl border border-[var(--border)]" />
    );
  }

  return (
    <div className="relative w-full h-[560px]">
      <div className="absolute inset-0 bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden flex flex-col p-4 gap-3">
        {/* Top badges */}
        <div className="flex justify-between items-center shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--background)] border border-[var(--border)] text-[11px] font-medium text-[var(--foreground)]">
            <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" className="text-[var(--foreground-subtle)]">
              <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5z" />
            </svg>
            AI Preview
          </span>
          <span className="px-3 py-1.5 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[11px] font-medium">
            Shop the look
          </span>
        </div>

        {/* Main content */}
        <div className="flex-1 flex gap-3 min-h-0">
          {/* Main cycling card */}
          <div
            className="flex-1 relative rounded-2xl overflow-hidden bg-[var(--background)]"
            style={{
              opacity,
              transition: "opacity 350ms ease",
            }}
          >
            {current?.imageUrl ? (
              <Image
                src={current.imageUrl}
                alt={current.name ?? ""}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 80vw, 35vw"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#D4CEC2_0px,#D4CEC2_7px,rgba(10,10,10,0.06)_7px,rgba(10,10,10,0.06)_8px)]" />
            )}
            {/* Product label */}
            {current && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-12 pb-4 px-4">
                <p className="text-white text-[13px] font-semibold truncate">
                  {current.name}
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-white/70 text-[11px]">{current.brand}</p>
                  {current.priceMin > 0 && (
                    <p className="text-white text-[12px] font-bold">
                      ${current.priceMin.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Vertical scrolling side strip */}
          <div className="w-[100px] overflow-hidden rounded-2xl relative shrink-0">
            <div
              className="flex flex-col gap-3"
              style={{
                animation:
                  count > 1
                    ? `marquee-vertical ${count * 2.5}s linear infinite`
                    : "none",
              }}
            >
              {/* Render twice for seamless loop */}
              {[...products, ...products].map((p, i) => (
                <div
                  key={`${p.id}-${i}`}
                  className="relative shrink-0 rounded-xl overflow-hidden bg-[var(--background)] cursor-pointer"
                  style={{ height: 120 }}
                  onClick={() => setActive(i % count)}
                >
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name ?? ""}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#D4CEC2_0px,#D4CEC2_7px,rgba(10,10,10,0.06)_7px,rgba(10,10,10,0.06)_8px)]" />
                  )}
                  {/* Active indicator */}
                  {i % count === active && (
                    <div className="absolute inset-0 ring-2 ring-[var(--foreground)] rounded-xl" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom pill */}
        <div className="shrink-0 bg-[var(--foreground)] text-[var(--background)] rounded-2xl px-5 py-3.5 flex items-center justify-between">
          <span className="text-[10px] tracking-[0.15em] uppercase opacity-60">
            {count} pieces
          </span>
          {totalPrice > 0 && (
            <span className="text-sm font-bold">
              ${totalPrice.toLocaleString()}
            </span>
          )}
          <span className="text-[12px] flex items-center gap-1.5 opacity-80">
            Shop the look
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        {/* Dot indicators */}
        <div className="shrink-0 flex justify-center gap-1.5">
          {products.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setOpacity(0);
                setTimeout(() => {
                  setActive(i);
                  setOpacity(1);
                }, 350);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active
                  ? "w-5 bg-[var(--foreground)]"
                  : "w-1.5 bg-[var(--border-strong)]"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
