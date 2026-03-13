"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { Product } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";

const SLIDE_MS = 500;     // duration of the slide animation
const INTERVAL_MS = 5000; // time each image is shown before switching

interface ProductCardProps {
  product: Product;
  showBrand?: boolean;
}

export default function ProductCard({ product, showBrand = true }: ProductCardProps) {
  const { isProductLiked, toggleProductLike } = useLikes();
  const liked = isProductLiked(product.id);

  const allImages = product.images?.length ? product.images : [product.imageUrl];
  const hasMultiple = allImages.length > 1;

  // activeIdx  — image currently in the "resting" layer
  // outgoingIdx — image being animated out (null when not transitioning)
  const [activeIdx, setActiveIdx] = useState(0);
  const [outgoingIdx, setOutgoingIdx] = useState<number | null>(null);

  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeIdxRef = useRef(0);   // stable ref so closures always see the latest index
  const animatingRef = useRef(false);

  const slideTo = (next: number) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    setOutgoingIdx(activeIdxRef.current);
    setActiveIdx(next);
    activeIdxRef.current = next;
    setTimeout(() => {
      setOutgoingIdx(null);
      animatingRef.current = false;
    }, SLIDE_MS);
  };

  const handleMouseEnter = () => {
    if (!hasMultiple) return;
    // Immediately show second image
    slideTo((activeIdxRef.current + 1) % allImages.length);
    // Then keep cycling
    intervalRef.current = setInterval(() => {
      slideTo((activeIdxRef.current + 1) % allImages.length);
    }, INTERVAL_MS);
  };

  const handleMouseLeave = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Reset to main image
    if (activeIdxRef.current !== 0) {
      slideTo(0);
    }
  };

  return (
    <div
      className="group relative block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link href={`/product/${product.id}`} className="block">
        {/* Image container */}
        <div className="relative bg-[var(--surface)] overflow-hidden aspect-[3/4]">

          {/* Base layer — always visible, shows active image without animation */}
          <div className="absolute inset-0">
            <Image
              src={allImages[activeIdx]}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          </div>

          {/* Animation layers — only present during a transition */}
          {outgoingIdx !== null && (
            <>
              {/* Outgoing: slides out to the left */}
              <div
                className="absolute inset-0 z-[1]"
                style={{ animation: `cardSlideOutToLeft ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1) forwards` }}
              >
                <Image
                  src={allImages[outgoingIdx]}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              </div>
              {/* Incoming: slides in from the right */}
              <div
                className="absolute inset-0 z-[2]"
                style={{ animation: `cardSlideInFromRight ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1) forwards` }}
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

          {/* Dot indicators (only when multiple images) */}
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
