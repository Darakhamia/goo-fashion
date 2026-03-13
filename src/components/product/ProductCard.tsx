"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect, useMemo } from "react";
import { Product } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";

const SLIDE_MS   = 500;   // animation duration
const INTERVAL_MS = 5000; // time each image is shown

interface ProductCardProps {
  product: Product;
  showBrand?: boolean;
}

export default function ProductCard({ product, showBrand = true }: ProductCardProps) {
  const { isProductLiked, toggleProductLike } = useLikes();
  const liked = isProductLiked(product.id);

  const allImages = useMemo(
    () => (product.images?.length ? product.images : [product.imageUrl]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product.id]          // stable per product — avoids new array ref every render
  );
  const hasMultiple = allImages.length > 1;

  const [isHovered,   setIsHovered]   = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(0);
  const [outgoingIdx, setOutgoingIdx] = useState<number | null>(null);

  // All mutable "timer" state in a single ref — never causes re-renders
  const t = useRef({
    activeIdx: 0,
    animating: false,
    interval:  null as ReturnType<typeof setInterval>  | null,
    timeout:   null as ReturnType<typeof setTimeout>   | null,
  });

  // ── Slideshow lifecycle ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHovered || !hasMultiple) return;

    const state = t.current; // stable object — safe to use in cleanup

    const doSlide = () => {
      if (state.animating) return;
      state.animating = true;

      const prev = state.activeIdx;
      const next = (prev + 1) % allImages.length;

      setOutgoingIdx(prev);
      setActiveIdx(next);
      state.activeIdx = next;

      state.timeout = setTimeout(() => {
        setOutgoingIdx(null);
        state.animating = false;
        state.timeout = null;
      }, SLIDE_MS);
    };

    // Advance immediately on hover, then every INTERVAL_MS
    doSlide();
    state.interval = setInterval(doSlide, INTERVAL_MS);

    // ── Cleanup: runs when isHovered→false OR component unmounts ───────────
    return () => {
      if (state.interval) { clearInterval(state.interval);  state.interval  = null; }
      if (state.timeout)  { clearTimeout(state.timeout);    state.timeout   = null; }
      state.animating  = false;
      state.activeIdx  = 0;
      // Immediately snap back to main image — no animation needed
      setOutgoingIdx(null);
      setActiveIdx(0);
    };
  }, [isHovered, hasMultiple, allImages]); // allImages is memoized → stable ref

  return (
    <div
      className="group relative block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/product/${product.id}`} className="block">
        {/* ── Image container ── */}
        <div className="relative bg-[var(--surface)] overflow-hidden aspect-[3/4]">

          {/* Base layer — always visible, no animation */}
          <div className="absolute inset-0">
            <Image
              src={allImages[activeIdx]}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          </div>

          {/* Animation layers — only mounted during a transition */}
          {outgoingIdx !== null && (
            <>
              {/* Outgoing: current image slides out to the left */}
              <div
                className="absolute inset-0 z-[1]"
                style={{
                  animation: `cardSlideOutToLeft ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1) forwards`,
                }}
              >
                <Image
                  src={allImages[outgoingIdx]}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              </div>

              {/* Incoming: next image slides in from the right */}
              <div
                className="absolute inset-0 z-[2]"
                style={{
                  animation: `cardSlideInFromRight ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1) forwards`,
                }}
              >
                <Image
                  src={allImages[activeIdx]}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              </div>
            </>
          )}

          {/* Dot indicators */}
          {hasMultiple && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {allImages.map((_, i) => (
                <div
                  key={i}
                  className={`h-[3px] rounded-full transition-all duration-300 ${
                    i === activeIdx ? "bg-white w-3" : "bg-white/40 w-[3px]"
                  }`}
                />
              ))}
            </div>
          )}

          {/* New Badge */}
          {product.isNew && (
            <div className="absolute top-2 left-2 z-10">
              <span className="text-[8px] tracking-[0.16em] uppercase font-medium bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] px-2 py-1 block">
                New
              </span>
            </div>
          )}

          {/* Retailers count overlay */}
          {product.retailers.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
              <div className="bg-[var(--bg-overlay-95)] backdrop-blur-sm px-3 py-2">
                <p className="text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-muted)]">
                  {product.retailers.length} stores
                </p>
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Like Button */}
      <button
        onClick={() => toggleProductLike(product.id)}
        aria-label={liked ? "Unlike item" : "Like item"}
        className="absolute top-2 right-2 z-20 w-7 h-7 flex items-center justify-center bg-[var(--bg-overlay-90)] backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            fill={liked ? "currentColor" : "none"}
            className="text-[var(--foreground)]"
          />
        </svg>
      </button>

      {/* Info */}
      <Link href={`/product/${product.id}`} className="block mt-3 space-y-0.5">
        {showBrand && (
          <p className="text-[9px] tracking-[0.16em] uppercase font-medium text-[var(--foreground-subtle)]">
            {product.brand}
          </p>
        )}
        <h3 className="text-xs text-[var(--foreground)] leading-snug group-hover:text-[var(--foreground-muted)] transition-colors duration-200">
          {product.name}
        </h3>
        <p className="text-xs text-[var(--foreground-muted)]">
          {product.priceMin === product.priceMax
            ? `$${product.priceMin.toLocaleString()}`
            : `From $${product.priceMin.toLocaleString()}`}
        </p>
      </Link>
    </div>
  );
}
