"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "@/components/ui/Image";
import type { ColorGroup, Outfit, Product, ProductSwatch } from "@/lib/types";
import { primaryColorGroup } from "@/lib/color-groups";
import { useCurrency } from "@/lib/context/currency-context";
import { useLikes } from "@/lib/context/likes-context";
import { useAuth } from "@/lib/context/auth-context";
import { useCart } from "@/lib/context/cart-context";
import { toCartItem } from "@/lib/cart-item";
import ProductCard from "./ProductCard";
import OutfitCard from "@/components/outfit/OutfitCard";
import dynamic from "next/dynamic";

// Reads localStorage and fetches its own products, so it can only run client-side.
const RecentlyViewed = dynamic(() => import("./RecentlyViewed"), { ssr: false });
import { track } from "@/lib/analytics/track";
import { recordView } from "@/lib/recently-viewed";
import { buildStylingNotes } from "@/lib/seo";
import { ClampedHeading, ClampedDescription } from "@/components/ui/ClampedText";
import Breadcrumbs, { type Crumb } from "@/components/ui/Breadcrumbs";
import { groupForProduct, resolveSubcategory } from "@/lib/categories";
import { photoBackdrop } from "@/lib/image";
import { useCategoryTree } from "@/lib/hooks/useCategoryTree";

interface Props {
  product: Product;
  relatedProducts: Product[];
  outfitsWithProduct: Outfit[];
  lowestPrice: number;
  /** The currency `lowestPrice` is in — the cheapest store's own, not the product's. */
  lowestPriceCurrency?: string;
  /** Lower-cased store name → logo URL, from the admin store library. */
  retailerLogos?: Record<string, string>;
  /** The catalog's colour filters, used to name the colour breadcrumb. */
  colorGroups?: ColorGroup[];
}

