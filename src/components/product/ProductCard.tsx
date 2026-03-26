"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect, useMemo } from "react";
import { Product, ProductSwatch, CropData } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";

const SLIDE_MS    = 500;
const INTERVAL_MS = 5000;

interface ProductCardProps {
  product: Product;
  showBrand?: boolean;
}

export default function ProductCard({ product, showBrand = true }: ProductCardProps) {
  const { isProductLiked, toggleProductLike } = useLikes();
  const liked = isProductLiked(product.id);

  // ── Active variant (null = show the base product) ──────────────────────────
  const [activeVariant, setActiveVariant] = useState<ProductSwatch | null>(null);

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

  const [isHovered,   setIsHovered]   = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(0);
  const [outgoingIdx, setOutgoingIdx] = useState<number | null>(null);

  // Reset slideshow index when variant (and thus images) changes
  useEffect(() => {
    setActiveIdx(0);
    setOutgoingIdx(null);
  }, [activeVariant]);

  // All mutable timer state in one ref
  const t = useRef({
    activeIdx: 0,
    animating: false,
    interval:  null as ReturnType<typeof setInterval>  | null,
    timeout:   null as ReturnType<typeof setTimeout>   | null,
  });

  useEffect(() => {
    if (!isHovered || !hasMultiple) return;

    const state = t.current;

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
        state.timeout   = null;
      }, SLIDE_MS);
    };

    doSlide();
    state.interval = setInterval(doSlide, INTERVAL_MS);

    return () => {
      if (state.interval) { clearInterval(state.interval);  state.interval  = null; }
      if (state.timeout)  { clearTimeout(state.timeout);    state.timeout   = null; }
      state.animating = false;
      state.activeIdx = 0;
      setOutgoingIdx(null);
      setActiveIdx(0);
    };
  }, [isHovered, hasMultiple, allImages.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (t.current.interval) clearInterval(t.current.interval);
      if (t.current.timeout)  clearTimeout(t.current.timeout);
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

  const activeSwatchId = activeVariant?.id ?? product.id;

  return (
    <div
      className="group relative block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={linkHref} className="block">
        {/* ── Image container ─────────────────────────────────────────── */}
        <div className="relative bg-[var(--surface)] overflow-hidden aspect-[3/4]">

          {/* Base layer */}
          <div className="absolute inset-0 overflow-hidden">
            <CroppedImage
              src={allImages[activeIdx]}
              alt={product.name}
              cropData={activeVariant ? undefined : product.cropData}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          </div>

          {/* Transition layers */}
          {outgoingIdx !== null && (
            <>
              <div
                className="absolute inset-0 z-[1] overflow-hidden"
                style={{ animation: `cardSlideOutToLeft ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1) forwards` }}
              >
                <CroppedImage
                  src={allImages[outgoingIdx]}
                  alt={product.name}
                  cropData={activeVariant ? undefined : product.cropData}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              </div>
              <div
                className="absolute inset-0 z-[2] overflow-hidden"
                style={{ animation: `cardSlideInFromRight ${SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1) forwards` }}
              >
                <CroppedImage
                  src={allImages[activeIdx]}
                  alt={product.name}
                  cropData={activeVariant ? undefined : product.cropData}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              </div>
            </>
          )}

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

      {/* ── Info block ──────────────────────────────────────────────────── */}
      <Link href={linkHref} className="block mt-3 space-y-0.5">
        {showBrand && (
          <p className="text-[9px] tracking-[0.16em] uppercase font-medium text-[var(--foreground-subtle)]">
            {product.brand}
          </p>
        )}
        <h3 className="text-xs text-[var(--foreground)] leading-snug group-hover:text-[var(--foreground-muted)] transition-colors duration-200">
          {displayName}
        </h3>
        <p className="text-xs text-[var(--foreground-muted)]">
          {displayPriceMin === displayPriceMax
            ? `$${displayPriceMin.toLocaleString()}`
            : `From $${displayPriceMin.toLocaleString()}`}
        </p>
      </Link>

      {/* ── Available sizes (in-stock preview) ──────────────────────────── */}
      {displaySizes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {displaySizes.slice(0, 5).map((size) => (
            <span
              key={size}
              className="text-[9px] tracking-[0.08em] border border-[var(--border)] text-[var(--foreground-subtle)] px-1.5 py-0.5"
            >
              {size}
            </span>
          ))}
        </div>
      )}

      {/* ── Colour swatch palette ────────────────────────────────────────── */}
      {hasSwatches && baseSwatch && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {/* Swatch for the base/primary product */}
          <SwatchButton
            swatch={baseSwatch}
            active={activeSwatchId === product.id}
            onSelect={() => setActiveVariant(null)}
          />
          {/* Swatches for the other variants */}
          {swatches!
            .filter((s) => s.id !== product.id)
            .map((swatch) => (
              <SwatchButton
                key={swatch.id}
                swatch={swatch}
                active={activeSwatchId === swatch.id}
                onSelect={() => setActiveVariant(swatch)}
              />
            ))}
        </div>
      )}
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
        className="object-cover"
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

function SwatchButton({
  swatch,
  active,
  onSelect,
}: {
  swatch: ProductSwatch;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      title={swatch.colorName}
      aria-label={`Switch to ${swatch.colorName}`}
      onClick={(e) => {
        e.preventDefault();
        onSelect();
      }}
      className={`w-4 h-4 border-2 transition-all duration-150 shrink-0 ${
        active
          ? "border-[var(--foreground)] scale-110 shadow-sm"
          : "border-[var(--border)] hover:border-[var(--foreground-muted)] hover:scale-105"
      }`}
      style={{ backgroundColor: swatch.colorHex }}
    />
  );
}
