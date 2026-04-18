"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Product, ProductSwatch, StyleKeyword, Brand } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";
import { useCart } from "@/lib/context/cart-context";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";

// ── Slot definitions ─────────────────────────────────────────────────────────

type SlotId = "outerwear" | "top" | "bottom" | "shoes" | "accessories";

const SLOTS = [
  { id: "outerwear"   as SlotId, label: "Outerwear",   categories: ["outerwear"] },
  { id: "top"         as SlotId, label: "Top",         categories: ["tops", "knitwear"] },
  { id: "bottom"      as SlotId, label: "Bottom",      categories: ["bottoms", "dresses"] },
  { id: "shoes"       as SlotId, label: "Shoes",       categories: ["footwear"] },
  { id: "accessories" as SlotId, label: "Acc",         categories: ["accessories"] },
];

// Vertical figure zones for the silhouette canvas (accessories float separately)
const FIGURE_SLOTS: Array<{ id: SlotId; label: string; flex: number }> = [
  { id: "outerwear", label: "Outerwear", flex: 7   },
  { id: "top",       label: "Top",       flex: 4.5 },
  { id: "bottom",    label: "Bottom",    flex: 5   },
  { id: "shoes",     label: "Shoes",     flex: 2.5 },
];

// Category filter chips for the right-panel catalog
const CATALOG_CHIPS: Array<{ label: string; slotId: SlotId | null }> = [
  { label: "All",          slotId: null          },
  { label: "Outerwear",    slotId: "outerwear"   },
  { label: "Tops",         slotId: "top"         },
  { label: "Bottoms",      slotId: "bottom"      },
  { label: "Shoes",        slotId: "shoes"       },
  { label: "Accessories",  slotId: "accessories" },
];

