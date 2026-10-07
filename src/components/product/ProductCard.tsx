"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import ProductImage from "./ProductImage";
import { motion } from "framer-motion";
import { Product, ProductSwatch, CropData } from "@/lib/types";
import { photoBackdrop } from "@/lib/image";
import { useLikes } from "@/lib/context/likes-context";
import { useAuth } from "@/lib/context/auth-context";
import { useCurrency } from "@/lib/context/currency-context";
import { useCart } from "@/lib/context/cart-context";
import { toCartItem } from "@/lib/cart-item";
import { displayedProduct } from "@/lib/variant-display";
import { useHoverImageCycle, ImageCycleDots, CYCLE_SLIDE_MS } from "@/lib/hooks/useHoverImageCycle";

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
    if (!isLoggedIn) { login(); return; }
    toggleProductLike(product.id);
  };

  // The colour this card stands for. Nothing on the card switches it, so it is
  // simply the one the grid asked for.
  const activeVariant = initialVariant;

  const currentId = activeVariant ? activeVariant.id : product.id;
  const inCart = isInCart(currentId);

  const handleAddToCart = () => {
    if (inCart) {
      removeFromCart(currentId);
    } else {
      addToCart(
        toCartItem(product, {
          id: currentId,
          name: activeVariant ? activeVariant.name : product.name,
          imageUrl: activeVariant ? activeVariant.imageUrl : product.imageUrl,
          price: activeVariant ? activeVariant.priceMin : product.priceMin,
        }),
      );
    }
  };

  // What this card shows once a colour has been chosen: the variant is its own
  // product row, so its name, price and photos all come with it.
  const shown = useMemo(() => displayedProduct(product, { variant: activeVariant }), [product, activeVariant]);

  const displayName     = shown.name;
  const displayPriceMin = shown.priceMin;
  const displayPriceMax = shown.priceMax;
  const linkHref        = `/product/${activeVariant ? activeVariant.id : product.id}`;

  const allImages = shown.images;

  const [isHovered, setIsHovered] = useState(false);
  const activeIdx = useHoverImageCycle(allImages.length, isHovered, activeVariant?.id ?? product.id);

  const swatches  = product.variants;
  const hasSwatches = !!swatches?.length;

  const colorCount = hasSwatches
    ? 1 + (swatches?.filter(s => s.id !== product.id).length ?? 0)
    : 0;

  return (
    <motion.div
      className="group relative flex flex-col overflow-hidden rounded-2xl md:rounded-xl bg-[var(--surface)] md:border md:border-[var(--border)] max-md:h-full"
      initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ type: 'spring', bounce: 0.2, duration: 0.8 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={linkHref} className="block">
        {/* Image. The box is padded with the photo's own backdrop where one was
            measured — a colour variant carries its own, since it is a separate
            product row that may have been shot on a different wall. Unmeasured
            photos keep `bg-white`. */}
        <div
          className="relative bg-white overflow-hidden aspect-[3/4]"
          style={photoBackdrop(shown.bgColor)}
        >
          <div
            className="absolute inset-0 flex"
            style={{
              width: `${allImages.length * 100}%`,
              transform: `translateX(-${(activeIdx * 100) / allImages.length}%)`,
              transition: `transform ${CYCLE_SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1)`,
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

          {/* The pips follow a hover cycle, which a phone never starts. */}
          <div className="hidden md:contents">
            <ImageCycleDots count={allImages.length} activeIdx={activeIdx} />
          </div>

          {/* Below md the badge is a light pill, like every control on the
              photo (DESIGN_SYSTEM.md §12.6). */}
          {product.isNew && (
            <div className="absolute top-2.5 left-2.5 md:top-3 md:left-3 z-10">
              <span className="block rounded-full md:rounded-sm bg-white/80 text-black md:bg-[var(--foreground)] md:text-[var(--background)] text-[10px] md:text-[9px] font-semibold md:font-bold md:tracking-[0.18em] md:uppercase px-2 py-[3px] md:px-2.5 md:py-1">
                New
              </span>
            </div>
          )}

          {/* Desktop hover strip. Phones show the store count beside the price. */}
          {product.retailers.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 hidden md:block md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-10">
              <div className="bg-[var(--bg-overlay-95)] backdrop-blur-sm px-3 py-2 rounded-b-xl">
                <p className="text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-muted)]">
                  {product.retailers.length} stores
                </p>
              </div>
            </div>
          )}
        </div>
      </Link>

      {/* Cart button — desktop only: on a phone a piece goes into the bag from
          its own page (DESIGN_SYSTEM.md §12.5). */}
      <button
        onClick={handleAddToCart}
        aria-label={inCart ? "Remove from bag" : "Add to bag"}
        className={`absolute ${product.isNew ? "top-11" : "top-3"} left-3 z-20 hidden md:flex md:w-7 md:h-7 items-center justify-center bg-black/80 backdrop-blur-sm rounded-full transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100`}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-white">
          <path d="M1 1h2l1.5 7.5" />
          <path d="M4.5 8.5h8l1.5-5.5H4z" fill={inCart ? "currentColor" : "none"} />
          <circle cx="6.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="11.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {/* Like button. Below md: a 44px target around a small light circle
          (DESIGN_SYSTEM.md §12.6); the circle's box dissolves on desktop. */}
      <button
        onClick={handleLike}
        aria-label={!isLoggedIn ? "Sign in to save item" : liked ? "Unlike item" : "Like item"}
        className={`absolute top-0.5 right-0.5 md:top-3 md:right-3 z-20 w-11 h-11 md:w-7 md:h-7 flex items-center justify-center md:bg-black/80 md:backdrop-blur-sm md:rounded-full transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100`}
      >
        <span className="w-7 h-7 rounded-full bg-white/80 flex items-center justify-center md:contents">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="md:hidden text-black" aria-hidden="true">
            <path
              d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
              fill={liked ? "currentColor" : "none"}
            />
          </svg>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="hidden md:block text-white">
            <path
              d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
              stroke="currentColor"
              strokeWidth="1.3"
              fill={liked ? "currentColor" : "none"}
            />
          </svg>
        </span>
      </button>

      {/* Info */}
      <Link href={linkHref} className="block px-3 pt-2.5 pb-3 md:px-5 md:pt-4 md:pb-5">
        {showBrand && (
          <h3 className="text-[13px] md:text-[15px] font-semibold text-[var(--foreground)] truncate leading-snug">
            {product.brand}
          </h3>
        )}
        <p className="text-[12.5px] md:text-[13px] text-[var(--foreground-muted)] truncate md:mt-0.5 leading-snug">
          {displayName}
        </p>
        <div className="flex max-md:flex-wrap items-baseline justify-between md:justify-start gap-1.5 max-md:gap-y-0.5 mt-1.5 md:mt-2">
          <p className="text-[13px] md:text-[14px] font-medium text-[var(--foreground)] max-md:min-w-0 max-md:truncate">
            {displayPriceMin === displayPriceMax
              ? formatPrice(displayPriceMin, product.currency)
              : `${formatPrice(displayPriceMin, product.currency)}–${formatPrice(displayPriceMax, product.currency)}`}
          </p>
          {/* Phones: the store count in place of the hover strip, dropping under a long
              price rather than cutting it; colours wait for the product page. */}
          {product.retailers.length > 1 && (
            <span className="md:hidden shrink-0 text-[11px] text-[var(--foreground-muted)]">
              {product.retailers.length} stores
            </span>
          )}
          {colorCount > 1 && (
            <>
              <span className="hidden md:inline text-[var(--foreground-subtle)] text-[12px] leading-none">·</span>
              <span className="hidden md:inline text-[12px] text-[var(--foreground-subtle)]">
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
