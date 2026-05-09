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
        className={`hidden md:flex fixed bottom-8 right-6 z-40 items-center justify-center border transition-all duration-300 ${
          isOpen
            ? "w-10 h-10 rounded-full bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)] shadow-lg"
            : "h-10 rounded-full px-4 gap-2 bg-[var(--background)] text-[var(--foreground)] border-[var(--border-strong)] shadow-[0_0_0_0_rgba(255,255,255,0)] hover:border-[var(--foreground)] hover:shadow-[0_0_22px_8px_rgba(255,255,255,0.09)]"
        }`}
      >
        {isOpen ? (
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M2 2L12 12M12 2L2 12" />
          </svg>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1.5L9.5 6H14L10.5 8.5L11.8 13L8 10.5L4.2 13L5.5 8.5L2 6H6.5L8 1.5Z" />
            </svg>
            <span className="font-mono text-[9px] tracking-[0.14em] uppercase">AI Stylist</span>
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
