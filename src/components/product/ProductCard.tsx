"use client";

import Link from "next/link";
import { useRef, useState, useEffect, useMemo } from "react";
import ProductImage from "./ProductImage";
import { motion } from "framer-motion";
import { Product, ProductSwatch, CropData } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";
import { useAuth } from "@/lib/context/auth-context";
import { useCurrency } from "@/lib/context/currency-context";
import { useCart } from "@/lib/context/cart-context";

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
  const { addToCart, isInCart, removeFromCart } = useCart();
  const liked = isProductLiked(product.id);

  const handleLike = () => {
    if (!isLoggedIn) { login("", ""); return; }
    toggleProductLike(product.id);
  };

  const [activeVariant, setActiveVariant] = useState<ProductSwatch | null>(initialVariant);

  const currentId = activeVariant ? activeVariant.id : product.id;
  const inCart = isInCart(currentId);

  const handleAddToCart = () => {
    if (inCart) {
      removeFromCart(currentId);
    } else {
      addToCart({
        id: currentId,
        name: activeVariant ? activeVariant.name : product.name,
        brand: product.brand,
        imageUrl: activeVariant ? activeVariant.imageUrl : product.imageUrl,
        price: activeVariant ? activeVariant.priceMin : product.priceMin,
        currency: product.currency,
        retailerUrl: product.retailers?.[0]?.url ?? null,
      });
    }
  };

  const displayImages = useMemo(() => {
    if (activeVariant) return activeVariant.images?.length ? activeVariant.images : [activeVariant.imageUrl];
    return product.images?.length ? product.images : [product.imageUrl];
  }, [activeVariant, product]);

  const displayName     = activeVariant ? activeVariant.name     : product.name;
  const displayPriceMin = activeVariant ? activeVariant.priceMin : product.priceMin;
  const displayPriceMax = activeVariant ? activeVariant.priceMax : product.priceMax;
  const linkHref        = `/product/${activeVariant ? activeVariant.id : product.id}`;

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
    setActiveIdx(0);
    t.current.activeIdx = 0;
    t.current.direction = 1;
  }, [activeVariant]);

  useEffect(() => {
    const state = t.current;
    if (!isHovered) {
      if (state.interval) { clearInterval(state.interval); state.interval = null; }
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
      if (next >= allImages.length)  { state.direction = -1; next = state.activeIdx + state.direction; }
      else if (next < 0)             { state.direction =  1; next = state.activeIdx + state.direction; }
      state.activeIdx = next;
      setActiveIdx(next);
    };

    let startDelay: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      startDelay = null;
      doSlide();
      state.interval = setInterval(doSlide, INTERVAL_MS);
    }, 3000);

    return () => {
      if (startDelay)     { clearTimeout(startDelay);      startDelay     = null; }
      if (state.interval) { clearInterval(state.interval); state.interval = null; }
    };
  }, [isHovered, hasMultiple, allImages]);

  useEffect(() => {
    return () => { if (t.current.interval) clearInterval(t.current.interval); };
  }, []);

  const swatches  = product.variants;
  const hasSwatches = !!swatches?.length;

  const colorCount = hasSwatches
    ? 1 + (swatches?.filter(s => s.id !== product.id).length ?? 0)
    : 0;

  return (
    <motion.div
      className="glass-edge group relative flex flex-col overflow-hidden rounded-xl border border-[var(--border)]"
      initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: 'spring', bounce: 0.2, duration: 0.8 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={linkHref} className="block">
        {/* Image */}
        <div className="relative bg-white overflow-hidden aspect-[3/4]">
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
                  alt={`${product.name} by ${product.brand}`}
                  cropData={activeVariant ? undefined : product.cropData}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>
            ))}
          </div>

          {hasMultiple && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
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

          {product.isNew && (
            <div className="absolute top-3 left-3 z-10">
              <span className="text-[9px] tracking-[0.18em] uppercase font-bold bg-[var(--foreground)] text-[var(--background)] px-2.5 py-1 rounded-sm block">
                New
              </span>
            </div>
          )}

          {product.retailers.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-10">
              <div className="bg-[var(--bg-overlay-95)] backdrop-blur-sm px-3 py-2 rounded-b-xl">
                <p className="text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-muted)]">
                  {product.retailers.length} stores
                </p>
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Cart button */}
      <button
        onClick={handleAddToCart}
        aria-label={inCart ? "Remove from cart" : "Add to cart"}
        className={`absolute ${product.isNew ? "top-11" : "top-3"} left-3 z-20 w-9 h-9 md:w-7 md:h-7 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-full transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 opacity-100`}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-white">
          <path d="M1 1h2l1.5 7.5" />
          <path d="M4.5 8.5h8l1.5-5.5H4z" fill={inCart ? "currentColor" : "none"} />
          <circle cx="6.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="11.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {/* Like button */}
      <button
        onClick={handleLike}
        aria-label={!isLoggedIn ? "Sign in to save item" : liked ? "Unlike item" : "Like item"}
        className={`absolute top-3 right-3 z-20 w-9 h-9 md:w-7 md:h-7 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-full transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 opacity-100`}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-white">
          <path
            d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            fill={liked ? "currentColor" : "none"}
          />
        </svg>
      </button>

      {/* Info — glass bottom (glows on hover of the whole card) */}
      <Link href={linkHref} className="glass-btn glass-card-foot block px-5 pt-4 pb-5">
        {showBrand && (
          <h3 className="text-[15px] font-semibold text-[var(--foreground)] truncate leading-snug">
            {product.brand}
          </h3>
        )}
        <p className="text-[13px] text-[var(--foreground-muted)] truncate mt-0.5 leading-snug">
          {displayName}
        </p>
        <div className="flex items-baseline gap-1.5 mt-2">
          <p className="text-[14px] font-medium text-[var(--foreground)]">
            {displayPriceMin === displayPriceMax
              ? formatPrice(displayPriceMin, product.currency)
              : `${formatPrice(displayPriceMin, product.currency)}–${formatPrice(displayPriceMax, product.currency)}`}
          </p>
          {colorCount > 1 && (
            <>
              <span className="text-[var(--foreground-subtle)] text-[12px] leading-none">·</span>
              <span className="text-[12px] text-[var(--foreground-subtle)]">
                {colorCount} colors
              </span>
            </>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

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
    return <ProductImage src={src} alt={alt} fill className="object-contain" sizes={sizes} />;
  }

  // cropData zooms into a fraction of the image (e.g. width=0.3 → 3.3× zoom).
  // Scale the sizes hint so Next.js fetches a high-enough resolution image
  // instead of upscaling a small one, which causes pixelation.
  const scale = Math.max(1 / cropData.width, 1 / cropData.height);
  const scaledSizes = sizes
    ? sizes.replace(/(\d+)vw/g, (_, n) => `${Math.min(Math.round(Number(n) * scale), 100)}vw`)
    : "100vw";

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
      <ProductImage
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes={scaledSizes}
        style={{ objectPosition: `${cropData.focalX * 100}% ${cropData.focalY * 100}%` }}
      />
    </div>
  );
}