export default function ProductClient({ product, relatedProducts, outfitsWithProduct, lowestPrice, lowestPriceCurrency, retailerLogos = {}, colorGroups = [] }: Props) {
  // Auto-select the first color that has dedicated images, so the gallery is
  // populated on first render without requiring the user to click a swatch.
  const { formatPrice } = useCurrency();
  const { isProductLiked, toggleProductLike } = useLikes();
  const categoryGroups = useCategoryTree();
  const { isLoggedIn, login } = useAuth();
  const liked = isProductLiked(product.id);

  const handleLike = () => {
    if (!isLoggedIn) { login(); return; }
    toggleProductLike(product.id);
  };

  // Phones put a piece in the bag from here, the way the card's cart button did
  // before the card lost it: the same item, and a second press takes it out.
  const { addToCart, isInCart, removeFromCart } = useCart();
  const inBag = isInCart(product.id);
  const toggleBag = () => (inBag ? removeFromCart(product.id) : addToCart(toCartItem(product)));
  const storeCount = product.retailers.length;
  const defaultColor = useMemo(() => {
    if (!product.colorImages) return null;
    return product.colors.find((c) => (product.colorImages![c]?.length ?? 0) > 0) ?? null;
  }, [product]);

  const [selectedColor, setSelectedColor] = useState<string | null>(defaultColor);
  const [activeIdx, setActiveIdx] = useState(0);
  const [imgVisible, setImgVisible] = useState(true);
  // Phones swipe through the photos; this is the one in view.
  const [slide, setSlide] = useState(0);
  const slidesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    track("product_view", { targetId: product.id });
    recordView("product", product.id);
  }, [product.id]);

  // Resolve which images to display
  const displayImages = useMemo(() => {
    if (selectedColor && product.colorImages?.[selectedColor]?.length) {
      return product.colorImages[selectedColor];
    }
    const imgs = (product.images ?? []).filter(Boolean);
    return imgs.length ? imgs : [product.imageUrl].filter(Boolean);
  }, [selectedColor, product]);

  // Fade-transition to a given index
  const goTo = (newIdx: number) => {
    setImgVisible(false);
    setTimeout(() => {
      setActiveIdx(newIdx);
      setImgVisible(true);
    }, 260);
  };

  // Reset to first image (with fade) when color changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImgVisible(false);
    slidesRef.current?.scrollTo({ left: 0 });
    const t = setTimeout(() => { setActiveIdx(0); setSlide(0); setImgVisible(true); }, 260);
    return () => clearTimeout(t);
  }, [selectedColor]);

  const mainImage = displayImages[activeIdx] || product.imageUrl || "";

  // Keep the selected thumbnail inside the rail's viewport. Without this the
  // rail scrolls but the highlight can sit outside it — picking the eleventh
  // photo would leave the ring somewhere the shopper cannot see.
  //
  // `nearest` on both axes is what stops this from yanking the page around: an
  // element already visible is left alone, so only the rail moves.
  const thumbsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = thumbsRef.current?.children[activeIdx];
    active?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeIdx]);

  // Home / Browse / Pieces / Category / Subcategory / Gender / Colour / Brand /
  // Name. Every step links back into the catalog with that filter applied; the
  // optional ones are dropped when the product doesn't carry them.
  const productCrumbs: Crumb[] = useMemo(() => {
    const group = groupForProduct(product.category, product.subcategory, categoryGroups);
    const subcategory = resolveSubcategory(product.category, product.subcategory, categoryGroups);
    // The colour *filter*, not the retailer's colour name. Two reasons: the name
    // is whatever the shop typed — "25 Years/Black/Silver" is one real example,
    // which is unreadable in a trail — and the crumb has to lead somewhere.
    // Browse resolves `?color=` against the filter's name, so a retailer string
    // could never match one and the link silently did nothing.
    const colour = primaryColorGroup(product.colorGroupIds, colorGroups);
    const q = (params: Record<string, string>) =>
      `/browse?${new URLSearchParams({ view: "pieces", ...params })}`;

    const items: Crumb[] = [
      { label: "Home", href: "/" },
      { label: "Browse", href: "/browse" },
      { label: "Pieces", href: q({}) },
    ];
    if (group) items.push({ label: group.label, href: q({ category: group.id }) });
    if (subcategory) items.push({ label: subcategory, href: q({ subcat: subcategory }) });
    if (product.gender) items.push({ label: product.gender, href: q({ gender: product.gender }) });
    // No colour filter set, or only ids of groups since deleted: the crumb is
    // dropped rather than filled with something that leads nowhere.
    if (colour) items.push({ label: colour.name, href: q({ color: colour.name }) });
    if (product.brand) items.push({ label: product.brand, href: q({ brand: product.brand }) });
    items.push({ label: product.name });
    return items;
  }, [product, categoryGroups, colorGroups]);

  // Unique, data-derived styling copy so the page isn't a thin duplicate of the
  // source catalog feed.
  const styling = useMemo(() => buildStylingNotes(product), [product]);

  return (
    <>
      {/* Phones go back with the header's back button; the trail is desktop's. */}
      <div className="hidden md:block">
        <Breadcrumbs items={productCrumbs} />
      </div>

      {/* Main grid */}
      <div className="mt-3 md:mt-12 grid grid-cols-1 md:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] gap-4 md:gap-10">

        {/* ── Left: Image gallery. Phones get the thumbnails as a row under the
            photo, so the photo keeps the full width; from md up they become the
            rail beside it, top-left. ── */}
        <div className="flex flex-col md:flex-row gap-3">

          {/* Phones: the photos swipe inside one rounded card, with a counter in
              place of the thumbnail rail; only light controls sit on the photo
              (DESIGN_SYSTEM.md §12.6, mockup v1 «Б · Товар»). */}
          <div className="md:hidden relative rounded-3xl overflow-hidden bg-white" style={photoBackdrop(product.bgColor)}>
            <div
              ref={slidesRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const i = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
                if (i !== slide) setSlide(i);
              }}
              className="flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain no-scrollbar"
            >
              {(displayImages.length ? displayImages : [""]).map((img, i) => (
                <div key={`${img}-${i}`} className="relative w-full shrink-0 snap-center aspect-[3/4]">
                  {img && (
                    <Image
                      src={img}
                      alt={i === 0 ? `${product.name} by ${product.brand}` : `${product.name} ${i + 1}`}
                      fill
                      priority={i === 0}
                      sizes="(max-width: 768px) 100vw, 480px"
                      className="object-contain"
                    />
                  )}
                </div>
              ))}
            </div>
            {product.isNew && (
              <span className="absolute top-3.5 left-3.5 rounded-full bg-white/80 px-[9px] py-1 text-[11px] font-semibold text-black">New</span>
            )}
            <button
              onClick={handleLike}
              aria-label={!isLoggedIn ? "Sign in to save item" : liked ? "Unlike item" : "Like item"}
              className="absolute top-1 right-1 w-12 h-12 flex items-center justify-center"
            >
              <span className="w-[34px] h-[34px] rounded-full bg-white/80 flex items-center justify-center text-black">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                    fill={liked ? "currentColor" : "none"}
                  />
                </svg>
              </span>
            </button>
            {displayImages.length > 1 && (
              <span className="absolute bottom-3 right-3 rounded-full bg-white/80 px-[9px] py-1 text-[11px] font-medium text-black tabular-nums">
                {slide + 1} / {displayImages.length}
              </span>
            )}
          </div>

          {/* Thumbnails — only when there are multiple images.
              A piece can carry a dozen photos, and the rail used to grow to fit
              every one of them: on desktop it ran past the bottom of the photo
              and stretched the whole row, taking the info panel with it; on
              phones it wrapped onto line after line. So the rail scrolls
              instead of growing — down the side on desktop, along the bottom on
              phones.

              The outer div is the trick. It contributes WIDTH to the flex row
              and no height, because its only child is absolutely positioned
              from `md` up. The row's height is therefore set by the photo
              alone, and the stretched wrapper inherits exactly that — so the
              rail is always the photo's height, whatever it works out to at
              this breakpoint, with no measuring and no magic number.

              There is no "more than N photos" threshold either: `auto` overflow
              already means "scroll only when it doesn't fit". */}
          {displayImages.length > 1 && (
            <div className="hidden md:block md:order-1 shrink-0 md:relative md:w-16 lg:w-20">
            <div
              ref={thumbsRef}
              className="flex gap-2 overflow-x-auto no-scrollbar md:absolute md:inset-0 md:flex-col md:overflow-x-hidden md:overflow-y-auto"
            >
              {displayImages.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  onClick={() => goTo(i)}
                  className={`relative w-16 h-16 lg:w-20 lg:h-20 shrink-0 rounded-lg overflow-hidden bg-white transition-opacity duration-150 ${
                    i === activeIdx ? "opacity-100 ring-2 ring-[var(--foreground)] rounded-lg" : "opacity-50 hover:opacity-80"
                  }`}
                  style={photoBackdrop(product.bgColor)}
                >
                  <Image src={img} alt={`${product.name} ${i + 1}`} fill sizes="80px" className="object-contain" />
                </button>
              ))}
            </div>
            </div>
          )}

          {/* Main image. Kept at 3:4 rather than stretched to the info panel's
              full height — product shots are portrait and use object-contain, so
              a full-height box would be mostly empty white. */}
          <div
            className="hidden md:block md:order-2 flex-1 min-w-0 md:self-start rounded-2xl overflow-hidden border border-[var(--border)] bg-white"
            style={photoBackdrop(product.bgColor)}
          >
            <div
              className="relative aspect-[3/4] overflow-hidden bg-white"
              style={photoBackdrop(product.bgColor)}
            >
              {mainImage ? (
                <Image
                  src={mainImage}
                  alt={`${product.name} by ${product.brand}`}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 480px"
                  className="object-contain transition-opacity duration-[260ms] ease-in-out"
                  style={{ opacity: imgVisible ? 1 : 0 }}
                />
              ) : (
                <div className="w-full h-full bg-white" />
              )}
              {product.isNew && (
                <div className="absolute top-4 left-4">
                  <span className="text-[9px] tracking-[0.16em] uppercase font-medium bg-[var(--bg-overlay-90)] backdrop-blur-sm text-[var(--foreground)] rounded-full px-3 py-1.5 block">
                    New
                  </span>
                </div>
              )}

              {/* Like button */}
              <button
                onClick={handleLike}
                aria-label={!isLoggedIn ? "Sign in to save item" : liked ? "Unlike item" : "Like item"}
                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-full"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="text-white">
                  <path
                    d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    fill={liked ? "currentColor" : "none"}
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Product info ── */}
        <div className="md:rounded-2xl md:border md:border-[var(--border)] md:bg-[var(--background)] px-1 md:px-10 pb-8 md:py-12 flex flex-col">

          {/* Brand + Name */}
          <div className="mb-6">
            <p className="text-[13px] md:text-[10px] md:tracking-[0.2em] md:uppercase font-semibold md:font-medium text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] mb-0.5 md:mb-2">
              {product.brand}
            </p>
            {/* Any `tracking-` class turns off the size-based tracking rule in
                globals.css, so desktop's −0.015em is spelled out here. */}
            <ClampedHeading
              text={product.name}
              label="product name"
              className="text-[22px] md:text-4xl font-semibold md:font-bold tracking-[-0.01em] md:tracking-[-0.015em] text-[var(--foreground)] leading-tight"
            />

            {/* Phones: the colours right under the name (mockup v1 «Б · Товар»). */}
            {product.variants && product.variants.length > 1 ? (
              <div className="md:hidden mt-3 -ml-2 flex flex-wrap items-center">
                {product.variants.map((swatch: ProductSwatch) => {
                  const isCurrent = swatch.id === product.id;
                  return (
                    <Link
                      key={swatch.id}
                      href={`/product/${swatch.id}`}
                      aria-label={`View in ${swatch.colorName}`}
                      aria-current={isCurrent ? "page" : undefined}
                      className="w-11 h-11 flex items-center justify-center"
                    >
                      <span
                        className="w-7 h-7 rounded-full"
                        style={{
                          backgroundColor: swatch.colorHex,
                          boxShadow: isCurrent
                            ? "0 0 0 2px var(--background), 0 0 0 3.5px var(--foreground)"
                            : "0 0 0 1px var(--border)",
                        }}
                      />
                    </Link>
                  );
                })}
                <span className="ml-1.5 text-[14px] text-[var(--foreground-muted)]">
                  {product.variants.find((v: ProductSwatch) => v.id === product.id)?.colorName ?? product.colors?.[0]}
                </span>
              </div>
            ) : product.colors.length > 0 && (
              <div className="md:hidden mt-3.5 flex flex-wrap gap-2" role="group" aria-label="Colours">
                {product.colors.map((color) => {
                  const on = selectedColor === color;
                  const hasImages = !!(product.colorImages?.[color]?.length);
                  return (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      aria-pressed={on}
                      className={`relative h-9 px-3.5 rounded-full text-[13px] transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] ${
                        on ? "bg-[var(--foreground)] text-[var(--background)] font-semibold" : "bg-[var(--fg-overlay-08)] text-[var(--foreground)]"
                      }`}
                    >
                      {color}
                      {hasImages && !on && <span aria-hidden="true" className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--foreground)]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Price — phones read it in the buy bar */}
          <div className="hidden md:block mb-8 pb-8 border-b border-[var(--border)]">
            <p className="text-2xl font-bold text-[var(--foreground)]">
              From {formatPrice(lowestPrice, lowestPriceCurrency ?? product.currency)}
            </p>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Price varies by retailer · All prices include tax
            </p>
          </div>

          {/* Description — first line readable, the rest behind a blur veil */}
          {product.description && (
            <div className="mb-8">
              <ClampedDescription text={product.description} />
            </div>
          )}

          {/* Material */}
          {product.material && (
            <div className="mb-8 pb-8 border-b border-[var(--border)]">
              <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
                Material
              </p>
              <p className="text-sm text-[var(--foreground-muted)]">{product.material}</p>
            </div>
          )}

          {/* Variant color swatches — navigate to sibling product pages */}
          {product.variants && product.variants.length > 1 && (
            <div className="hidden md:block mb-6">
              <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-3">
                Color
                <span className="ml-2 normal-case text-[var(--foreground)]">
                  — {product.variants.find((v: ProductSwatch) => v.id === product.id)?.colorName ?? product.colors?.[0]}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((swatch: ProductSwatch) => {
                  const isCurrent = swatch.id === product.id;
                  return (
                    <Link
                      key={swatch.id}
                      href={`/product/${swatch.id}`}
                      title={swatch.colorName}
                      aria-label={`View in ${swatch.colorName}`}
                      className={`w-7 h-7 rounded-full transition-transform duration-150 shrink-0 inline-block ${isCurrent ? "scale-110" : "hover:scale-105"}`}
                      style={{
                        backgroundColor: swatch.colorHex,
                        boxShadow: isCurrent
                          ? "0 0 0 2px #fff, 0 0 0 4px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.08)"
                          : "0 0 0 1.5px #fff, 0 0 0 3px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(0,0,0,0.08)",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Colors — only shown when there are no variant swatches */}
          {product.colors.length > 0 && !(product.variants && product.variants.length > 1) && (
            <div className="hidden md:block mb-8">
              <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-3">
                Available in
                {selectedColor && (
                  <span className="ml-2 normal-case text-[var(--foreground)]">— {selectedColor}</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => {
                  const hasImages = !!(product.colorImages?.[color]?.length);
                  return (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`relative rounded-full px-4 py-1.5 text-xs border transition-colors duration-200 ${
                        selectedColor === color
                          ? "border-[var(--foreground)] text-[var(--foreground)]"
                          : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {color}
                      {hasImages && (
                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[var(--foreground)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sizes */}
          {product.sizes.length > 0 && (
            <div className="mb-10 pb-8 border-b border-[var(--border)]">
              <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-3">
                Sizes
              </p>
              {/* Informational only: nothing on the site picks a size, so these
                  are plain chips, not buttons that do nothing when pressed. */}
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <span
                    key={size}
                    className="px-4 py-2 rounded-full border border-[var(--border-strong)] text-[11px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)]"
                  >
                    {size}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Where to buy — the phone buy bar scrolls here */}
          {product.retailers.length > 0 && (
            <div id="where-to-buy" className="scroll-mt-20">
              <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]">
                  Where to buy
                </h2>
                <span className="shrink-0 text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] border border-[var(--border)] rounded-full px-2.5 py-1">
                  {product.retailers.length} stores
                </span>
              </div>

              <div className="space-y-2">
                {[...product.retailers]
                  .sort((a, b) => a.price - b.price)
                  .map((retailer, i) => {
                    let domain = "";
                    try { domain = new URL(retailer.url).hostname.replace("www.", ""); } catch {}
                    // Prefer the store logo from the admin library (matched by
                    // name); fall back to the site favicon, then to initials.
                    const libraryLogo = retailerLogos[retailer.name.trim().toLowerCase()] ?? null;
                    return (
                    <a
                      key={retailer.name}
                      href={retailer.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 border border-[var(--border)] rounded-xl hover:border-[var(--border-strong)] hover:bg-[var(--surface)] transition-colors duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Retailer logo */}
                        <div className="w-10 h-10 shrink-0 rounded-full bg-white border border-[var(--border)] flex items-center justify-center overflow-hidden">
                          {libraryLogo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={libraryLogo}
                              alt={retailer.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-contain p-1.5"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                (e.currentTarget.nextSibling as HTMLElement | null)?.style && ((e.currentTarget.nextSibling as HTMLElement).style.display = "flex");
                              }}
                            />
                          ) : domain ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                              alt={retailer.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                                (e.currentTarget.nextSibling as HTMLElement | null)?.style && ((e.currentTarget.nextSibling as HTMLElement).style.display = "flex");
                              }}
                            />
                          ) : null}
                          <span
                            className="text-[11px] font-bold text-[var(--foreground-muted)] hidden items-center justify-center w-full h-full"
                            style={{ display: "none" }}
                          >
                            {retailer.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-[var(--foreground)] truncate">{retailer.name}</p>
                            {i === 0 && (
                              <span className="shrink-0 text-[8px] tracking-[0.14em] uppercase font-medium text-[var(--foreground)] bg-[var(--fg-overlay-08)] rounded-full px-2 py-0.5">
                                Best
                              </span>
                            )}
                          </div>
                          {retailer.isOfficial && (
                            <p className="text-[11px] text-[var(--foreground-subtle)] mt-0.5">
                              Official Store
                            </p>
                          )}
                          {retailer.rating != null && (
                            <div className="flex items-center gap-1 mt-1.5">
                              {[1,2,3,4,5].map((s) => (
                                <svg key={s} width="9" height="9" viewBox="0 0 12 12" fill={s <= Math.round(retailer.rating!) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" className="text-[var(--foreground-muted)]">
                                  <polygon points="6,1 7.5,4.5 11,4.8 8.5,7 9.3,10.5 6,8.7 2.7,10.5 3.5,7 1,4.8 4.5,4.5" />
                                </svg>
                              ))}
                              {retailer.reviewCount != null && (
                                <span className="text-[10px] text-[var(--foreground-subtle)] ml-1">{retailer.reviewCount.toLocaleString()}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Divider between the store block and the buy block */}
                      <div className="hidden sm:block self-stretch w-px bg-[var(--border)] shrink-0" />

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] tracking-[0.12em] uppercase ${
                              retailer.availability === "sold out"
                                ? "text-[var(--foreground-subtle)] line-through"
                                : "text-[var(--foreground-muted)]"
                            }`}>
                              {retailer.availability}
                            </span>
                            <span className={`w-1 h-1 rounded-full shrink-0 ${
                              retailer.availability === "in stock"
                                ? "bg-green-500"
                                : retailer.availability === "low stock"
                                ? "bg-amber-500"
                                : "bg-[var(--foreground-subtle)]"
                            }`} />
                          </div>
                          <p className="text-base font-medium text-[var(--foreground)] mt-0.5">
                            {formatPrice(retailer.price, retailer.currency)}
                          </p>
                        </div>

                        {/* Outlined CTA — reads as a button without competing with the page */}
                        <span className="shrink-0 flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] text-[var(--foreground-muted)] text-xs px-3.5 py-2 group-hover:border-[var(--foreground)] group-hover:text-[var(--foreground)] transition-colors duration-200">
                          View on Store
                          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
                            <path d="M4 10L10 4M10 4H5M10 4V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </div>
                    </a>
                  );
                  })}
              </div>
              <p className="text-[10px] text-[var(--foreground-subtle)] mt-4">
                Prices updated regularly. GOO is not responsible for pricing changes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* How to wear it — unique on-page styling copy */}
      <section className="mt-16 md:mt-20">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 md:px-10 py-8 md:py-10">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            How to wear it
          </p>
          <p className="text-sm md:text-base text-[var(--foreground-muted)] leading-relaxed max-w-2xl">
            {styling.text}
          </p>
          {styling.pairWith.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mr-1">
                Pairs with
              </span>
              {styling.pairWith.map((cat) => (
                <Link
                  key={cat}
                  href={`/browse?category=${cat}`}
                  className="text-[11px] capitalize border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground-muted)] rounded-full px-3 py-1.5 transition-colors duration-200"
                >
                  {cat}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Outfits featuring this item */}
      {outfitsWithProduct.length > 0 && (
        <section className="mt-20 md:mt-28 mb-4">
          <div className="mb-8">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
              Style it with
            </p>
            <h2 className="text-2xl md:text-3xl font-bold uppercase text-[var(--foreground)]">
              Outfits with this piece
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {outfitsWithProduct.slice(0, 4).map((outfit) => (
              <div key={outfit.id} className="rounded-xl bg-[var(--background)] hover:shadow-md transition-colors duration-200">
                <OutfitCard outfit={outfit} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-20 md:mt-28 mb-4">
          <div className="mb-8">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
              More {product.category}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold uppercase text-[var(--foreground)]">
              You may also like
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {relatedProducts.map((related) => (
              <div key={related.id} className="rounded-xl bg-[var(--background)] hover:shadow-md transition-colors duration-200">
                <ProductCard product={related} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently viewed — last, and only if this browser has a history */}
      <RecentlyViewed kind="product" currentId={product.id} />

      {/* Phones: the buy bar stands where the tab bar would (DESIGN_SYSTEM.md §12.8). */}
      <div className="md:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+6px)] z-40 h-16 rounded-3xl border border-[var(--border)] bg-[var(--surface-overlay-92)] backdrop-blur-md flex items-center gap-2 pl-[18px] pr-2.5">
        <div className="flex-1 min-w-0">
          <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
            From {formatPrice(lowestPrice, lowestPriceCurrency ?? product.currency)}
          </p>
          {storeCount > 0 && (
            <p className="text-[12px] text-[var(--foreground-muted)]">{storeCount} {storeCount === 1 ? "store" : "stores"}</p>
          )}
        </div>
        <button
          onClick={toggleBag}
          aria-label={inBag ? "Remove from bag" : "Add to bag"}
          className="shrink-0 w-11 h-11 rounded-full bg-[var(--fg-overlay-08)] text-[var(--foreground)] flex items-center justify-center"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8h12l-1 12H7L6 8Z" />
            <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
            {inBag ? <path d="M9.5 14l2 2 3.5-3.5" /> : <path d="M12 11v5M9.5 13.5h5" />}
          </svg>
        </button>
        {storeCount > 0 && (
          <a
            href="#where-to-buy"
            onClick={(e) => { e.preventDefault(); document.getElementById("where-to-buy")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            className="shrink-0 h-11 px-5 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[15px] font-semibold flex items-center"
          >
            Where to buy
          </a>
        )}
      </div>
    </>
  );
}
