"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect, useMemo } from "react";
import { Product, ProductSwatch, CropData } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";
import { useAuth } from "@/lib/context/auth-context";
import { useCurrency } from "@/lib/context/currency-context";

const SLIDE_MS    = 500;
const INTERVAL_MS = 5000;

interface ProductCardProps {
  product: Product;
  showBrand?: boolean;
  initialVariant?: ProductSwatch | null;
}

export default function ProductCard({ product, showBrand = true, initialVariant = null }: ProductCardProps) {
  const { isProductLiked, toggleProductLike } = useLikes();
  const { isLoggedIn, login } = useAuth();
  const { formatPrice } = useCurrency();
  const liked = isProductLiked(product.id);

  const handleLike = () => {
    if (!isLoggedIn) {
      login("", "");
      return;
    }
    toggleProductLike(product.id);
  };

  // ── Active variant (null = show the base product) ──────────────────────────
  const [activeVariant, setActiveVariant] = useState<ProductSwatch | null>(initialVariant);

  // Derived display values — switch between base product and the selected swatch
  const displayImages = useMemo(() => {
    if (activeVariant) {
      return activeVariant.images?.length ? activeVariant.images : [activeVariant.imageUrl];
    }
    return product.images?.length ? product.images : [product.imageUrl];
  }, [activeVariant, product]);

  const displayName     = activeVariant ? activeVariant.name     : product.name;
  const displayPriceMin = activeVariant ? activeVariant.priceMin : product.priceMin;
  const displayPriceMax = activeVariant ? activeVariant.priceMax : product.priceMax;
  const displaySizes    = activeVariant ? activeVariant.sizes    : product.sizes;
  const linkHref        = `/product/${activeVariant ? activeVariant.id : product.id}`;

  // ── Slideshow state ─────────────────────────────────────────────────────────
  const allImages  = displayImages;
  const hasMultiple = allImages.length > 1;

  const [isHovered, setIsHovered] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  // All mutable timer state in one ref (no animating/timeout needed with CSS transitions)
  const t = useRef({
    activeIdx: 0,
    direction: 1 as 1 | -1,   // ping-pong direction
    interval:  null as ReturnType<typeof setInterval> | null,
  });

  // Reset when the displayed images change (variant switch)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIdx(0);
    t.current.activeIdx = 0;
    t.current.direction = 1;
  }, [activeVariant]);

  useEffect(() => {
    const state = t.current;

    if (!isHovered) {
      if (state.interval) { clearInterval(state.interval); state.interval = null; }
      // CSS transition on the strip handles the smooth return to image 0
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveIdx(0);
      state.activeIdx = 0;
      state.direction = 1;
      return;
    }

    if (!hasMultiple) return;

    setActiveIdx(0);
    state.activeIdx = 0;
    state.direction = 1;

    const doSlide = () => {
      let next = state.activeIdx + state.direction;
      // Ping-pong: reverse at the ends instead of wrapping
      if (next >= allImages.length) { state.direction = -1; next = state.activeIdx + state.direction; }
      else if (next < 0)            { state.direction =  1; next = state.activeIdx + state.direction; }
      state.activeIdx = next;
      setActiveIdx(next);
    };

    // Wait 3 s before the first slide
    let startDelay: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      startDelay = null;
      doSlide();
      state.interval = setInterval(doSlide, INTERVAL_MS);
    }, 3000);

    return () => {
      if (startDelay)     { clearTimeout(startDelay);      startDelay      = null; }
      if (state.interval) { clearInterval(state.interval); state.interval  = null; }
    };
  }, [isHovered, hasMultiple, allImages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (t.current.interval) clearInterval(t.current.interval);
    };
  }, []);

  // ── Colour swatches ─────────────────────────────────────────────────────────
  const swatches = product.variants;          // undefined when not a grouped product
  const hasSwatches = !!swatches?.length;

  // The swatch that represents the base product itself
  const baseSwatch: ProductSwatch | null = hasSwatches
    ? {
        id:        product.id,
        name:      product.name,
        colorName: product.colors?.[0] || product.name,
        colorHex:  product.colorHex ?? "#888888",
        priceMin:  product.priceMin,
        priceMax:  product.priceMax,
        imageUrl:  product.imageUrl,
        images:    product.images ?? [],
        sizes:     product.sizes  ?? [],
      }
    : null;

  return (
    <div
      className="group relative block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={linkHref} className="block">
        {/* ── Image container ─────────────────────────────────────────── */}
        <div className="relative bg-white overflow-hidden aspect-[3/4]">

          {/* Image strip — all frames in a flex row, CSS transition slides to active frame */}
          <div
            className="absolute inset-0 flex"
            style={{
              width: `${allImages.length * 100}%`,
              transform: `translateX(-${(activeIdx * 100) / allImages.length}%)`,
              transition: `transform ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1)`,
            }}
          >
            {allImages.map((src, i) => (
              <div
                key={i}
                className="card-zoom-layer relative overflow-hidden"
                style={{ width: `${100 / allImages.length}%`, flexShrink: 0 }}
              >
                <CroppedImage
                  src={src}
                  alt={product.name}
                  cropData={activeVariant ? undefined : product.cropData}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              </div>
            ))}
          </div>

          {/* Slideshow dots */}
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

          {/* New badge */}
          {product.isNew && (
            <div className="absolute top-2 left-2 z-10">
              <span className="text-[8px] tracking-[0.16em] uppercase font-medium bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] px-2 py-1 block">
                New
              </span>
            </div>
          )}

          {/* Retailer count */}
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

      {/* ── Like button ─────────────────────────────────────────────────── */}
      <button
        onClick={handleLike}
        aria-label={!isLoggedIn ? "Sign in to save item" : liked ? "Unlike item" : "Like item"}
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

      {/* ── Info block — every row has a fixed height so all cards align ── */}
      <Link href={linkHref} className="block mt-2">
        {/* Brand */}
        <div className="h-3.5 flex items-center overflow-hidden">
          {showBrand && (
            <p className="text-[9px] tracking-[0.16em] uppercase font-medium text-[var(--foreground-subtle)] truncate">
              {product.brand}
            </p>
          )}
        </div>
        {/* Name */}
        <div className="h-4 mt-0.5 flex items-center overflow-hidden">
          <h3 className="text-xs text-[var(--foreground)] leading-none group-hover:text-[var(--foreground-muted)] transition-colors duration-200 truncate w-full">
            {displayName}
          </h3>
        </div>
        {/* Price */}
        <div className="h-4 mt-0.5 flex items-center overflow-hidden">
          <p className="text-xs text-[var(--foreground-muted)] truncate">
            {displayPriceMin === displayPriceMax
              ? formatPrice(displayPriceMin)
              : `From ${formatPrice(displayPriceMin)}`}
          </p>
        </div>
      </Link>

      {/* Sizes — fixed height so cards with no sizes still reserve the row */}
      <div className="h-6 mt-1.5 flex items-center overflow-hidden">
        <div className="flex gap-1 overflow-hidden">
          {displaySizes.slice(0, 5).map((size) => (
            <span
              key={size}
              className="text-[9px] tracking-[0.08em] border border-[var(--border)] text-[var(--foreground-subtle)] px-1.5 py-0.5 shrink-0"
            >
              {size}
            </span>
          ))}
        </div>
      </div>

      {/* Colour count */}
      <div className="h-4 mt-1 flex items-center">
        {hasSwatches && baseSwatch && (() => {
          const count = 1 + swatches!.filter(s => s.id !== product.id).length;
          return (
            <span className="text-[11px] leading-none text-[var(--foreground-subtle)]">
              {count} {count === 1 ? "color" : "colors"}
            </span>
          );
        })()}
      </div>
    </div>
  );
}

// ── CSS-based crop display (no server-side resize needed) ───────────────────
function CroppedImage({
  src,
  alt,
  cropData,
  sizes,
}: {
  src: string;
  alt: string;
  cropData?: CropData;
  sizes?: string;
}) {
  if (!cropData) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain"
        sizes={sizes}
      />
    );
  }
  // Expand the inner container so only the crop window is visible
  return (
    <div
      style={{
        position: "absolute",
        width: `${(1 / cropData.width) * 100}%`,
        height: `${(1 / cropData.height) * 100}%`,
        left: `${(-cropData.x / cropData.width) * 100}%`,
        top: `${(-cropData.y / cropData.height) * 100}%`,
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes={sizes}
        style={{
          objectPosition: `${cropData.focalX * 100}% ${cropData.focalY * 100}%`,
        }}
      />
    </div>
  );
}

