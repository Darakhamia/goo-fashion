"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef, useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Product, ProductSwatch, CropData, Category } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";
import { useAuth } from "@/lib/context/auth-context";
import { useCurrency } from "@/lib/context/currency-context";

const SLIDE_MS    = 500;
const INTERVAL_MS = 5000;

const CATEGORY_TO_SLOT: Record<string, string> = {
  outerwear:   "outerwear",
  blazers:     "outerwear",
  tops:        "top",
  shirts:      "top",
  knitwear:    "top",
  bottoms:     "bottom",
  jeans:       "bottom",
  shorts:      "bottom",
  skirts:      "bottom",
  dresses:     "bottom",
  jumpsuits:   "bottom",
  footwear:    "shoes",
  accessories: "accessories",
  bags:        "accessories",
  swimwear:    "accessories",
};

const CATEGORY_DISPLAY: Partial<Record<Category, string>> = {
  accessories: "Accessory",
  bags:        "Bag",
  footwear:    "Footwear",
  tops:        "Top",
  shirts:      "Shirt",
  knitwear:    "Knitwear",
  bottoms:     "Bottoms",
  jeans:       "Jeans",
  shorts:      "Shorts",
  skirts:      "Skirt",
  dresses:     "Dress",
  jumpsuits:   "Jumpsuit",
  outerwear:   "Outerwear",
  blazers:     "Blazer",
  swimwear:    "Swimwear",
};

function buildOutfitUrl(product: Product): string {
  const slot = CATEGORY_TO_SLOT[product.category] ?? "top";
  return `/builder?${slot}=${product.id}`;
}

interface ProductCardProps {
  product: Product;
  showBrand?: boolean;
  initialVariant?: ProductSwatch | null;
}

function ColorfulCircle() {
  return (
    <div
      className="w-4 h-4 rounded-full shrink-0"
      style={{
        background:
          "conic-gradient(#FF6B6B 0deg 60deg, #FFD93D 60deg 120deg, #6BCB77 120deg 180deg, #4D96FF 180deg 240deg, #C77DFF 240deg 300deg, #FF9A3C 300deg 360deg)",
      }}
    />
  );
}

function TagIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[var(--foreground-subtle)]">
      <path
        d="M9 1H4a1 1 0 0 0-.707.293l-2 2A1 1 0 0 0 1 4v5a1 1 0 0 0 .293.707l6 6a1 1 0 0 0 1.414 0l5-5a1 1 0 0 0 0-1.414l-6-6A1 1 0 0 0 9 1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="4.5" cy="4.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[var(--foreground-subtle)]">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
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
  const allImages   = displayImages;
  const hasMultiple = allImages.length > 1;

  const [isHovered, setIsHovered] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const t = useRef({
    activeIdx: 0,
    direction: 1 as 1 | -1,
    interval:  null as ReturnType<typeof setInterval> | null,
  });

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
      if (next >= allImages.length) { state.direction = -1; next = state.activeIdx + state.direction; }
      else if (next < 0)            { state.direction =  1; next = state.activeIdx + state.direction; }
      state.activeIdx = next;
      setActiveIdx(next);
    };

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

  useEffect(() => {
    return () => {
      if (t.current.interval) clearInterval(t.current.interval);
    };
  }, []);

  // ── Colour swatches ─────────────────────────────────────────────────────────
  const swatches    = product.variants;
  const hasSwatches = !!swatches?.length;

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

  const colorCount = hasSwatches && baseSwatch
    ? 1 + swatches!.filter(s => s.id !== product.id).length
    : 0;

  // Show sizes list only when there are 2+ distinct sizes
  const hasSizes = displaySizes.length > 1;

  const categoryLabel = CATEGORY_DISPLAY[product.category]
    ?? (product.category.charAt(0).toUpperCase() + product.category.slice(1));

  const sizeInfoText = displaySizes.length === 1
    ? displaySizes[0]
    : "One size";

  return (
    <motion.div
      className="group relative flex flex-col overflow-hidden bg-[var(--surface)] rounded-2xl border border-[var(--border)]"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={linkHref} className="block">
        {/* ── Image container ─────────────────────────────────────────── */}
        <div className="relative bg-[#f0f0f0] overflow-hidden aspect-[3/4]">

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
            <div className="absolute top-3 left-3 z-10">
              <span className="text-[9px] tracking-[0.18em] uppercase font-bold bg-[var(--foreground)] text-[var(--background)] px-2.5 py-1 rounded-sm block">
                New
              </span>
            </div>
          )}

          {/* Retailer count */}
          {product.retailers.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
              <div className="bg-[var(--bg-overlay-95)] backdrop-blur-sm px-3 py-2 rounded-b-2xl">
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
        className={`absolute top-3 right-3 z-20 w-7 h-7 flex items-center justify-center bg-[var(--bg-overlay-90)] backdrop-blur-sm rounded-full transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 ${liked ? "opacity-100" : "opacity-60"}`}
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

      {/* ── Info block ── */}
      <div className="flex flex-col flex-1 pt-3 pb-3">
        <Link href={linkHref} className="block px-4">
          {/* Brand */}
          {showBrand && (
            <p className="text-[9px] tracking-[0.18em] uppercase font-semibold text-[var(--foreground-subtle)] truncate">
              {product.brand}
            </p>
          )}
          {/* Name */}
          <h3 className="text-base font-bold text-[var(--foreground)] truncate mt-1 leading-snug">
            {displayName}
          </h3>
          {/* Price */}
          <p className="font-mono text-sm font-medium text-[var(--foreground-muted)] mt-1.5">
            {displayPriceMin === displayPriceMax
              ? formatPrice(displayPriceMin)
              : `From ${formatPrice(displayPriceMin)}`}
          </p>
        </Link>

        {/* Divider */}
        <div className="mx-4 mt-3 border-t border-[var(--border)]" />

        {hasSizes ? (
          /* ── Sizes + colors layout ── */
          <div className="px-4 mt-3 flex flex-col gap-2 min-h-[72px]">
            <div>
              <p className="text-[10px] text-[var(--foreground-subtle)] mb-1.5">Sizes</p>
              <div className="flex flex-wrap gap-1">
                {displaySizes.slice(0, 6).map((size) => (
                  <span
                    key={size}
                    className="text-[10px] font-medium border border-[var(--border-strong)] text-[var(--foreground-muted)] px-2 py-0.5 rounded-md"
                  >
                    {size}
                  </span>
                ))}
              </div>
            </div>

            {colorCount > 0 && (
              <div className="flex items-center gap-1.5">
                <ColorfulCircle />
                <span className="text-[11px] text-[var(--foreground-subtle)]">
                  {colorCount} {colorCount === 1 ? "color" : "colors"}
                </span>
              </div>
            )}
          </div>
        ) : (
          /* ── Accessory-style info layout ── */
          <div className="px-4 mt-3 flex flex-col gap-1.5 min-h-[72px]">
            <div className="flex items-center gap-2 border border-[var(--border)] rounded-lg px-2.5 py-1.5">
              <TagIcon />
              <span className="text-[11px] text-[var(--foreground-muted)]">{categoryLabel}</span>
            </div>
            <div className="flex items-center gap-2 border border-[var(--border)] rounded-lg px-2.5 py-1.5">
              <CircleIcon />
              <span className="text-[11px] text-[var(--foreground-muted)]">
                {sizeInfoText}
                {!hasSwatches && " • No color variants"}
                {hasSwatches && colorCount > 0 && ` • ${colorCount} color${colorCount === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>
        )}

        {/* Add to outfit */}
        <div className="flex-1" />
        <Link
          href={buildOutfitUrl(product)}
          className="mx-3 mt-3 flex items-center justify-between border border-[var(--border-strong)] hover:border-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] text-[var(--foreground)] transition-all duration-200 px-4 py-2.5 rounded-xl group/btn"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[9px] tracking-[0.16em] uppercase font-bold">Add to Outfit</span>
          <span className="text-base leading-none font-light text-[var(--foreground-muted)] group-hover/btn:text-[var(--foreground)] transition-colors">+</span>
        </Link>
      </div>
    </motion.div>
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
