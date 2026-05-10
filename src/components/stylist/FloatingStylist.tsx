"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import type { Product } from "@/lib/types";

export function FloatingStylist() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  // Hide on admin/auth pages
  const isHidden =
    pathname.startsWith("/admin") ||
    pathname === "/login";

  useEffect(() => {
    if (isOpen && products.length === 0) {
      fetch("/api/products")
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setProducts(d); })
        .catch(() => {});
    }
  }, [isOpen, products.length]);

  if (isHidden) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(v => !v)}
        aria-label="Open AI Stylist"
        className={`hidden md:flex fixed bottom-20 right-6 z-40 items-center justify-center border transition-all duration-300 ${
          isOpen
            ? "w-10 h-10 rounded-full bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)] shadow-lg"
            : "rounded-full px-5 py-3 gap-3 bg-[var(--background)] text-[var(--foreground)] border-[var(--border-strong)] hover:border-[var(--foreground)] hover:shadow-[0_0_28px_10px_rgba(255,255,255,0.08)] shadow-[0_0_0_0_rgba(255,255,255,0)]"
        }`}
      >
        {isOpen ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M2 2L12 12M12 2L2 12" />
          </svg>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 opacity-90">
              <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" />
            </svg>
            <div className="flex flex-col items-start gap-0">
              <span className="font-sans text-[11px] tracking-[0.18em] uppercase font-bold leading-none">AI Stylist</span>
              <span className="font-sans text-[9.5px] tracking-[0.04em] text-[var(--foreground)] opacity-55 leading-none mt-[3px]">Build your perfect look</span>
            </div>
          </>
        )}
      </button>

      <StylistDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        surface="browse"
        products={products}
        position="fixed"
      />
    </>
  );
}
