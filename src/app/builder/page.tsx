"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Product, ProductSwatch, StyleKeyword, Brand } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";
import { useCart } from "@/lib/context/cart-context";
import { useAuth } from "@/lib/context/auth-context";
import { useCurrency } from "@/lib/context/currency-context";
import { UpgradeModal, parseUpgradePrompt, type UpgradePrompt } from "@/components/upgrade/UpgradeModal";

// ── Slot definitions ─────────────────────────────────────────────────────────

type SlotId = "outerwear" | "top" | "bottom" | "shoes" | "accessories" | "accessories2";

const SLOTS = [
  { id: "outerwear"   as SlotId, label: "Outerwear",   categories: ["outerwear", "blazers"] },
  { id: "top"         as SlotId, label: "Top",         categories: ["tops", "shirts", "knitwear"] },
  { id: "bottom"      as SlotId, label: "Bottom",      categories: ["bottoms", "jeans", "shorts", "skirts", "dresses", "jumpsuits"] },
  { id: "shoes"       as SlotId, label: "Shoes",       categories: ["footwear"] },
  { id: "accessories"  as SlotId, label: "Acc 1",       categories: ["accessories", "bags", "swimwear"] },
  { id: "accessories2" as SlotId, label: "Acc 2",       categories: ["accessories", "bags", "swimwear"] },
];

// Vertical figure zones for the silhouette canvas (accessories float separately).
// Shoes use object-contain (shoe photos are horizontal) so flex just needs to be tall
// enough to show the full pair without cramping — tuned against the catalog set.
const FIGURE_SLOTS: Array<{ id: SlotId; label: string; flex: number }> = [
  { id: "outerwear", label: "Outerwear", flex: 5   },
  { id: "top",       label: "Top",       flex: 4.5 },
  { id: "bottom",    label: "Bottom",    flex: 5   },
  { id: "shoes",     label: "Shoes",     flex: 3.5 },
];

