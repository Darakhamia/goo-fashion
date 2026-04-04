"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Product, ProductSwatch, StyleKeyword } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";

// ── Slot definitions ─────────────────────────────────────────────────────────

type SlotId = "top" | "bottom" | "shoes" | "accessories";

const SLOTS = [
  { id: "top"         as SlotId, label: "Top",         categories: ["tops", "knitwear", "outerwear"] },
  { id: "bottom"      as SlotId, label: "Bottom",      categories: ["bottoms", "dresses"] },
  { id: "shoes"       as SlotId, label: "Shoes",       categories: ["footwear"] },
  { id: "accessories" as SlotId, label: "Acc",         categories: ["accessories"] },
];

// ── Icons ────────────────────────────────────────────────────────────────────

function SlotIcon({ id, size = 15 }: { id: SlotId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
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

// ── Product row in the picker panel ─────────────────────────────────────────

function ProductRow({
  product,
  selected,
  matchScore,
  activeVariantId,
  onSelect,
  onSelectVariant,
}: {
  product: Product;
  selected: boolean;
  matchScore: number;
  activeVariantId?: string;
  onSelect: () => void;
  onSelectVariant: (swatch: ProductSwatch) => void;
}) {
  const variants = product.variants ?? [];
  const currentVariant = variants.find(v => v.id === activeVariantId);
  const displayImage = currentVariant?.imageUrl ?? product.imageUrl;

  return (
    <div className={`transition-colors duration-150 ${selected ? "bg-[var(--foreground)]" : "hover:bg-[var(--surface)]"}`}>
      <button
        onClick={onSelect}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
      >
        {/* Thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayImage}
          alt={product.name}
          className="w-9 h-9 shrink-0 object-cover"
        />
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-medium leading-tight truncate ${
            selected ? "text-[var(--background)]" : "text-[var(--foreground)]"
          }`}>
            {product.name}
          </p>
          <p className={`text-[10px] mt-0.5 truncate ${
            selected ? "text-[var(--background)]/60" : "text-[var(--foreground-muted)]"
          }`}>
            {product.brand}
          </p>
        </div>
        {/* Price + match */}
        <div className="shrink-0 text-right">
          <p className={`text-[11px] font-medium ${
            selected ? "text-[var(--background)]" : "text-[var(--foreground)]"
          }`}>
            ${product.priceMin.toLocaleString()}
          </p>
          {!selected && matchScore > 0 && (
            <p className="text-[8px] text-[var(--foreground-subtle)] mt-0.5">
              {"✦".repeat(Math.min(matchScore, 3))}
            </p>
          )}
        </div>
      </button>

      {/* Color variant swatches — shown when selected and has variants */}
      {selected && variants.length > 1 && (
        <div className="px-3 pb-2.5 flex items-center gap-1.5">
          {variants.map(swatch => {
            const isActive = (activeVariantId ?? product.id) === swatch.id;
            return (
              <button
                key={swatch.id}
                onClick={() => onSelectVariant(swatch)}
                title={swatch.colorName}
                className={`w-4 h-4 rounded-full shrink-0 transition-all duration-150 ${
                  isActive
                    ? "ring-2 ring-offset-1 ring-[var(--background)] scale-110"
                    : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: swatch.colorHex === "#multicolor"
                    ? undefined
                    : swatch.colorHex,
                  background: swatch.colorHex === "#multicolor"
                    ? "conic-gradient(red, orange, yellow, green, blue, violet, red)"
                    : swatch.colorHex,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Empty slot placeholder ───────────────────────────────────────────────────

function EmptySlot({ slot, isActive }: { slot: typeof SLOTS[number]; isActive: boolean }) {
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center gap-2 transition-opacity ${
      isActive ? "opacity-100" : "opacity-40"
    }`}>
      <div className="text-[var(--foreground-subtle)]">
        <SlotIcon id={slot.id} size={22} />
      </div>
      <p className="text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] font-medium">
        {slot.label}
      </p>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const [activeSlot, setActiveSlot] = useState<SlotId>("top");
  const [selection, setSelection] = useState<Partial<Record<SlotId, Product>>>({});
  // Stores the active variant swatch ID per slot (overrides the primary's image in the canvas)
  const [variantOverrides, setVariantOverrides] = useState<Partial<Record<SlotId, string>>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [aiMatch, setAiMatch] = useState(false);
  const [likedOnly, setLikedOnly] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const { likedProducts } = useLikes();

  // ── Generation state ──────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedModel, setGeneratedModel] = useState<string>("ai");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProducts(d); })
      .catch(() => {});
  }, []);

  // Style keywords derived from currently selected pieces
  const styleKeywords = useMemo<StyleKeyword[]>(() =>
    Array.from(new Set(
      Object.values(selection).filter(Boolean).flatMap(p => p!.styleKeywords)
    )) as StyleKeyword[],
  [selection]);

  // Sync selection to URL params so outfit can be shared / restored on back
  const updateURL = useCallback((sel: Partial<Record<SlotId, Product>>) => {
    const url = new URL(window.location.href);
    SLOTS.forEach(({ id }) => {
      if (sel[id]) url.searchParams.set(id, sel[id]!.id);
      else url.searchParams.delete(id);
    });
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Restore selection from URL when products are available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restored: Partial<Record<SlotId, Product>> = {};
    let found = false;
    for (const { id } of SLOTS) {
      const pid = params.get(id);
      if (pid) {
        const p = products.find(x => x.id === pid);
        if (p) { restored[id] = p; found = true; }
      }
    }
    if (found) setSelection(restored);
  }, [products]);

  // Products for current slot with search filter + AI match scoring
  const { slotProducts, slotScores } = useMemo(() => {
    const slot = SLOTS.find(s => s.id === activeSlot)!;
    let list = products.filter(p => slot.categories.includes(p.category));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
      );
    }

    const scores: Record<string, number> = {};
    list.forEach(p => {
      scores[p.id] = p.styleKeywords.filter(k => styleKeywords.includes(k)).length;
    });

    if (likedOnly) {
      list = list.filter(p => likedProducts.includes(p.id));
    }

    if (aiMatch && styleKeywords.length > 0) {
      list = [...list].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
    }

    return { slotProducts: list, slotScores: scores };
  }, [activeSlot, products, search, aiMatch, styleKeywords, likedOnly, likedProducts]);

  const totalPrice = useMemo(() =>
    Object.values(selection).reduce((sum, p) => sum + (p?.priceMin ?? 0), 0),
  [selection]);

  const selectedCount = Object.values(selection).filter(Boolean).length;

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectProduct = (product: Product) => {
    setSelection(prev => {
      const next = { ...prev };
      if (next[activeSlot]?.id === product.id) {
        delete next[activeSlot];
        setVariantOverrides(vo => { const n = { ...vo }; delete n[activeSlot]; return n; });
      } else {
        next[activeSlot] = product;
        setVariantOverrides(vo => { const n = { ...vo }; delete n[activeSlot]; return n; });
      }
      updateURL(next);
      return next;
    });
    setSaved(false);
  };

  const selectVariant = (slotId: SlotId, swatch: ProductSwatch) => {
    setVariantOverrides(prev => ({ ...prev, [slotId]: swatch.id }));
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

  const shareOutfit = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const saveOutfit = () => {
    const outfit = {
      id: `outfit-${Date.now()}`,
      savedAt: new Date().toISOString(),
      pieces: Object.entries(selection).map(([slot, p]) => ({ slot, productId: p!.id, imageUrl: p!.imageUrl, name: p!.name })),
      totalPrice,
      styleKeywords,
    };
    try {
      const existing: unknown[] = JSON.parse(localStorage.getItem("goo-saved-outfits") || "[]");
      localStorage.setItem("goo-saved-outfits", JSON.stringify([outfit, ...existing].slice(0, 50)));
    } catch {}
    setSaved(true);
  };

  // ── DALL-E generation ─────────────────────────────────────────────────────

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

      {/* ── Header bar ── */}
      <div className="h-11 shrink-0 border-b border-[var(--border)] bg-[var(--background)] flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href="/browse"
            className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M7 1.5L3 5L7 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Browse
          </Link>
          <span className="text-[var(--border-strong)] text-xs">·</span>
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
            Builder
          </p>
          {selectedCount > 0 && (
            <span className="text-[10px] text-[var(--foreground-muted)] animate-fade-in">
              — {selectedCount}/{SLOTS.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          {selectedCount > 0 && (
            <>
              <button
                onClick={shareOutfit}
                className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <circle cx="10" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.1" />
                  <circle cx="10" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.1" />
                  <circle cx="2" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M8.5 2.8L3.5 5.3M3.5 6.7L8.5 9.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                {copied ? "Copied!" : "Share"}
              </button>
              <button
                onClick={clearAll}
                className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main two-panel layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── LEFT: Product picker ─── */}
        <aside className="w-[240px] md:w-[280px] lg:w-[300px] shrink-0 border-r border-[var(--border)] bg-[var(--background)] flex flex-col overflow-hidden">

          {/* Slot tabs */}
          <div className="grid grid-cols-4 border-b border-[var(--border)] shrink-0">
            {SLOTS.map(slot => {
              const isActive = activeSlot === slot.id;
              const hasPick = !!selection[slot.id];
              return (
                <button
                  key={slot.id}
                  onClick={() => setActiveSlot(slot.id)}
                  title={slot.label}
                  className={`relative flex flex-col items-center justify-center gap-1.5 py-3 transition-colors duration-150 ${
                    isActive
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
                  }`}
                >
                  <SlotIcon id={slot.id} size={14} />
                  <span className="text-[8px] tracking-[0.08em] uppercase font-medium leading-none">
                    {slot.label}
                  </span>
                  {hasPick && (
                    <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                      isActive ? "bg-[var(--background)]" : "bg-[var(--foreground)]"
                    }`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Search + filters */}
          <div className="px-2.5 py-2 border-b border-[var(--border)] shrink-0 flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--foreground)] outline-none pl-2.5 pr-7 py-1.5 text-[11px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors"
              />
              {search ? (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              ) : (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] pointer-events-none">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M9 9L11.5 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </span>
              )}
            </div>
            <button
              onClick={() => setLikedOnly(v => !v)}
              title="Show liked items only"
              className={`shrink-0 px-2 py-1.5 text-[8px] tracking-[0.1em] uppercase font-medium border transition-colors ${
                likedOnly
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--foreground-subtle)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              ♥
            </button>
            {selectedCount > 0 && (
              <button
                onClick={() => setAiMatch(v => !v)}
                title="Sort by style compatibility"
                className={`shrink-0 px-2 py-1.5 text-[8px] tracking-[0.1em] uppercase font-medium border transition-colors ${
                  aiMatch
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--foreground-subtle)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                ✦ Match
              </button>
            )}
          </div>

          {/* Active slot context — selected piece or item count */}
          <div className="px-3 py-2 border-b border-[var(--border)] shrink-0 min-h-[2.75rem] flex items-center">
            {selection[activeSlot] ? (
              <div className="flex items-center gap-2 w-full min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selection[activeSlot]!.variants?.find(v => v.id === variantOverrides[activeSlot])?.imageUrl ?? selection[activeSlot]!.imageUrl}
                  alt=""
                  className="w-6 h-6 object-cover shrink-0"
                />
                <p className="text-[10px] text-[var(--foreground)] truncate font-medium flex-1 min-w-0">
                  {selection[activeSlot]!.name}
                </p>
                <button
                  onClick={() => clearSlot(activeSlot)}
                  className="shrink-0 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-[var(--foreground-subtle)]">
                {slotProducts.length} items
              </p>
            )}
          </div>

          {/* Scrollable product list */}
          <div className="flex-1 overflow-y-auto">
            {slotProducts.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <p className="text-xs text-[var(--foreground-muted)]">
                  {likedOnly ? "No liked items in this category." : search ? "No items match." : "No items in this category."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {slotProducts.map(product => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    selected={selection[activeSlot]?.id === product.id}
                    matchScore={slotScores[product.id] ?? 0}
                    activeVariantId={variantOverrides[activeSlot]}
                    onSelect={() => selectProduct(product)}
                    onSelectVariant={(swatch) => selectVariant(activeSlot, swatch)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ─── RIGHT: Outfit canvas ─── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[var(--surface)]">

          {/* 2 × 2 grid — fills all available height, no scroll needed */}
          <div className="flex-1 overflow-hidden grid grid-cols-2 grid-rows-2 gap-px bg-[var(--border)]">
            {SLOTS.map(slot => {
              const picked = selection[slot.id];
              const isActive = activeSlot === slot.id;
              const variantId = variantOverrides[slot.id];
              const activeVariant = picked?.variants?.find(v => v.id === variantId);
              const displayImage = activeVariant?.imageUrl ?? picked?.imageUrl;
              return (
                <button
                  key={slot.id}
                  onClick={() => setActiveSlot(slot.id)}
                  className={`group relative block overflow-hidden bg-[var(--background)] transition-all duration-200 ${
                    isActive ? "ring-2 ring-inset ring-[var(--foreground)] z-10" : ""
                  }`}
                >
                  {picked ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayImage}
                        alt={picked.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors duration-300" />

                      {/* Info card — slides up on hover */}
                      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 translate-y-1 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-250">
                        <div className="bg-[var(--background)]/92 backdrop-blur-sm px-3 py-2.5">
                          <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-0.5">
                            {picked.brand}
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-[var(--foreground)] truncate flex-1">{picked.name}</p>
                            <Link
                              href={`/product/${picked.id}`}
                              onClick={e => e.stopPropagation()}
                              className="text-[9px] tracking-[0.1em] uppercase text-[var(--foreground)] shrink-0 hover:opacity-50 transition-opacity"
                            >
                              View →
                            </Link>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-[11px] font-medium text-[var(--foreground)]">
                              ${picked.priceMin.toLocaleString()}
                            </p>
                            <button
                              onClick={e => clearSlot(slot.id, e)}
                              className="text-[8px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                          {/* Color variant swatches in canvas hover card */}
                          {(picked.variants?.length ?? 0) > 1 && (
                            <div className="flex items-center gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                              {picked.variants!.map(swatch => {
                                const isSwatchActive = (variantId ?? picked.id) === swatch.id;
                                return (
                                  <button
                                    key={swatch.id}
                                    title={swatch.colorName}
                                    onClick={e => { e.stopPropagation(); selectVariant(slot.id, swatch); }}
                                    className={`w-3.5 h-3.5 rounded-full shrink-0 transition-all duration-150 ${
                                      isSwatchActive
                                        ? "ring-2 ring-offset-1 ring-[var(--foreground)] scale-110"
                                        : "opacity-60 hover:opacity-100"
                                    }`}
                                    style={{
                                      background: swatch.colorHex === "#multicolor"
                                        ? "conic-gradient(red, orange, yellow, green, blue, violet, red)"
                                        : swatch.colorHex,
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Slot badge */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="text-[7px] tracking-[0.14em] uppercase font-medium bg-white/85 backdrop-blur-sm text-black px-1.5 py-0.5">
                          {slot.label}
                        </span>
                      </div>
                    </>
                  ) : (
                    <EmptySlot slot={slot} isActive={isActive} />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Action bar ── */}
          <div className="h-14 shrink-0 border-t border-[var(--border)] bg-[var(--background)] flex items-center justify-between px-4 md:px-6">

            {/* Price + style tags */}
            <div className="flex items-center gap-4 min-w-0">
              {selectedCount > 0 ? (
                <p className="font-display text-xl font-light text-[var(--foreground)] whitespace-nowrap">
                  ${totalPrice.toLocaleString()}
                  <span className="text-[10px] font-sans text-[var(--foreground-muted)] ml-1.5 font-normal">total</span>
                </p>
              ) : (
                <p className="text-xs text-[var(--foreground-muted)]">Select pieces to start</p>
              )}

              {styleKeywords.length > 0 && (
                <div className="hidden lg:flex items-center gap-1.5 flex-wrap overflow-hidden max-h-6">
                  {styleKeywords.slice(0, 3).map(kw => (
                    <span
                      key={kw}
                      className="text-[8px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] border border-[var(--border)] px-2 py-0.5 whitespace-nowrap"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Buttons */}
            {selectedCount >= 2 && (
              <div className="flex items-center gap-2">
                {/* Generate with DALL-E */}
                <button
                  onClick={generateOutfit}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-xs tracking-[0.14em] uppercase font-medium border border-[var(--foreground)] text-[var(--foreground)] px-4 py-2.5 hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1L7.2 4.8H11L8 7.2L9.1 11L6 8.8L2.9 11L4 7.2L1 4.8H4.8L6 1Z"
                          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                      </svg>
                      Generate
                    </>
                  )}
                </button>

                {/* Save */}
                <button
                  onClick={saveOutfit}
                  className={`text-xs tracking-[0.14em] uppercase font-medium px-4 py-2.5 transition-all duration-200 ${
                    saved
                      ? "border border-[var(--border)] text-[var(--foreground-muted)]"
                      : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-80"
                  }`}
                >
                  {saved ? "Saved ✓" : "Save"}
                </button>
                {saved && (
                  <Link
                    href="/saved?tab=looks"
                    className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    View →
                  </Link>
                )}
              </div>
            )}

            {/* Error message */}
            {generateError && (
              <p className="fixed bottom-20 right-4 z-50 text-[11px] text-red-600 bg-[var(--background)] border border-red-300 px-3 py-2 shadow-md max-w-[260px]">
                {generateError}
              </p>
            )}
          </div>
        </main>
      </div>

      {/* ── Generated image modal ── */}
      {showModal && generatedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative bg-[var(--background)] shadow-2xl max-w-xl w-full mx-4 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                  AI Generated Look
                </p>
                <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">
                  Created with {generatedModel === "gpt-image-1" ? "GPT Image 1" : "DALL·E 3"} · {selectedCount} pieces
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Download */}
                <a
                  href={generatedImage}
                  download="goo-outfit.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
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

            {/* Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={generatedImage}
              alt="AI generated outfit"
              className="w-full aspect-square object-cover"
            />

            {/* Regenerate */}
            <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between">
              <p className="text-[9px] text-[var(--foreground-subtle)] max-w-xs leading-relaxed">
                AI-generated image based on selected pieces. May not reflect exact products.
              </p>
              <button
                onClick={() => { setShowModal(false); generateOutfit(); }}
                className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5"
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
