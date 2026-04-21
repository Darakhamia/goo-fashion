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
    pathname === "/login" ||
    pathname === "/register";

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
        className={`fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border transition-all duration-200 ${
          isOpen
            ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
            : "bg-[var(--background)] text-[var(--foreground)] border-[var(--border-strong)] hover:border-[var(--foreground)]"
        }`}
      >
        {isOpen ? (
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M2 2L12 12M12 2L2 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 1.5L9.5 6H14L10.5 8.5L11.8 13L8 10.5L4.2 13L5.5 8.5L2 6H6.5L8 1.5Z" />
          </svg>
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
