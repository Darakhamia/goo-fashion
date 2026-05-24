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
    pathname.startsWith("/goo-studio") ||
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
        className={`hidden md:flex fixed bottom-6 right-6 z-40 items-center justify-center transition-all duration-300 ${
          isOpen
            ? "w-10 h-10 rounded-full bg-[var(--foreground)] text-[var(--background)] shadow-lg"
            : "rounded-2xl pl-3.5 pr-5 py-3 gap-3 bg-[var(--foreground)] text-[var(--background)] shadow-[0_8px_32px_rgba(0,0,0,0.18)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.24)] hover:scale-[1.02]"
        }`}
      >
        {isOpen ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M2 2L12 12M12 2L2 12" />
          </svg>
        ) : (
          <>
            {/* Avatar with online dot */}
            <div className="relative shrink-0">
              <div className="w-7 h-7 rounded-full bg-[var(--background)]/15 flex items-center justify-center text-[12px] font-bold">
                G
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border-[1.5px] border-[var(--foreground)]" />
            </div>
            <div className="flex flex-col items-start gap-[3px]">
              <span className="text-[12px] font-semibold tracking-[-0.01em] leading-none">AI Stylist</span>
              <span className="text-[10px] leading-none" style={{ opacity: 0.45 }}>Build your perfect look</span>
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