// Category filter chips — maps to actual Category values (or slot IDs for slot-based grouping)
const CATALOG_CHIPS: Array<{ label: string; value: string | null }> = [
  { label: "All",         value: null          },
  { label: "Outerwear",   value: "outerwear"   },
  { label: "Blazers",     value: "blazers"     },
  { label: "Tops",        value: "tops"        },
  { label: "Shirts",      value: "shirts"      },
  { label: "Knitwear",    value: "knitwear"    },
  { label: "Bottoms",     value: "bottoms"     },
  { label: "Jeans",       value: "jeans"       },
  { label: "Shorts",      value: "shorts"      },
  { label: "Skirts",      value: "skirts"      },
  { label: "Dresses",     value: "dresses"     },
  { label: "Jumpsuits",   value: "jumpsuits"   },
  { label: "Footwear",    value: "footwear"    },
  { label: "Accessories", value: "accessories" },
  { label: "Bags",        value: "bags"        },
  { label: "Swimwear",    value: "swimwear"    },
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
      {(id === "accessories" || id === "accessories2") && (<>
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
  const [catalogCategory, setCatalogCategory] = useState<string | null>(null);
  const [likedOnly, setLikedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>([]);
  const [sortBy, setSortBy] = useState<"featured" | "price-asc" | "price-desc">("featured");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["category", "price", "brand", "sort"]));
  const [catalogPreviews, setCatalogPreviews] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const [shopAdded, setShopAdded] = useState(false);

  const { likedProducts } = useLikes();
  const { addManyToCart } = useCart();
  const { isLoggedIn, login } = useAuth();
  const { formatPrice } = useCurrency();

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [activeStyle, setActiveStyle] = useState<"mannequin" | "flatlay">("mannequin");
  // Tracks the localStorage id of the look we've already persisted in this session,
  // so repeated Generate/Save calls update the same saved look instead of creating duplicates.
  const [persistedLookId, setPersistedLookId] = useState<string | null>(null);

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

  const filterByCategory = (list: Product[], cat: string | null) => {
    if (!cat) return list;
    const slot = SLOTS.find(s => s.id === cat);
    if (slot) return list.filter(p => slot.categories.includes(p.category));
    return list.filter(p => p.category === cat);
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Brands available in the current category filter (for the brand multi-select)
  const availableBrands = useMemo(() =>
    Array.from(new Set(filterByCategory(products, catalogCategory).map(p => p.brand))).sort() as Brand[],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [catalogCategory, products]);

  const catalogProducts = useMemo(() => {
    let list = filterByCategory(products, catalogCategory);

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

  const hasActiveFilters = maxPrice !== null || selectedBrands.length > 0 || sortBy !== "featured" || likedOnly || catalogCategory !== null;

  // ── Actions ───────────────────────────────────────────────────────────────

  // Auto-routes product into the correct slot based on its category.
  // For multi-slot categories (accessories), fills the first empty slot; toggles off if already selected.
  const selectProduct = (product: Product) => {
    const matchingSlots = SLOTS.filter(s => s.categories.includes(product.category));
    if (matchingSlots.length === 0) return;

    setSelection(prev => {
      const next = { ...prev };

      // Toggle off if already selected in any matching slot
      for (const slot of matchingSlots) {
        if (next[slot.id]?.id === product.id) {
          delete next[slot.id];
          setVariantOverrides(vo => { const n = { ...vo }; delete n[slot.id]; return n; });
          updateURL(next);
          setActiveSlot(slot.id);
          return next;
        }
      }

      // Find first empty slot, or fall back to first slot
      const emptySlot = matchingSlots.find(s => !next[s.id]) ?? matchingSlots[0];
      next[emptySlot.id] = product;
      setVariantOverrides(vo => { const n = { ...vo }; delete n[emptySlot.id]; return n; });
      updateURL(next);
      setActiveSlot(emptySlot.id);
      return next;
    });
    setSaved(false);
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
    setLikedOnly(false);
    setCatalogCategory(null);
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

  // Shared persistence helper — used by Save button and post-generation auto-save.
  // If editId (URL) or persistedLookId (session) matches an existing look, updates it.
  // Otherwise creates a new look and remembers its id so future calls reuse it.
  const persistLook = (extra: { generatedImage?: string; generatedStyle?: string } = {}) => {
    const urlEditId = new URLSearchParams(window.location.search).get("editId");
    const targetId = urlEditId || persistedLookId;
    const pieces = Object.entries(selection)
      .filter(([, p]) => p != null)
      .map(([slot, p]) => {
        const variantId = variantOverrides[slot as SlotId];
        const activeVariant = variantId ? p!.variants?.find(v => v.id === variantId) : null;
        const imageUrl = activeVariant?.imageUrl ?? p!.imageUrl;
        return { slot, productId: p!.id, variantId: variantId ?? null, imageUrl, name: p!.name };
      });
    try {
      const existing: Record<string, unknown>[] = JSON.parse(localStorage.getItem("goo-saved-outfits") || "[]");
      let updated;
      let savedId: string;
      if (targetId && existing.some((o) => o.id === targetId)) {
        savedId = targetId;
        updated = existing.map((o) =>
          o.id === targetId
            ? {
                ...o,
                pieces,
                totalPrice,
                styleKeywords,
                ...(extra.generatedImage !== undefined && { generatedImage: extra.generatedImage }),
                ...(extra.generatedStyle !== undefined && { generatedStyle: extra.generatedStyle }),
              }
            : o
        );
      } else {
        savedId = `outfit-${Date.now()}`;
        const outfit = {
          id: savedId,
          savedAt: new Date().toISOString(),
          pieces,
          totalPrice,
          styleKeywords,
          ...(extra.generatedImage && { generatedImage: extra.generatedImage }),
          ...(extra.generatedStyle && { generatedStyle: extra.generatedStyle }),
        };
        updated = [outfit, ...existing].slice(0, 50);
      }
      localStorage.setItem("goo-saved-outfits", JSON.stringify(updated));
      setPersistedLookId(savedId);
    } catch {}
  };

  const saveOutfit = () => {
    if (!isLoggedIn) {
      login("", "");
      return;
    }
    persistLook();
    setSaved(true);
  };

  const openStylePicker = () => {
    if (!isLoggedIn) {
      login("", "");
      return;
    }
    setShowStylePicker(true);
  };

  // ── Nano Banana 2 generation via Replicate ────────────────────────────────
  const generateOutfit = async (style: "mannequin" | "flatlay") => {
    setActiveStyle(style);
    setGenerating(true);
    setGenerateError(null);
    setGeneratedImage(null);

    const pieces = Object.entries(selection)
      .filter(([, p]) => p != null)
      .map(([slot, p]) => {
        // Respect the active color variant so the generation sees the right image and color name
        const variantId = variantOverrides[slot as SlotId];
        const activeVariant = variantId ? p!.variants?.find(v => v.id === variantId) : null;
        return {
          slot,
          name: p!.name,
          brand: p!.brand,
          category: p!.category,
          material: p!.material,
          colors: p!.colors,
          colorName: activeVariant?.colorName ?? undefined,
          styleKeywords: p!.styleKeywords,
          imageUrl: activeVariant?.imageUrl ?? p!.imageUrl,
        };
      });

    try {
      const res = await fetch("/api/generate-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pieces, style }),
      });

      const upgrade = await parseUpgradePrompt(res);
      if (upgrade) {
        setUpgradePrompt(upgrade);
        return;
      }

      const json = await res.json();
      if (!res.ok) {
        setGenerateError(json.error ?? "Generation failed. Try again.");
      } else {
        setGeneratedImage(json.imageUrl);
        setShowModal(true);
        // Auto-save the look with its generated image so it's not lost when the modal closes
        persistLook({ generatedImage: json.imageUrl, generatedStyle: style });
        setSaved(true);
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
          3-COLUMN BODY
          relative wrapper bounds the AI drawer overlay
      ───────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div className="hidden md:grid md:h-full md:grid-cols-[35%_65%]">

          {/* ── LEFT PANEL: In this look + actions (35%) ─────────────────── */}
          <aside className="flex flex-col border-r border-[var(--border)] bg-[var(--background)] min-h-0 overflow-hidden">

            {/* Header */}
            <div className="px-6 pt-5 pb-4 shrink-0 border-b border-[var(--border)]">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-1">In this look</p>
              <p className="font-display text-[22px] font-light text-[var(--foreground)]">
                {selectedCount > 0 ? `${selectedCount} piece${selectedCount !== 1 ? "s" : ""}` : "Empty"}
              </p>
            </div>

            {/* Slot rows */}
            <div className="flex-1 overflow-y-auto">
              {SLOTS.map(slot => {
                const picked = selection[slot.id];
                const variantId = variantOverrides[slot.id];
                const activeVariant = picked?.variants?.find(v => v.id === variantId);
                const displayImage = activeVariant?.imageUrl ?? picked?.imageUrl;
                return (
                  <button
                    key={slot.id}
                    onClick={() => { setActiveSlot(slot.id); setCatalogCategory(slot.id); }}
                    className={`w-full grid grid-cols-[90px_1fr_auto] gap-3 px-5 py-3 items-center border-b border-[var(--border)] min-h-[110px] text-left transition-colors duration-150 hover:bg-[var(--surface)] ${
                      activeSlot === slot.id ? "bg-[var(--surface)]" : ""
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-[90px] h-[106px] bg-white border border-[var(--border)] shrink-0 overflow-hidden flex items-center justify-center">
                      {displayImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={displayImage} alt={picked!.name} className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-[var(--foreground-subtle)] opacity-30"><SlotIcon id={slot.id} size={20} /></div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="min-w-0">
                      <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-0.5">{slot.label}</p>
                      {picked ? (
                        <>
                          <p className="text-[12px] leading-snug text-[var(--foreground)] truncate">{picked.name}</p>
                          <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5 truncate">{picked.brand}</p>
                          {/* Color swatches */}
                          {(picked.variants?.length ?? 0) > 1 && (
                            <div className="flex items-center gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                              {picked.variants!.slice(0, 6).map(sw => (
                                <button key={sw.id} title={sw.colorName}
                                  onClick={e => { e.stopPropagation(); selectVariant(slot.id, sw); }}
                                  className={`w-3.5 h-3.5 rounded-full shrink-0 transition-all ${(variantId ?? picked.id) === sw.id ? "ring-2 ring-offset-1 ring-[var(--foreground)] scale-110" : "opacity-70 hover:opacity-100"}`}
                                  style={{ background: sw.colorHex === "#multicolor" ? "conic-gradient(red,orange,yellow,green,blue,violet,red)" : sw.colorHex, boxShadow: "inset 0 0 0 1px rgba(128,128,128,0.4)" }}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-[11px] text-[var(--foreground-subtle)] italic">Click to add</p>
                      )}
                    </div>
                    {/* Price + remove */}
                    <div className="shrink-0 text-right flex flex-col items-end gap-2">
                      {picked && <p className="text-[12px] font-medium text-[var(--foreground)]">{formatPrice(picked.priceMin)}</p>}
                      {picked && (
                        <button
                          onClick={e => clearSlot(slot.id, e)}
                          className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                          aria-label={`Remove ${slot.label}`}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Total + Share + Clear */}
            <div className="shrink-0 border-t border-[var(--border)] px-5 py-3">
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">Total</p>
                <p className={`font-display font-light transition-all ${selectedCount > 0 ? "text-[22px] text-[var(--foreground)]" : "text-[18px] text-[var(--foreground-subtle)]"}`}>
                  {selectedCount > 0 ? formatPrice(totalPrice) : "—"}
                </p>
              </div>
              {selectedCount > 0 && (
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={shareOutfit} className="font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
                    {copied ? "Copied!" : "Share"}
                  </button>
                  <button onClick={clearAll} className="font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
                    Clear
                  </button>
                </div>
              )}
            </div>
          </aside>

          {/* ── RIGHT PANEL: Catalog + collapsible filters on right (65%) ── */}
          <aside className="flex min-h-0 overflow-hidden bg-[var(--background)]">

            {/* Catalog main area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Top bar: search + count + filter toggle */}
              <div className="shrink-0 border-b border-[var(--border)] px-4 py-3 flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search products…"
                    className="w-full h-9 bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--border-strong)] outline-none pl-8 pr-7 text-[12px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] pointer-events-none">
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                      <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </span>
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] shrink-0">
                  {catalogProducts.length}
                </p>
                <button
                  onClick={() => setFiltersOpen(v => !v)}
                  className={`flex items-center gap-1.5 font-mono text-[9px] tracking-[0.12em] uppercase shrink-0 transition-colors ${
                    filtersOpen ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                    <line x1="1" y1="3.5" x2="13" y2="3.5" />
                    <line x1="3" y1="7" x2="11" y2="7" />
                    <line x1="5" y1="10.5" x2="9" y2="10.5" />
                  </svg>
                  {hasActiveFilters ? `Filters · ${(maxPrice !== null ? 1 : 0) + selectedBrands.length + (sortBy !== "featured" ? 1 : 0) + (likedOnly ? 1 : 0)}` : "Filters"}
                </button>
              </div>

              {/* Product grid — 4 columns */}
              <div className="flex-1 overflow-y-auto">
                {catalogProducts.length === 0 ? (
                  <div className="h-full min-h-[320px] flex flex-col items-center justify-center gap-4 px-8 bg-[var(--surface)]">
                    <div className="w-20 h-20 border border-dashed border-[var(--border-strong)] flex items-center justify-center">
                      <svg width="36" height="36" viewBox="0 0 40 40" fill="none" className="text-[var(--foreground-subtle)] opacity-30">
                        <path d="M20 4C20 4 14 8 8 8V28C8 28 14 28 20 36C26 28 32 28 32 28V8C26 8 20 4 20 4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                        <path d="M20 4V36" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        <path d="M14 16H26M14 22H22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">
                        {likedOnly ? "No saved items" : search ? "No results found" : "End of catalog"}
                      </p>
                      <p className="text-[11px] text-[var(--foreground-subtle)] opacity-60">
                        {likedOnly ? "Like some items first" : search ? "Try a different search" : "That's all we have"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-px bg-[var(--border)] p-px">
                    {catalogProducts.map(product => {
                    const matchingSlots = SLOTS.filter(s => s.categories.includes(product.category));
                    const selectedSlot = matchingSlots.find(s => selection[s.id]?.id === product.id);
                    const isSelected = !!selectedSlot;
                    const variantId = selectedSlot ? variantOverrides[selectedSlot.id] : undefined;
                    const targetSlot = selectedSlot ?? matchingSlots[0];
                    // Preview: prefer catalog color preview, then selected variant, then base image
                    const previewVariantId = catalogPreviews[product.id];
                    const activeVariant = product.variants?.find(v => v.id === (previewVariantId ?? variantId));
                    const displayImage = activeVariant?.imageUrl ?? product.imageUrl;
                    const hasVariants = (product.variants?.length ?? 0) > 1;

                    return (
                      <div
                        key={product.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectProduct(product)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectProduct(product);
                          }
                        }}
                        className={`group relative flex flex-col text-left cursor-pointer bg-[var(--background)] transition-all duration-150 ${
                          isSelected ? "ring-2 ring-inset ring-[var(--foreground)]" : ""
                        }`}
                      >
                        {/* Image */}
                        <div className="relative w-full aspect-[3/4] overflow-hidden bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={displayImage}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-200" />
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                              <svg width="7" height="6" viewBox="0 0 9 7" fill="none">
                                <path d="M1 3.5L3.5 6L8 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="px-2 pt-1.5 pb-2">
                          <p className="text-[10px] font-medium text-[var(--foreground)] leading-snug truncate">{product.name}</p>
                          <div className="flex items-center justify-between mt-0.5 gap-1">
                            <p className="text-[9px] text-[var(--foreground-muted)] truncate">{product.brand}</p>
                            <p className="font-mono text-[9px] text-[var(--foreground)] shrink-0">{formatPrice(product.priceMin)}</p>
                          </div>
                          {hasVariants && (
                            <div className="flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                              {product.variants!.slice(0, 5).map(swatch => {
                                const activeId = catalogPreviews[product.id] ?? (isSelected ? variantId : null) ?? product.id;
                                const isSwatchActive = activeId === swatch.id;
                                return (
                                  <button
                                    key={swatch.id}
                                    title={swatch.colorName}
                                    onClick={e => {
                                      e.stopPropagation();
                                      // Preview color in catalog without selecting
                                      setCatalogPreviews(prev => ({ ...prev, [product.id]: swatch.id }));
                                      // If already in the look, also update the variant there
                                      if (isSelected && targetSlot) selectVariant(targetSlot.id, swatch);
                                    }}
                                    className={`w-3 h-3 rounded-full shrink-0 transition-all duration-150 ${
                                      isSwatchActive
                                        ? "ring-2 ring-offset-1 ring-[var(--foreground)] scale-110"
                                        : "opacity-70 hover:opacity-100 hover:scale-110"
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

            {/* Filters sidebar — collapsible, RIGHT side */}
            <div
              className="shrink-0 overflow-hidden border-l border-[var(--border)] transition-all duration-200"
              style={{ width: filtersOpen ? 180 : 0 }}
            >
              <div className="w-[180px] flex flex-col overflow-y-auto h-full">

                {/* Sort — first */}
                <div className="border-b border-[var(--border)]">
                  <button onClick={() => toggleSection("sort")} className="w-full flex items-center justify-between px-4 py-3 text-left">
                    <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">Sort</p>
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
                      className={`text-[var(--foreground-subtle)] transition-transform duration-150 ${collapsedSections.has("sort") ? "-rotate-90" : ""}`}>
                      <path d="M2 3.5L5 6.5L8 3.5" />
                    </svg>
                  </button>
                  {!collapsedSections.has("sort") && (
                    <div className="px-3 pb-3 flex flex-col gap-0.5">
                      {(["featured", "price-asc", "price-desc"] as const).map(s => (
                        <button key={s} onClick={() => setSortBy(s)}
                          className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                            sortBy === s ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {s === "featured" ? "Featured" : s === "price-asc" ? "Price ↑" : "Price ↓"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Liked only + Clear — second */}
                <div className="border-b border-[var(--border)] px-3 py-3 flex flex-col gap-0.5">
                  <button
                    onClick={() => setLikedOnly(v => !v)}
                    className={`w-full text-left px-2 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                      likedOnly ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill={likedOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.57 3.07 2 5 2C6.19 2 7.24 2.61 8 3.5C8.76 2.61 9.81 2 11 2C12.93 2 14.5 3.57 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z" />
                    </svg>
                    Liked only
                  </button>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="w-full text-left px-2 py-1.5 text-xs text-[var(--foreground-subtle)] hover:text-red-500 transition-colors">
                      Clear filters
                    </button>
                  )}
                </div>

                {/* Category */}
                <div className="border-b border-[var(--border)]">
                  <button onClick={() => toggleSection("category")} className="w-full flex items-center justify-between px-4 py-3 text-left">
                    <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">Category</p>
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
                      className={`text-[var(--foreground-subtle)] transition-transform duration-150 ${collapsedSections.has("category") ? "-rotate-90" : ""}`}>
                      <path d="M2 3.5L5 6.5L8 3.5" />
                    </svg>
                  </button>
                  {!collapsedSections.has("category") && (
                    <div className="px-3 pb-3 flex flex-col gap-0.5">
                      {CATALOG_CHIPS.map(({ label, value }) => (
                        <button
                          key={label}
                          onClick={() => setCatalogCategory(catalogCategory === value ? null : value)}
                          className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                            catalogCategory === value
                              ? "bg-[var(--foreground)] text-[var(--background)]"
                              : "text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Price */}
                <div className="border-b border-[var(--border)]">
                  <button onClick={() => toggleSection("price")} className="w-full flex items-center justify-between px-4 py-3 text-left">
                    <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">Price</p>
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
                      className={`text-[var(--foreground-subtle)] transition-transform duration-150 ${collapsedSections.has("price") ? "-rotate-90" : ""}`}>
                      <path d="M2 3.5L5 6.5L8 3.5" />
                    </svg>
                  </button>
                  {!collapsedSections.has("price") && (
                    <div className="px-3 pb-3 flex flex-col gap-0.5">
                      {PRICE_BUCKETS.map(({ label, max }) => (
                        <button
                          key={label}
                          onClick={() => setMaxPrice(maxPrice === max ? null : max)}
                          className={`w-full text-left px-2 py-1.5 text-xs transition-colors ${
                            maxPrice === max
                              ? "bg-[var(--foreground)] text-[var(--background)]"
                              : "text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Brand */}
                {availableBrands.length > 0 && (
                  <div className="border-b border-[var(--border)]">
                    <button onClick={() => toggleSection("brand")} className="w-full flex items-center justify-between px-4 py-3 text-left">
                      <p className="font-mono text-[8px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">Brand</p>
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
                        className={`text-[var(--foreground-subtle)] transition-transform duration-150 ${collapsedSections.has("brand") ? "-rotate-90" : ""}`}>
                        <path d="M2 3.5L5 6.5L8 3.5" />
                      </svg>
                    </button>
                    {!collapsedSections.has("brand") && (
                      <div className="px-3 pb-3 flex flex-col gap-0.5">
                        {availableBrands.map(brand => {
                          const isActive = selectedBrands.includes(brand);
                          return (
                            <button
                              key={brand}
                              onClick={() => setSelectedBrands(prev => isActive ? prev.filter(b => b !== brand) : [...prev, brand])}
                              className={`w-full text-left px-2 py-1.5 text-xs transition-colors truncate ${
                                isActive
                                  ? "bg-[var(--foreground)] text-[var(--background)]"
                                  : "text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                              }`}
                            >
                              {brand}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                          <img
                            src={displayImage}
                            alt={picked!.name}
                            className={`absolute inset-0 w-full h-full ${
                              id === "shoes" ? "object-contain p-1.5" : "object-cover"
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Accessories — two floating mini panels stacked */}
                <div className="absolute right-0 flex flex-col gap-1" style={{ top: "50%", transform: "translateY(-50%)" }}>
                  {(["accessories", "accessories2"] as SlotId[]).map(id => {
                    const picked = selection[id];
                    const displayImage = picked?.imageUrl;
                    return (
                      <button
                        key={id}
                        onClick={() => { setActiveSlot(id); setCatalogCategory("accessories"); }}
                        className={`relative overflow-hidden border transition-all ${
                          activeSlot === id ? "border-[var(--foreground)] ring-1 ring-[var(--foreground)]" : "border-[var(--border)]"
                        }`}
                        style={{ width: 34, height: 40 }}
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
                          <img src={displayImage} alt={picked!.name} className="absolute inset-0 w-full h-full object-contain p-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
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
            {CATALOG_CHIPS.map(({ label, value }) => {
              const isActive = catalogCategory === value;
              return (
                <button
                  key={label}
                  onClick={() => setCatalogCategory(catalogCategory === value ? null : value)}
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
              <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-3 px-6 bg-[var(--surface)]">
                <div className="w-16 h-16 border border-dashed border-[var(--border-strong)] flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 40 40" fill="none" className="text-[var(--foreground-subtle)] opacity-30">
                    <path d="M20 4C20 4 14 8 8 8V28C8 28 14 28 20 36C26 28 32 28 32 28V8C26 8 20 4 20 4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    <path d="M20 4V36" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M14 16H26M14 22H22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-center space-y-0.5">
                  <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">
                    {likedOnly ? "No saved items" : search ? "No results found" : "End of catalog"}
                  </p>
                  <p className="text-[10px] text-[var(--foreground-subtle)] opacity-60">
                    {likedOnly ? "Like some items first" : search ? "Try a different search" : "That's all we have"}
                  </p>
                </div>
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
                          <p className="font-mono text-[10px] text-[var(--foreground)] shrink-0">{formatPrice(product.priceMin)}</p>
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
                {selectedCount > 0 ? formatPrice(totalPrice) : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Generate — icon-only on mobile, visible with ≥1 piece */}
              {selectedCount >= 1 && (
                <button
                  onClick={openStylePicker}
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
                  ? `Shop · ${formatPrice(totalPrice)}`
                  : "Shop the Look"}
              </button>
            </div>
          </div>
        </div>

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
              onClick={openStylePicker}
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
                {selectedCount > 0 && <span>{formatPrice(totalPrice)}</span>}
              </>
            )}
          </button>
        </div>
      </footer>

      {/* ── Style picker modal ───────────────────────────────────────────────── */}
      {showStylePicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowStylePicker(false)}
        >
          <div
            className="bg-[var(--background)] shadow-2xl w-full max-w-sm mx-4 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">
                Choose style
              </p>
              <button
                onClick={() => setShowStylePicker(false)}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                  <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {/* Mannequin — dark */}
              <button
                onClick={() => { setShowStylePicker(false); generateOutfit("mannequin"); }}
                className="group flex flex-col items-center gap-3 p-4 border border-[var(--border)] hover:border-[var(--foreground)] transition-all duration-150"
              >
                {/* Preview icon: dark square with figure silhouette */}
                <div className="w-full aspect-square bg-[#111] flex items-center justify-center">
                  <svg width="32" height="48" viewBox="0 0 32 56" fill="none">
                    <ellipse cx="16" cy="6" rx="5" ry="5" fill="#555" />
                    <rect x="10" y="13" width="12" height="22" rx="2" fill="#555" />
                    <rect x="4" y="13" width="6" height="16" rx="2" fill="#444" />
                    <rect x="22" y="13" width="6" height="16" rx="2" fill="#444" />
                    <rect x="10" y="36" width="5" height="18" rx="2" fill="#555" />
                    <rect x="17" y="36" width="5" height="18" rx="2" fill="#555" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground)] mb-0.5">Mannequin</p>
                  <p className="font-mono text-[8px] text-[var(--foreground-subtle)]">Black background</p>
                </div>
              </button>

              {/* Flat lay — white */}
              <button
                onClick={() => { setShowStylePicker(false); generateOutfit("flatlay"); }}
                className="group flex flex-col items-center gap-3 p-4 border border-[var(--border)] hover:border-[var(--foreground)] transition-all duration-150"
              >
                {/* Preview icon: white square with folded items */}
                <div className="w-full aspect-square bg-[#F8F7F4] border border-[var(--border)] flex items-center justify-center">
                  <svg width="48" height="36" viewBox="0 0 56 40" fill="none">
                    <rect x="4" y="4" width="20" height="14" rx="2" fill="#ccc" />
                    <rect x="32" y="4" width="20" height="14" rx="2" fill="#bbb" />
                    <rect x="4" y="24" width="20" height="12" rx="2" fill="#ddd" />
                    <rect x="32" y="24" width="20" height="12" rx="2" fill="#c8c8c8" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground)] mb-0.5">Flat lay</p>
                  <p className="font-mono text-[8px] text-[var(--foreground-subtle)]">White studio</p>
                </div>
              </button>
            </div>
            <p className="px-5 pb-4 font-mono text-[8px] text-[var(--foreground-subtle)] text-center">
              Product images sent as references · 1K resolution · Nano Banana 2
            </p>
          </div>
        </div>
      )}

      {/* ── Generate error toast ──────────────────────────────────────────────── */}
      {generateError && (
        <p className="fixed bottom-20 right-4 z-50 text-[11px] text-red-600 bg-[var(--background)] border border-red-300 px-3 py-2 shadow-md max-w-[260px]">
          {generateError}
        </p>
      )}

      {/* ── Upgrade modal (402 from /api/generate-outfit) ─────────────────────── */}
      <UpgradeModal prompt={upgradePrompt} onClose={() => setUpgradePrompt(null)} />

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
                  Nano Banana 2 · {activeStyle === "mannequin" ? "Mannequin" : "Flat lay"} · {selectedCount} pieces
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
                onClick={() => { setShowModal(false); openStylePicker(); }}
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