// Price filter buckets (null max = no cap)
const PRICE_BUCKETS: Array<{ label: string; max: number | null }> = [
  { label: "All",    max: null },
  { label: "< $200", max: 200  },
  { label: "< $500", max: 500  },
  { label: "< $1k",  max: 1000 },
  { label: "< $2k",  max: 2000 },
];

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function SlotIcon({ id, size = 15 }: { id: SlotId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      {id === "outerwear" && (
        <path d="M5 2L2 5V7.5L4 6.5V14H12V6.5L14 7.5V5L11 2C11 2 10.2 3.5 8 3.5C5.8 3.5 5 2 5 2ZM6 2.5V7M10 2.5V7"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {id === "top" && (
        <path d="M6 2L2 5V7L4 6V14H12V6L14 7V5L10 2C10 2 9.5 4 8 4C6.5 4 6 2 6 2Z"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      )}
      {id === "bottom" && (
        <path d="M4 2H12L13 8H9L8 14H8L7 8H3L4 2Z"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      )}
      {id === "shoes" && (<>
        <path d="M2 11.5C2 11.5 4 10 7 10C9 10 10 11 11 11H13.5C13.5 11 14 11 14 12V13H2V11.5Z"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M7 10V7.5C7 7.5 7.5 5 10 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </>)}
      {id === "accessories" && (<>
        <rect x="3" y="6" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <path d="M6 6V4.5C6 3.7 6.7 3 7.5 3H8.5C9.3 3 10 3.7 10 4.5V6" stroke="currentColor" strokeWidth="1.1" />
      </>)}
    </svg>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  // ── State ────────────────────────────────────────────────────────────────
  const [activeSlot, setActiveSlot] = useState<SlotId>("top");
  const [selection, setSelection] = useState<Partial<Record<SlotId, Product>>>({});
  const [variantOverrides, setVariantOverrides] = useState<Partial<Record<SlotId, string>>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState<SlotId | null>(null);
  const [likedOnly, setLikedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>([]);
  const [sortBy, setSortBy] = useState<"featured" | "price-asc" | "price-desc">("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const [shopAdded, setShopAdded] = useState(false);

  const { likedProducts } = useLikes();
  const { addManyToCart } = useCart();

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedModel, setGeneratedModel] = useState<string>("ai");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/products")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProducts(d); })
      .catch(() => {});
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  const styleKeywords = useMemo<StyleKeyword[]>(() =>
    Array.from(new Set(
      Object.values(selection).filter(Boolean).flatMap(p => p!.styleKeywords)
    )) as StyleKeyword[],
  [selection]);

  const totalPrice = useMemo(() =>
    Object.values(selection).reduce((sum, p) => sum + (p?.priceMin ?? 0), 0),
  [selection]);

  const selectedCount = Object.values(selection).filter(Boolean).length;

  const uniqueBrandCount = useMemo(() =>
    new Set(Object.values(selection).filter(Boolean).map(p => p!.brand)).size,
  [selection]);

  const [lookNumber] = useState(() => String(Math.floor(Math.random() * 999) + 1).padStart(3, "0"));

  // ── URL persistence ───────────────────────────────────────────────────────
  const updateURL = useCallback((sel: Partial<Record<SlotId, Product>>, variants?: Partial<Record<SlotId, string>>) => {
    const url = new URL(window.location.href);
    SLOTS.forEach(({ id }) => {
      if (sel[id]) {
        url.searchParams.set(id, sel[id]!.id);
        const vid = variants?.[id];
        if (vid) url.searchParams.set(`${id}_variant`, vid);
        else url.searchParams.delete(`${id}_variant`);
      } else {
        url.searchParams.delete(id);
        url.searchParams.delete(`${id}_variant`);
      }
    });
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Restore selection from URL when products are available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restored: Partial<Record<SlotId, Product>> = {};
    const restoredVariants: Partial<Record<SlotId, string>> = {};
    let found = false;
    for (const { id } of SLOTS) {
      const pid = params.get(id);
      if (pid) {
        const p = products.find(x => x.id === pid);
        if (p) {
          restored[id] = p;
          found = true;
          const vid = params.get(`${id}_variant`);
          if (vid) restoredVariants[id] = vid;
        }
      }
    }
    if (found) {
      setSelection(restored);
      if (Object.keys(restoredVariants).length > 0) setVariantOverrides(restoredVariants);
    }
  }, [products]);

  // ── Filtered product list for the right-panel catalog ────────────────────

  // Brands available in the current category filter (for the brand multi-select)
  const availableBrands = useMemo(() => {
    const base = catalogCategory
      ? products.filter(p => {
          const slot = SLOTS.find(s => s.id === catalogCategory)!;
          return slot.categories.includes(p.category);
        })
      : products;
    return Array.from(new Set(base.map(p => p.brand))).sort() as Brand[];
  }, [catalogCategory, products]);

  const catalogProducts = useMemo(() => {
    let list = catalogCategory
      ? products.filter(p => {
          const slot = SLOTS.find(s => s.id === catalogCategory)!;
          return slot.categories.includes(p.category);
        })
      : products;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    }

    if (likedOnly) {
      list = list.filter(p => likedProducts.includes(p.id));
    }

    if (maxPrice !== null) {
      list = list.filter(p => p.priceMin <= maxPrice);
    }

    if (selectedBrands.length > 0) {
      list = list.filter(p => selectedBrands.includes(p.brand as Brand));
    }

    if (sortBy === "price-asc") {
      list = [...list].sort((a, b) => a.priceMin - b.priceMin);
    } else if (sortBy === "price-desc") {
      list = [...list].sort((a, b) => b.priceMin - a.priceMin);
    }

    return list;
  }, [catalogCategory, products, search, likedOnly, likedProducts, maxPrice, selectedBrands, sortBy]);

  const hasActiveFilters = maxPrice !== null || selectedBrands.length > 0 || sortBy !== "featured";

  // ── Actions ───────────────────────────────────────────────────────────────

  // Auto-routes product into the correct slot based on its category.
  // Replaces any existing selection in that slot (toggle off if already selected).
  const selectProduct = (product: Product) => {
    const targetSlot = SLOTS.find(s => s.categories.includes(product.category));
    if (!targetSlot) return;
    const slotId = targetSlot.id;

    setSelection(prev => {
      const next = { ...prev };
      if (next[slotId]?.id === product.id) {
        delete next[slotId];
        setVariantOverrides(vo => { const n = { ...vo }; delete n[slotId]; return n; });
      } else {
        next[slotId] = product;
        setVariantOverrides(vo => { const n = { ...vo }; delete n[slotId]; return n; });
      }
      updateURL(next);
      return next;
    });
    setSaved(false);
    setActiveSlot(slotId);
  };

  const selectVariant = (slotId: SlotId, swatch: ProductSwatch) => {
    setVariantOverrides(prev => {
      const next = { ...prev, [slotId]: swatch.id };
      updateURL(selection, next);
      return next;
    });
    setSaved(false);
  };

  const clearSlot = (slotId: SlotId, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelection(prev => {
      const next = { ...prev };
      delete next[slotId];
      updateURL(next);
      return next;
    });
    setVariantOverrides(prev => { const n = { ...prev }; delete n[slotId]; return n; });
  };

  const clearAll = () => {
    setSelection({});
    setVariantOverrides({});
    updateURL({});
    setSaved(false);
  };

  const clearFilters = () => {
    setMaxPrice(null);
    setSelectedBrands([]);
    setSortBy("featured");
  };

  const shopTheLook = () => {
    const pieces = Object.values(selection).filter(Boolean) as Product[];
    if (pieces.length === 0) return;
    addManyToCart(pieces.map(p => {
      const officialRetailer = p.retailers.find(r => r.isOfficial) ?? p.retailers[0] ?? null;
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        imageUrl: p.imageUrl,
        price: p.priceMin,
        retailerUrl: officialRetailer?.url ?? null,
      };
    }));
    setShopAdded(true);
    setTimeout(() => setShopAdded(false), 2000);
  };

  const shareOutfit = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const saveOutfit = () => {
    const editId = new URLSearchParams(window.location.search).get("editId");
    const pieces = Object.entries(selection).map(([slot, p]) => {
      const variantId = variantOverrides[slot as SlotId];
      const activeVariant = variantId ? p!.variants?.find(v => v.id === variantId) : null;
      const imageUrl = activeVariant?.imageUrl ?? p!.imageUrl;
      return { slot, productId: p!.id, variantId: variantId ?? null, imageUrl, name: p!.name };
    });
    try {
      const existing: Record<string, unknown>[] = JSON.parse(localStorage.getItem("goo-saved-outfits") || "[]");
      let updated;
      if (editId && existing.some((o) => o.id === editId)) {
        updated = existing.map((o) =>
          o.id === editId ? { ...o, pieces, totalPrice, styleKeywords } : o
        );
      } else {
        const outfit = { id: `outfit-${Date.now()}`, savedAt: new Date().toISOString(), pieces, totalPrice, styleKeywords };
        updated = [outfit, ...existing].slice(0, 50);
      }
      localStorage.setItem("goo-saved-outfits", JSON.stringify(updated));
    } catch {}
    setSaved(true);
  };

  // ── DALL-E / GPT-Image generation ─────────────────────────────────────────
  const generateOutfit = async () => {
    setGenerating(true);
    setGenerateError(null);
    setGeneratedImage(null);

    const pieces = Object.entries(selection)
      .filter(([, p]) => p != null)
      .map(([slot, p]) => ({
        slot,
        name: p!.name,
        brand: p!.brand,
        category: p!.category,
        material: p!.material,
        colors: p!.colors,
        styleKeywords: p!.styleKeywords,
        imageUrl: p!.imageUrl,
      }));

    try {
      const userKey = localStorage.getItem("goo-openai-key") ?? "";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (userKey) headers["x-openai-key"] = userKey;

      const res = await fetch("/api/generate-outfit", {
        method: "POST",
        headers,
        body: JSON.stringify({ pieces }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGenerateError(json.error ?? "Generation failed. Try again.");
      } else {
        setGeneratedImage(json.imageUrl);
        setGeneratedModel(json.model ?? "ai");
        setShowModal(true);
      }
    } catch {
      setGenerateError("Network error. Check your connection.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen pt-16 flex flex-col overflow-hidden">

      {/* ─────────────────────────────────────────────────────────────────────
          BUILDER CONTEXT BAR — utility only, no site nav duplication.
          Context label left · Share / Clear actions right (conditional).
          Site nav above handles all primary navigation.
      ───────────────────────────────────────────────────────────────────────── */}
      <header className="h-10 shrink-0 border-b border-[var(--border)] bg-[var(--background)] flex items-center justify-between px-5 md:px-7">

        {/* Left: context label */}
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">
          Create
        </p>

        {/* Right: utility actions — only visible when something is selected */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-4">
            <button
              onClick={shareOutfit}
              className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              {copied ? "Copied!" : "Share"}
            </button>
            <button
              onClick={clearAll}
              className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────────────
          3-COLUMN BODY
          relative wrapper bounds the AI drawer overlay
      ───────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div className="hidden md:grid md:h-full md:grid-cols-[300px_1fr_360px]">

          {/* ── LEFT PANEL: In this look ───────────────────────────────────
              Shows the current selection grouped by slot.
              Full slot-row rebuild deferred to next step.
          ─────────────────────────────────────────────────────────────────── */}
          <aside className="hidden md:flex flex-col border-r border-[var(--border)] bg-[var(--background)] min-h-0 overflow-hidden">

            {/* Panel header */}
            <div className="px-6 pt-5 pb-3 shrink-0">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-1">
                In this look
              </p>
              <p className="font-display text-[22px] font-light text-[var(--foreground)]">
                {selectedCount > 0
                  ? `${selectedCount} piece${selectedCount !== 1 ? "s" : ""}`
                  : "Empty"}
              </p>
            </div>

            {/* Slot rows */}
            <div className="flex-1 overflow-y-auto border-t border-[var(--border)]">
              {SLOTS.map(slot => {
                const picked = selection[slot.id];
                const variantId = variantOverrides[slot.id];
                const activeVariant = picked?.variants?.find(v => v.id === variantId);
                const displayImage = activeVariant?.imageUrl ?? picked?.imageUrl;

                return (
                  <button
                    key={slot.id}
                    onClick={() => { setActiveSlot(slot.id); setCatalogCategory(slot.id); }}
                    className={`w-full grid grid-cols-[60px_1fr_auto] gap-3 px-5 py-3 items-center border-b border-[var(--border)] min-h-[80px] text-left transition-colors duration-150 hover:bg-[var(--surface)] ${
                      activeSlot === slot.id ? "bg-[var(--surface)]" : ""
                    }`}
                  >
                    {/* Thumbnail / slot icon */}
                    <div className="w-[60px] h-[74px] bg-[var(--surface)] shrink-0 overflow-hidden flex items-center justify-center">
                      {displayImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={displayImage}
                          alt={picked!.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-[var(--foreground-subtle)] opacity-50">
                          <SlotIcon id={slot.id} size={18} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0">
                      <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-0.5">
                        {slot.label}
                      </p>
                      {picked ? (
                        <>
                          <p className="text-[12px] leading-snug text-[var(--foreground)] truncate">{picked.name}</p>
                          <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5 truncate">{picked.brand}</p>
                        </>
                      ) : (
                        <p className="text-[11px] text-[var(--foreground-subtle)]">—</p>
                      )}
                    </div>

                    {/* Price */}
                    <div className="shrink-0 text-right">
                      {picked && (
                        <p className="text-[11px] text-[var(--foreground)]">
                          ${picked.priceMin.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Total price footer */}
            <div className={`border-t px-5 py-4 shrink-0 flex items-baseline justify-between transition-colors ${
              selectedCount > 0 ? "border-[var(--border-strong)]" : "border-[var(--border)]"
            }`}>
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">
                Total
              </p>
              <p className={`font-display font-light transition-all ${
                selectedCount > 0
                  ? "text-[22px] text-[var(--foreground)]"
                  : "text-[18px] text-[var(--foreground-subtle)]"
              }`}>
                {selectedCount > 0 ? `$${totalPrice.toLocaleString()}` : "—"}
              </p>
            </div>
          </aside>

          {/* ── CENTER PANEL: Outfit canvas — RUNWAY silhouette ───────────────
              Vertical fashion-plate: Outerwear → Top → Bottom → Shoes stacked,
              Accessories as a small floating panel to the right.
              Empty zones: diagonal stripe + dashed border + icon + label.
              Filled zones: product image + hover overlay (dim, info, swatches).
          ─────────────────────────────────────────────────────────────────── */}
          <main className="flex flex-col min-h-0 overflow-hidden bg-[var(--surface)]">

            {/* Canvas top bar */}
            <div className="h-9 shrink-0 flex items-center px-5 border-b border-[var(--border)]">
              <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)]">
                {selectedCount > 0 ? `Look ${lookNumber}` : "Look —"}
              </p>
            </div>

            {/* Silhouette zone — centered fashion plate */}
            <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center py-8 px-6">
              {/* Container: 240px main figure + 20px gap + 60px accessories = 320px */}
              <div className="relative h-full max-h-[460px]" style={{ width: 320 }}>

                {/* Main stacked figure: outerwear → top → bottom → shoes */}
                <div className="absolute inset-y-0 left-0 flex flex-col" style={{ width: 240 }}>
                  {FIGURE_SLOTS.map(({ id, label, flex }) => {
                    const picked = selection[id];
                    const variantId = variantOverrides[id];
                    const activeVariant = picked?.variants?.find(v => v.id === variantId);
                    const displayImage = activeVariant?.imageUrl ?? picked?.imageUrl;
                    const isActive = activeSlot === id;

                    return (
                      <button
                        key={id}
                        onClick={() => { setActiveSlot(id); setCatalogCategory(id); }}
                        style={{ flex }}
                        className={`group relative w-full overflow-hidden transition-all duration-200 border-b border-[var(--border)] last:border-b-0 ${
                          isActive ? "ring-1 ring-inset ring-[var(--foreground)] z-10" : ""
                        }`}
                      >
                        {/* Empty: diagonal stripe */}
                        {!picked && (
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, var(--fg-overlay-05) 4px, var(--fg-overlay-05) 5px)",
                            }}
                          />
                        )}
                        {/* Empty: dashed border */}
                        {!picked && (
                          <div className="absolute inset-0 border border-dashed border-[var(--border)]" />
                        )}

                        {/* Filled: product image */}
                        {displayImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={displayImage}
                            alt={picked!.name}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        )}
                        {/* Filled: hover dim */}
                        {picked && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-200" />
                        )}

                        {/* Empty: icon + label */}
                        {!picked && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
                            <div className="text-[var(--foreground-subtle)] opacity-30">
                              <SlotIcon id={id} size={14} />
                            </div>
                            <p className="font-mono text-[8px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] opacity-40">
                              {label}
                            </p>
                          </div>
                        )}

                        {/* Filled: slot label badge top-left */}
                        {picked && (
                          <div className="absolute top-2 left-2 pointer-events-none">
                            <span className="font-mono text-[7px] tracking-[0.12em] uppercase font-medium bg-[var(--background)]/80 backdrop-blur-sm text-[var(--foreground)] px-1.5 py-0.5">
                              {label}
                            </span>
                          </div>
                        )}

                        {/* Filled: variant swatches top-right on hover */}
                        {picked && (picked.variants?.length ?? 0) > 1 && (
                          <div
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 pointer-events-none group-hover:pointer-events-auto"
                            onClick={e => e.stopPropagation()}
                          >
                            {picked.variants!.slice(0, 5).map(swatch => {
                              const isSwatchActive = (variantId ?? picked.id) === swatch.id;
                              return (
                                <button
                                  key={swatch.id}
                                  title={swatch.colorName}
                                  onClick={e => { e.stopPropagation(); selectVariant(id, swatch); }}
                                  className={`w-3 h-3 rounded-full shrink-0 transition-all duration-150 ${
                                    isSwatchActive
                                      ? "ring-1 ring-offset-1 ring-[var(--background)] scale-110"
                                      : "opacity-70 hover:opacity-100"
                                  }`}
                                  style={{
                                    background: swatch.colorHex === "#multicolor"
                                      ? "conic-gradient(red, orange, yellow, green, blue, violet, red)"
                                      : swatch.colorHex,
                                    boxShadow: "inset 0 0 0 1px rgba(128,128,128,0.4)",
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* Filled: info strip bottom on hover */}
                        {picked && (
                          <div className="absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 translate-y-px group-hover:translate-y-0 transition-all duration-200 px-2 pb-2">
                            <div className="bg-[var(--background)]/90 backdrop-blur-sm px-2.5 py-1.5 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-mono text-[8px] tracking-[0.08em] uppercase text-[var(--foreground-subtle)] truncate leading-none mb-0.5">
                                  {picked.brand}
                                </p>
                                <div className="flex items-center gap-2">
                                  <p className="text-[10px] text-[var(--foreground)] truncate leading-tight">
                                    {picked.name}
                                  </p>
                                  <Link
                                    href={`/product/${picked.id}`}
                                    onClick={e => e.stopPropagation()}
                                    className="font-mono text-[8px] tracking-[0.08em] uppercase text-[var(--foreground-muted)] shrink-0 hover:text-[var(--foreground)] transition-colors"
                                  >
                                    ↗
                                  </Link>
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-2">
                                <span className="font-mono text-[10px] text-[var(--foreground)]">
                                  ${picked.priceMin.toLocaleString()}
                                </span>
                                <button
                                  onClick={e => clearSlot(id, e)}
                                  className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors text-base leading-none"
                                  aria-label={`Remove ${label}`}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Accessories: small floating panel — right column, vertically centered */}
                {(() => {
                  const id: SlotId = "accessories";
                  const picked = selection[id];
                  const variantId = variantOverrides[id];
                  const activeVariant = picked?.variants?.find(v => v.id === variantId);
                  const displayImage = activeVariant?.imageUrl ?? picked?.imageUrl;
                  const isActive = activeSlot === id;
                  return (
                    <button
                      onClick={() => { setActiveSlot(id); setCatalogCategory(id); }}
                      className={`group absolute right-0 overflow-hidden transition-all duration-200 ${
                        isActive ? "ring-1 ring-[var(--foreground)]" : ""
                      }`}
                      style={{ top: "50%", transform: "translateY(-50%)", width: 60, height: 74 }}
                    >
                      {/* Empty: stripe + dashed border */}
                      {!picked && (
                        <>
                          <div
                            className="absolute inset-0"
                            style={{
                              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, var(--fg-overlay-05) 4px, var(--fg-overlay-05) 5px)",
                            }}
                          />
                          <div className="absolute inset-0 border border-dashed border-[var(--border)]" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
                            <div className="text-[var(--foreground-subtle)] opacity-30">
                              <SlotIcon id={id} size={10} />
                            </div>
                            <p className="font-mono text-[7px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] opacity-40">
                              Acc
                            </p>
                          </div>
                        </>
                      )}

                      {/* Filled: product image */}
                      {displayImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={displayImage} alt={picked!.name} className="absolute inset-0 w-full h-full object-cover" />
                      )}
                      {/* Filled: hover dim + remove */}
                      {picked && (
                        <>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200" />
                          <button
                            onClick={e => clearSlot(id, e)}
                            className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--background)]/85 text-[var(--foreground)] text-xs font-medium"
                            aria-label="Remove accessory"
                          >
                            ×
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 pb-1 pointer-events-none">
                            <p className="font-mono text-[7px] tracking-[0.08em] uppercase text-center text-white opacity-0 group-hover:opacity-70 transition-opacity">
                              Acc
                            </p>
                          </div>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Canvas bottom bar */}
            <div className="h-8 shrink-0 flex items-center justify-center border-t border-[var(--border)]">
              <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
                Edit · Drag to reorder
              </p>
            </div>

          </main>

          {/* ── RIGHT PANEL: Category catalog — RUNWAY design ──────────────
              Search → category chips → 2-column product grid.
              Products auto-route to the correct slot via category mapping.
              Clicking a canvas zone syncs the chip filter to that category.
          ─────────────────────────────────────────────────────────────────── */}
          <aside className="hidden md:flex flex-col border-l border-[var(--border)] bg-[var(--background)] min-h-0 overflow-hidden">

            {/* Panel header: catalog label + stylist trigger */}
            <div className="px-3 pt-2.5 pb-2 shrink-0 flex items-center justify-between border-b border-[var(--border)]">
              <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">
                Catalog
              </p>
              <button
                onClick={() => setAiOpen(v => !v)}
                className={`flex items-center gap-1.5 font-mono text-[9px] tracking-[0.12em] uppercase transition-colors duration-150 ${
                  aiOpen
                    ? "text-[var(--foreground)]"
                    : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  aiOpen ? "bg-[var(--foreground)]" : "bg-[var(--foreground-subtle)] animate-pulse"
                }`} />
                Stylist
              </button>
            </div>

            {/* Search input */}
            <div className="px-3 pt-3 pb-2.5 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="w-full h-[38px] bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--border-strong)] outline-none pl-9 pr-8 text-[12px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] pointer-events-none">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </span>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Category chips */}
            <div className="px-3 pb-2.5 shrink-0 flex gap-1.5 overflow-x-auto">
              {CATALOG_CHIPS.map(({ label, slotId }) => {
                const isActive = catalogCategory === slotId;
                return (
                  <button
                    key={label}
                    onClick={() => setCatalogCategory(slotId)}
                    className={`shrink-0 px-3 py-1 rounded-full font-mono text-[9px] tracking-[0.1em] uppercase font-medium border transition-all duration-150 ${
                      isActive
                        ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                        : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Filter toggle row */}
            <div className="px-3 pb-1.5 shrink-0 flex items-center justify-between">
              <button
                onClick={() => setFiltersOpen(v => !v)}
                className={`flex items-center gap-1.5 font-mono text-[9px] tracking-[0.1em] uppercase transition-colors ${
                  hasActiveFilters || filtersOpen ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                }`}
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                  <line x1="1" y1="3.5" x2="13" y2="3.5" />
                  <line x1="3" y1="7" x2="11" y2="7" />
                  <line x1="5" y1="10.5" x2="9" y2="10.5" />
                </svg>
                Filters{hasActiveFilters ? ` · ${(maxPrice !== null ? 1 : 0) + selectedBrands.length + (sortBy !== "featured" ? 1 : 0)}` : ""}
              </button>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="font-mono text-[9px] tracking-[0.08em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setSortBy(s => s === "featured" ? "price-asc" : s === "price-asc" ? "price-desc" : "featured")}
                  className={`font-mono text-[9px] tracking-[0.08em] uppercase transition-colors ${
                    sortBy !== "featured" ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {sortBy === "price-asc" ? "Price ↑" : sortBy === "price-desc" ? "Price ↓" : "Sort"}
                </button>
              </div>
            </div>

            {/* Expandable filter panel */}
            {filtersOpen && (
              <div className="px-3 pb-2.5 shrink-0 border-b border-[var(--border)] space-y-2.5">
                {/* Price buckets */}
                <div>
                  <p className="font-mono text-[8px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1.5">Price</p>
                  <div className="flex flex-wrap gap-1">
                    {PRICE_BUCKETS.map(({ label, max }) => (
                      <button
                        key={label}
                        onClick={() => setMaxPrice(maxPrice === max ? null : max)}
                        className={`px-2.5 py-0.5 font-mono text-[9px] tracking-[0.06em] border transition-all duration-150 ${
                          maxPrice === max
                            ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                            : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Brand multi-select */}
                {availableBrands.length > 0 && (
                  <div>
                    <p className="font-mono text-[8px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1.5">Brand</p>
                    <div className="flex flex-wrap gap-1 max-h-[72px] overflow-y-auto">
                      {availableBrands.map(brand => {
                        const isActive = selectedBrands.includes(brand);
                        return (
                          <button
                            key={brand}
                            onClick={() => setSelectedBrands(prev =>
                              isActive ? prev.filter(b => b !== brand) : [...prev, brand]
                            )}
                            className={`px-2.5 py-0.5 font-mono text-[9px] tracking-[0.06em] border transition-all duration-150 ${
                              isActive
                                ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                                : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            {brand}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Count + liked toggle */}
            <div className="px-3 pb-2.5 shrink-0 flex items-center justify-between border-b border-[var(--border)]">
              <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)]">
                {catalogProducts.length} {catalogProducts.length === 1 ? "item" : "items"}
              </p>
              <button
                onClick={() => setLikedOnly(v => !v)}
                className={`flex items-center gap-1.5 font-mono text-[9px] tracking-[0.1em] uppercase transition-colors ${
                  likedOnly ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                }`}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill={likedOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.57 3.07 2 5 2C6.19 2 7.24 2.61 8 3.5C8.76 2.61 9.81 2 11 2C12.93 2 14.5 3.57 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z" />
                </svg>
                Liked
              </button>
            </div>

            {/* 2-column product grid */}
            <div className="flex-1 overflow-y-auto">
              {catalogProducts.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
                    {likedOnly ? "No liked items" : search ? "No results" : "No products"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3">
                  {catalogProducts.map(product => {
                    const targetSlot = SLOTS.find(s => s.categories.includes(product.category));
                    const isSelected = targetSlot ? selection[targetSlot.id]?.id === product.id : false;
                    const variantId = targetSlot ? variantOverrides[targetSlot.id] : undefined;
                    const activeVariant = product.variants?.find(v => v.id === variantId);
                    const displayImage = (isSelected && activeVariant?.imageUrl) ? activeVariant.imageUrl : product.imageUrl;

                    return (
                      <button
                        key={product.id}
                        onClick={() => selectProduct(product)}
                        className={`group relative flex flex-col text-left transition-all duration-150 ${
                          isSelected ? "outline outline-1 outline-[var(--foreground)]" : ""
                        }`}
                      >
                        {/* Image — 3/4 aspect ratio */}
                        <div className="relative w-full aspect-[3/4] overflow-hidden bg-[var(--surface)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={displayImage}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          {/* Dim overlay on hover */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                          {/* Selected checkmark badge */}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                <path d="M1 3.5L3.5 6L8 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {/* Product info */}
                        <div className="pt-1.5 pb-1 px-0.5">
                          <p className="text-[11px] font-medium text-[var(--foreground)] leading-snug truncate">
                            {product.name}
                          </p>
                          <div className="flex items-center justify-between mt-0.5 gap-1">
                            <p className="text-[10px] text-[var(--foreground-muted)] truncate">
                              {product.brand}
                            </p>
                            <p className="font-mono text-[10px] text-[var(--foreground)] shrink-0">
                              ${product.priceMin.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* ── MOBILE LAYOUT ─────────────────────────────────────────────────
            Visible below md breakpoint only. Stacked single-column layout:
            mini-canvas → slot strip → search+chips → product grid → bottom bar.
        ───────────────────────────────────────────────────────────────────── */}
        <div className="md:hidden h-full flex flex-col overflow-hidden">

          {/* 1. Mini silhouette canvas */}
          <div className="h-[220px] shrink-0 bg-[var(--surface)] border-b border-[var(--border)] relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-full" style={{ width: 180 }}>

                {/* Main stacked figure */}
                <div className="absolute inset-y-0 left-0 flex flex-col" style={{ width: 140 }}>
                  {FIGURE_SLOTS.map(({ id, label, flex }) => {
                    const picked = selection[id];
                    const variantId = variantOverrides[id];
                    const activeVariant = picked?.variants?.find(v => v.id === variantId);
                    const displayImage = activeVariant?.imageUrl ?? picked?.imageUrl;
                    return (
                      <button
                        key={id}
                        onClick={() => { setActiveSlot(id); setCatalogCategory(id); }}
                        style={{ flex }}
                        className={`relative overflow-hidden border-b border-[var(--border)] last:border-b-0 transition-all ${
                          activeSlot === id ? "ring-1 ring-inset ring-[var(--foreground)] z-10" : ""
                        }`}
                      >
                        {!picked && (
                          <>
                            <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, var(--fg-overlay-05) 4px, var(--fg-overlay-05) 5px)" }} />
                            <div className="absolute inset-0 border border-dashed border-[var(--border)]" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
                              <div className="text-[var(--foreground-subtle)] opacity-30"><SlotIcon id={id} size={11} /></div>
                              <p className="font-mono text-[7px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] opacity-40">{label}</p>
                            </div>
                          </>
                        )}
                        {displayImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={displayImage} alt={picked!.name} className="absolute inset-0 w-full h-full object-cover" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Accessories — floating mini panel */}
                {(() => {
                  const id: SlotId = "accessories";
                  const picked = selection[id];
                  const displayImage = picked?.imageUrl;
                  return (
                    <button
                      onClick={() => { setActiveSlot(id); setCatalogCategory(id); }}
                      className={`absolute right-0 overflow-hidden border transition-all ${
                        activeSlot === id ? "border-[var(--foreground)] ring-1 ring-[var(--foreground)]" : "border-[var(--border)]"
                      }`}
                      style={{ top: "50%", transform: "translateY(-50%)", width: 36, height: 44 }}
                    >
                      {!picked && (
                        <>
                          <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, var(--fg-overlay-05) 4px, var(--fg-overlay-05) 5px)" }} />
                          <div className="absolute inset-0 border border-dashed border-[var(--border)]" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-[var(--foreground-subtle)] opacity-30"><SlotIcon id={id} size={9} /></div>
                          </div>
                        </>
                      )}
                      {displayImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={displayImage} alt={picked!.name} className="absolute inset-0 w-full h-full object-cover" />
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Canvas label overlay */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 h-8 pointer-events-none">
              <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
                {selectedCount > 0 ? `Look ${lookNumber}` : "Look —"}
              </p>
              {selectedCount > 0 && (
                <button
                  onClick={clearAll}
                  className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors pointer-events-auto"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* 2. Slot strip — horizontal scrollable thumbnails */}
          <div
            className="shrink-0 flex gap-2 px-3 py-2.5 border-b border-[var(--border)] overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {SLOTS.map(slot => {
              const picked = selection[slot.id];
              const variantId = variantOverrides[slot.id];
              const activeVariant = picked?.variants?.find(v => v.id === variantId);
              const displayImage = activeVariant?.imageUrl ?? picked?.imageUrl;
              const isActive = activeSlot === slot.id;
              return (
                <div
                  key={slot.id}
                  className={`shrink-0 flex flex-col items-center gap-1 transition-opacity ${isActive ? "opacity-100" : "opacity-60"}`}
                >
                  {/* Thumbnail tap area */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { setActiveSlot(slot.id); setCatalogCategory(slot.id); }}
                    onKeyDown={e => e.key === "Enter" && (setActiveSlot(slot.id), setCatalogCategory(slot.id))}
                    className={`relative overflow-hidden bg-[var(--surface)] transition-all cursor-pointer ${
                      isActive ? "ring-1 ring-[var(--foreground)]" : "border border-[var(--border)]"
                    }`}
                    style={{ width: 52, height: 64 }}
                  >
                    {displayImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={displayImage} alt={picked!.name} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <>
                        <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, var(--fg-overlay-05) 4px, var(--fg-overlay-05) 5px)" }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-[var(--foreground-subtle)] opacity-35"><SlotIcon id={slot.id} size={11} /></div>
                        </div>
                      </>
                    )}
                    {picked && (
                      <button
                        onClick={e => clearSlot(slot.id, e)}
                        className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center bg-[var(--background)]/85 text-[var(--foreground)] text-xs leading-none font-medium"
                        aria-label={`Remove ${slot.label}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <p className="font-mono text-[8px] tracking-[0.08em] uppercase text-[var(--foreground-subtle)]">
                    {slot.label.length > 5 ? slot.label.slice(0, 3) : slot.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* 3. Search */}
          <div className="px-3 pt-2.5 pb-1.5 shrink-0">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products…"
                className="w-full h-[38px] bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--border-strong)] outline-none pl-9 pr-8 text-[12px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] pointer-events-none">
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </span>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* 4. Category chips */}
          <div className="px-3 pb-2 shrink-0 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {CATALOG_CHIPS.map(({ label, slotId }) => {
              const isActive = catalogCategory === slotId;
              return (
                <button
                  key={label}
                  onClick={() => setCatalogCategory(slotId)}
                  className={`shrink-0 px-3 py-1 rounded-full font-mono text-[9px] tracking-[0.1em] uppercase font-medium border transition-all duration-150 ${
                    isActive
                      ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                      : "border-[var(--border-strong)] text-[var(--foreground-muted)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 4b. Mobile filter toggle row */}
          <div className="px-3 pb-1.5 shrink-0 flex items-center justify-between">
            <button
              onClick={() => setFiltersOpen(v => !v)}
              className={`flex items-center gap-1.5 font-mono text-[9px] tracking-[0.1em] uppercase transition-colors ${
                hasActiveFilters || filtersOpen ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <line x1="1" y1="3.5" x2="13" y2="3.5" />
                <line x1="3" y1="7" x2="11" y2="7" />
                <line x1="5" y1="10.5" x2="9" y2="10.5" />
              </svg>
              Filters{hasActiveFilters ? ` · ${(maxPrice !== null ? 1 : 0) + selectedBrands.length + (sortBy !== "featured" ? 1 : 0)}` : ""}
            </button>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="font-mono text-[9px] tracking-[0.08em] uppercase text-[var(--foreground-subtle)] transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setSortBy(s => s === "featured" ? "price-asc" : s === "price-asc" ? "price-desc" : "featured")}
                className={`font-mono text-[9px] tracking-[0.08em] uppercase transition-colors ${
                  sortBy !== "featured" ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"
                }`}
              >
                {sortBy === "price-asc" ? "Price ↑" : sortBy === "price-desc" ? "Price ↓" : "Sort"}
              </button>
            </div>
          </div>

          {/* 4c. Mobile expandable filter panel */}
          {filtersOpen && (
            <div className="px-3 pb-2 shrink-0 border-b border-[var(--border)] space-y-2.5">
              <div>
                <p className="font-mono text-[8px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1.5">Price</p>
                <div className="flex flex-wrap gap-1">
                  {PRICE_BUCKETS.map(({ label, max }) => (
                    <button
                      key={label}
                      onClick={() => setMaxPrice(maxPrice === max ? null : max)}
                      className={`px-2.5 py-0.5 font-mono text-[9px] tracking-[0.06em] border transition-all duration-150 ${
                        maxPrice === max
                          ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                          : "border-[var(--border-strong)] text-[var(--foreground-muted)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {availableBrands.length > 0 && (
                <div>
                  <p className="font-mono text-[8px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1.5">Brand</p>
                  <div className="flex flex-wrap gap-1 max-h-[64px] overflow-y-auto">
                    {availableBrands.map(brand => {
                      const isActive = selectedBrands.includes(brand);
                      return (
                        <button
                          key={brand}
                          onClick={() => setSelectedBrands(prev =>
                            isActive ? prev.filter(b => b !== brand) : [...prev, brand]
                          )}
                          className={`px-2.5 py-0.5 font-mono text-[9px] tracking-[0.06em] border transition-all duration-150 ${
                            isActive
                              ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                              : "border-[var(--border-strong)] text-[var(--foreground-muted)]"
                          }`}
                        >
                          {brand}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Count + liked toggle */}
          <div className="px-3 pb-2 shrink-0 flex items-center justify-between border-b border-[var(--border)]">
            <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)]">
              {catalogProducts.length} {catalogProducts.length === 1 ? "item" : "items"}
            </p>
            <button
              onClick={() => setLikedOnly(v => !v)}
              className={`flex items-center gap-1.5 font-mono text-[9px] tracking-[0.1em] uppercase transition-colors ${
                likedOnly ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill={likedOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.57 3.07 2 5 2C6.19 2 7.24 2.61 8 3.5C8.76 2.61 9.81 2 11 2C12.93 2 14.5 3.57 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z" />
              </svg>
              Liked
            </button>
          </div>

          {/* 6. Product grid — scrollable */}
          <div className="flex-1 overflow-y-auto">
            {catalogProducts.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
                  {likedOnly ? "No liked items" : search ? "No results" : "No products"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-3">
                {catalogProducts.map(product => {
                  const targetSlot = SLOTS.find(s => s.categories.includes(product.category));
                  const isSelected = targetSlot ? selection[targetSlot.id]?.id === product.id : false;
                  const variantId = targetSlot ? variantOverrides[targetSlot.id] : undefined;
                  const activeVariant = product.variants?.find(v => v.id === variantId);
                  const displayImage = (isSelected && activeVariant?.imageUrl) ? activeVariant.imageUrl : product.imageUrl;
                  return (
                    <button
                      key={product.id}
                      onClick={() => selectProduct(product)}
                      className={`group relative flex flex-col text-left transition-all duration-150 ${
                        isSelected ? "outline outline-1 outline-[var(--foreground)]" : ""
                      }`}
                    >
                      <div className="relative w-full aspect-[3/4] overflow-hidden bg-[var(--surface)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={displayImage}
                          alt={product.name}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                              <path d="M1 3.5L3.5 6L8 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="pt-1.5 pb-1 px-0.5">
                        <p className="text-[11px] font-medium text-[var(--foreground)] leading-snug truncate">{product.name}</p>
                        <div className="flex items-center justify-between mt-0.5 gap-1">
                          <p className="text-[10px] text-[var(--foreground-muted)] truncate">{product.brand}</p>
                          <p className="font-mono text-[10px] text-[var(--foreground)] shrink-0">${product.priceMin.toLocaleString()}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 7. Mobile bottom bar */}
          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--background)] px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[8px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">Total</p>
              <p className={`font-display font-light leading-none mt-0.5 transition-all ${
                selectedCount > 0 ? "text-[20px] text-[var(--foreground)]" : "text-[16px] text-[var(--foreground-subtle)]"
              }`}>
                {selectedCount > 0 ? `$${totalPrice.toLocaleString()}` : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Stylist — icon button */}
              <button
                onClick={() => setAiOpen(v => !v)}
                className={`w-9 h-9 border flex items-center justify-center transition-all duration-150 shrink-0 ${
                  aiOpen
                    ? "border-[var(--foreground)] text-[var(--foreground)] bg-[var(--surface)]"
                    : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                }`}
                aria-label="Open AI Stylist"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 2h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5l-3 2V3a1 1 0 0 1 1-1z" />
                </svg>
              </button>
              {/* Generate — icon-only on mobile, visible with ≥1 piece */}
              {selectedCount >= 1 && (
                <button
                  onClick={generateOutfit}
                  disabled={generating}
                  className="w-9 h-9 border border-[var(--border-strong)] flex items-center justify-center text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  aria-label="Generate outfit image"
                >
                  {generating ? (
                    <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1L7.2 4.8H11L8 7.2L9.1 11L6 8.8L2.9 11L4 7.2L1 4.8H4.8L6 1Z"
                        stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )}
              <button
                onClick={saveOutfit}
                disabled={selectedCount === 0}
                className={`font-mono text-[9px] tracking-[0.14em] uppercase px-3 h-9 border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
                  saved
                    ? "border-[var(--border)] text-[var(--foreground-muted)]"
                    : "border-[var(--border-strong)] text-[var(--foreground-muted)]"
                }`}
              >
                {saved ? "Saved ✓" : "Save"}
              </button>
              <button
                onClick={shopTheLook}
                disabled={selectedCount === 0}
                className={`h-9 px-4 font-mono text-[9px] tracking-[0.16em] uppercase transition-all duration-150 disabled:cursor-not-allowed ${
                  selectedCount > 0
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "bg-[var(--border)] text-[var(--foreground-subtle)]"
                }`}
              >
                {shopAdded
                  ? "Added ✓"
                  : selectedCount > 0
                  ? `Shop · $${totalPrice.toLocaleString()}`
                  : "Shop the Look"}
              </button>
            </div>
          </div>
        </div>

        {/* ── AI Stylist Drawer ──────────────────────────────────────────────
            Extracted to StylistDrawer component.
            Position: absolute within the body wrapper (does not overlay site nav).
            Full-width on mobile, 380px on desktop.
        ───────────────────────────────────────────────────────────────────── */}
        <StylistDrawer
          isOpen={aiOpen}
          onClose={() => setAiOpen(false)}
          surface="builder"
          products={products}
          selection={selection}
          onSelectProduct={selectProduct}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────────────
          BUILDER FOOTER — RUNWAY design
          Left: piece/brand count  ·  Right: Generate · Save · Shop the Look CTA
      ───────────────────────────────────────────────────────────────────────── */}
      <footer className="h-[52px] shrink-0 border-t border-[var(--border)] bg-[var(--background)] hidden md:flex items-center justify-between px-5 md:px-7">

        {/* Left: contextual count */}
        <p className="font-mono text-[11px] text-[var(--foreground-muted)]">
          {selectedCount > 0
            ? `${selectedCount} piece${selectedCount !== 1 ? "s" : ""} · ${uniqueBrandCount} brand${uniqueBrandCount !== 1 ? "s" : ""}`
            : "Add pieces to build your look"}
        </p>

        {/* Right: actions */}
        <div className="flex items-center gap-2.5">

          {/* Generate — shown with ≥1 piece selected */}
          {selectedCount >= 1 && (
            <button
              onClick={generateOutfit}
              disabled={generating}
              className="font-mono text-[10px] tracking-[0.14em] uppercase border border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] px-3 h-8 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {generating ? (
                <>
                  <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1L7.2 4.8H11L8 7.2L9.1 11L6 8.8L2.9 11L4 7.2L1 4.8H4.8L6 1Z"
                      stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                  </svg>
                  Generate
                </>
              )}
            </button>
          )}

          {/* Save */}
          <button
            onClick={saveOutfit}
            disabled={selectedCount === 0}
            className={`font-mono text-[10px] tracking-[0.14em] uppercase px-3 h-8 border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
              saved
                ? "border-[var(--border)] text-[var(--foreground-muted)]"
                : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
          {saved && (
            <Link
              href="/saved?tab=looks"
              className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              View →
            </Link>
          )}

          {/* Shop the Look CTA */}
          <button
            onClick={shopTheLook}
            disabled={selectedCount === 0}
            className={`flex items-center gap-3 h-[42px] px-5 font-mono text-[10px] tracking-[0.2em] uppercase transition-all duration-150 disabled:cursor-not-allowed ${
              selectedCount > 0
                ? "bg-[var(--foreground)] text-[var(--background)] hover:opacity-80"
                : "bg-[var(--border)] text-[var(--foreground-subtle)]"
            }`}
          >
            {shopAdded ? (
              <span>Added to Cart ✓</span>
            ) : (
              <>
                <span>Shop the Look</span>
                {selectedCount > 0 && <span>${totalPrice.toLocaleString()}</span>}
              </>
            )}
          </button>
        </div>
      </footer>

      {/* ── Generate error toast ──────────────────────────────────────────────── */}
      {generateError && (
        <p className="fixed bottom-20 right-4 z-50 text-[11px] text-red-600 bg-[var(--background)] border border-red-300 px-3 py-2 shadow-md max-w-[260px]">
          {generateError}
        </p>
      )}

      {/* ── Generated image modal (preserved exactly) ──────────────────────── */}
      {showModal && generatedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative bg-[var(--background)] shadow-2xl max-w-xl w-full mx-4 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                  AI Generated Look
                </p>
                <p className="font-mono text-[9px] text-[var(--foreground-subtle)] mt-0.5">
                  Created with {generatedModel === "gpt-image-1" ? "GPT Image 1" : "DALL·E 3"} · {selectedCount} pieces
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={generatedImage}
                  download="goo-outfit.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1V8M3 6L6 9L9 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M1 10H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  Download
                </a>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={generatedImage}
              alt="AI generated outfit"
              className="w-full aspect-square object-cover"
            />

            <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between">
              <p className="font-mono text-[9px] text-[var(--foreground-subtle)] max-w-xs leading-relaxed">
                AI-generated image based on selected pieces. May not reflect exact products.
              </p>
              <button
                onClick={() => { setShowModal(false); generateOutfit(); }}
                className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M10 6A4 4 0 1 1 6 2M6 2L9 1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
