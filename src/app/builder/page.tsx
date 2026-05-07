"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product, ProductSwatch, StyleKeyword, Brand, Gender } from "@/lib/types";
import { useLikes } from "@/lib/context/likes-context";
import { useCart } from "@/lib/context/cart-context";
import { useAuth } from "@/lib/context/auth-context";
import { useCurrency } from "@/lib/context/currency-context";
import { UpgradeModal, parseUpgradePrompt, type UpgradePrompt } from "@/components/upgrade/UpgradeModal";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { useStylist } from "@/lib/context/stylist-context";

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

type CatalogItem = { kind: "product"; key: string; product: Product; forcedVariant?: ProductSwatch | null };

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

// Standard color groups (same IDs as Browse DEFAULT_COLOR_GROUPS)
const STANDARD_COLORS: { id: number; name: string; hex: string; matches: string[] }[] = [
  { id: 1,  name: "White",      hex: "#ffffff",    matches: ["White", "Ivory", "Cream", "Milk", "Ecru"] },
  { id: 2,  name: "Multicolor", hex: "#multicolor",matches: ["Multicolor"] },
  { id: 3,  name: "Brown",      hex: "#7a4f35",    matches: ["Brown", "Dark Brown", "Cognac", "Tobacco"] },
  { id: 4,  name: "Pink",       hex: "#e8698a",    matches: ["Pink", "Pale Pink", "Dusty Rose", "Pale Rose", "Dusty Mauve"] },
  { id: 5,  name: "Yellow",     hex: "#f5c518",    matches: ["Yellow", "Champagne"] },
  { id: 6,  name: "Orange",     hex: "#e87722",    matches: ["Orange"] },
  { id: 7,  name: "Grey",       hex: "#808080",    matches: ["Grey", "Light Grey", "Charcoal", "Anthracite"] },
  { id: 8,  name: "Black",      hex: "#111111",    matches: ["Black", "Dark Navy"] },
  { id: 9,  name: "Green",      hex: "#2d6a3f",    matches: ["Green", "Forest Green", "Olive", "Sage"] },
  { id: 10, name: "Red",        hex: "#c0392b",    matches: ["Red", "Burgundy"] },
  { id: 11, name: "Violet",     hex: "#7b3fa0",    matches: ["Violet", "Indigo"] },
  { id: 12, name: "Blue",       hex: "#1a47a0",    matches: ["Blue", "Navy", "Pale Blue", "Sky Blue", "Light Blue", "Medium Blue", "Faded Blue"] },
  { id: 13, name: "Beige",      hex: "#d4c5a9",    matches: ["Beige", "Sand", "Stone", "Khaki", "Camel"] },
];

// Simplified category tabs for mobile
const MOBILE_CHIPS: Array<{ label: string; value: string | null }> = [
  { label: "All",         value: null          },
  { label: "Tops",        value: "top"         },
  { label: "Bottoms",     value: "bottom"      },
  { label: "Shoes",       value: "shoes"       },
  { label: "Accessories", value: "accessories" },
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
  const [colorImageOverrides, setColorImageOverrides] = useState<Partial<Record<SlotId, string>>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState<string | null>(null);
  const [likedOnly, setLikedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [brandSearch, setBrandSearch] = useState("");
  const [sortBy, setSortBy] = useState<"featured" | "new-in" | "price-asc" | "price-desc">("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["category", "price", "brand", "color", "gender", "sort"]));
  const [catalogPreviews, setCatalogPreviews] = useState<Record<string, string>>({});
  const [catalogColorPreviews, setCatalogColorPreviews] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openSwatchPopup, setOpenSwatchPopup] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const [shopAdded, setShopAdded] = useState(false);
  const [showAllColors, setShowAllColors] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);

  const { likedProducts } = useLikes();
  const { addManyToCart } = useCart();
  const { isLoggedIn, login } = useAuth();
  const { formatPrice } = useCurrency();
  const { isOpen: stylistOpen, toggle: toggleStylist, close: closeStylist } = useStylist();
  const router = useRouter();
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const hasRestoredFromURL = useRef(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePrompt | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [activeStyle, setActiveStyle] = useState<"mannequin" | "flatlay" | "tryon">("mannequin");
  const [tryonStep, setTryonStep] = useState(false);
  const [userPhotoDataUri, setUserPhotoDataUri] = useState<string | null>(null);
  // Tracks the localStorage id of the look we've already persisted in this session,
  // so repeated Generate/Save calls update the same saved look instead of creating duplicates.
  const [persistedLookId, setPersistedLookId] = useState<string | null>(null);

  // Close swatch popup when clicking outside
  useEffect(() => {
    if (!openSwatchPopup) return;
    const close = () => setOpenSwatchPopup(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openSwatchPopup]);

  // Reset mobile product scroll to start when category changes
  useEffect(() => {
    mobileScrollRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [catalogCategory]);

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

  // Restore selection from URL params — runs only ONCE when products first load.
  // Must not re-run on subsequent product refreshes or it overwrites user edits.
  useEffect(() => {
    if (hasRestoredFromURL.current || products.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const restored: Partial<Record<SlotId, Product>> = {};
    const restoredVariants: Partial<Record<SlotId, string>> = {};
    let found = false;
    for (const { id } of SLOTS) {
      const pid = params.get(id);
      if (pid) {
        // Direct match first; fall back to searching variant swatches (handles
        // products that were regrouped after the look was saved).
        const p = products.find(x => x.id === pid)
          ?? products.find(x => x.variants?.some(v => v.id === pid));
        if (p) {
          restored[id] = p;
          found = true;
          const vid = params.get(`${id}_variant`);
          if (vid) restoredVariants[id] = vid;
          else if (p.id !== pid) restoredVariants[id] = pid;
        }
      }
    }
    hasRestoredFromURL.current = true;
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

  // Always show all 13 standard color groups (same as Browse)
  const availableColors = STANDARD_COLORS;

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

    if (selectedColors.length > 0) {
      const selectedIds = selectedColors.map(n => STANDARD_COLORS.find(c => c.name === n)?.id).filter(Boolean) as number[];
      list = list.filter(p => {
        // Prefer colorGroupIds (Supabase products), fall back to colors string array
        if (p.colorGroupIds?.length) {
          return p.colorGroupIds.some(id => selectedIds.includes(id));
        }
        const productColors = p.colors ?? [];
        return selectedColors.some(groupName => {
          const group = STANDARD_COLORS.find(c => c.name === groupName);
          return group ? productColors.some(pc => group.matches.includes(pc)) : false;
        });
      });
    }

    if (selectedGender) {
      list = list.filter(p => !p.gender || p.gender === selectedGender || p.gender === "unisex");
    }

    if (sortBy === "price-asc") {
      list = [...list].sort((a, b) => a.priceMin - b.priceMin);
    } else if (sortBy === "price-desc") {
      list = [...list].sort((a, b) => b.priceMin - a.priceMin);
    } else if (sortBy === "new-in") {
      list = [...list].sort((a, b) => b.id.localeCompare(a.id));
    }

    return list;
  }, [catalogCategory, products, search, likedOnly, likedProducts, maxPrice, selectedBrands, selectedColors, selectedGender, sortBy]);

  const expandedCatalogItems = useMemo((): CatalogItem[] => {
    if (!selectedColors.length) {
      return catalogProducts.map(product => ({ kind: "product", key: product.id, product, forcedVariant: null }));
    }
    const selectedIds = selectedColors.map(n => STANDARD_COLORS.find(c => c.name === n)?.id).filter(Boolean) as number[];
    const items: CatalogItem[] = [];
    const seen = new Set<string>();
    for (const product of catalogProducts) {
      const variants = product.variants ?? [];
      if (!variants.length) {
        if (!seen.has(product.id)) { seen.add(product.id); items.push({ kind: "product", key: product.id, product, forcedVariant: null }); }
        continue;
      }
      const matching = variants.filter(v => (v.colorGroupIds ?? []).some(id => selectedIds.includes(id)));
      if (!matching.length) {
        if (!seen.has(product.id)) { seen.add(product.id); items.push({ kind: "product", key: product.id, product, forcedVariant: null }); }
        continue;
      }
      for (const variant of matching) {
        if (!seen.has(variant.id)) {
          seen.add(variant.id);
          items.push({ kind: "product", key: `${product.id}__${variant.id}`, product, forcedVariant: variant.id === product.id ? null : variant });
        }
      }
    }
    return items;
  }, [catalogProducts, selectedColors]);

  const hasActiveFilters = maxPrice !== null || selectedBrands.length > 0 || selectedColors.length > 0 || selectedGender !== null || sortBy !== "featured" || likedOnly || catalogCategory !== null;
  const activeFilterCount = (maxPrice !== null ? 1 : 0) + selectedBrands.length + selectedColors.length + (selectedGender !== null ? 1 : 0) + (sortBy !== "featured" ? 1 : 0) + (likedOnly ? 1 : 0);

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
          setColorImageOverrides(co => { const n = { ...co }; delete n[slot.id]; return n; });
          updateURL(next);
          setActiveSlot(slot.id);
          return next;
        }
      }

      // Find first empty slot, or fall back to first slot
      const emptySlot = matchingSlots.find(s => !next[s.id]) ?? matchingSlots[0];
      next[emptySlot.id] = product;
      setVariantOverrides(vo => {
        const n = { ...vo };
        const previewVariantId = catalogPreviews[product.id];
        if (previewVariantId) n[emptySlot.id] = previewVariantId;
        else delete n[emptySlot.id];
        return n;
      });
      // Carry the catalogColorPreview into the left panel when adding to look
      setColorImageOverrides(co => {
        const colorKey = catalogColorPreviews[product.id];
        if (colorKey) return { ...co, [emptySlot.id]: colorKey };
        const n = { ...co }; delete n[emptySlot.id]; return n;
      });
      updateURL(next);
      setActiveSlot(emptySlot.id);
      return next;
    });
    setSaved(false);
    setGeneratedImage(null);
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
    setColorImageOverrides(prev => { const n = { ...prev }; delete n[slotId]; return n; });
    setGeneratedImage(null);
  };

  const clearAll = () => {
    setSelection({});
    setVariantOverrides({});
    setColorImageOverrides({});
    updateURL({});
    setSaved(false);
    setGeneratedImage(null);
  };

  const clearFilters = () => {
    setMaxPrice(null);
    setSelectedBrands([]);
    setSelectedColors([]);
    setSelectedGender(null);
    setBrandSearch("");
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
  const persistLook = (extra: { generatedImage?: string | null; generatedStyle?: string } = {}) => {
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
        const existingLook = existing.find((o) => o.id === targetId) as Record<string, unknown> | undefined;

        // When editing, preserve existing pieces for slots that are still in the URL
        // (user hasn't explicitly removed them) but couldn't be restored from the catalog.
        // URL is the source of truth for intended slots — clearSlot() removes a slot from URL.
        const urlParams = new URLSearchParams(window.location.search);
        const urlSlots = new Set<string>(SLOTS.filter(s => urlParams.has(s.id)).map(s => s.id));
        const currentSlots = new Set(pieces.map(p => p.slot));
        const existingPieces = (existingLook?.pieces as typeof pieces | undefined) ?? [];
        const orphanedPieces = existingPieces.filter(
          p => urlSlots.has(p.slot) && !currentSlots.has(p.slot)
        );
        const mergedPieces = [...pieces, ...orphanedPieces];

        updated = existing.map((o) =>
          o.id === targetId
            ? {
                ...o,
                pieces: mergedPieces,
                totalPrice,
                styleKeywords,
                // null explicitly clears the stored image; undefined means "don't touch"
                ...(extra.generatedImage !== undefined && { generatedImage: extra.generatedImage ?? null }),
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

      // Sync to server when logged in
      if (isLoggedIn) {
        const look = updated.find((o: Record<string, unknown>) => o.id === savedId);
        if (look) {
          fetch("/api/user/looks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(look),
          }).catch(() => {});
        }
      }
    } catch {}
  };

  const saveOutfit = () => {
    if (!isLoggedIn) {
      login("", "");
      return;
    }
    // Pass current generatedImage — if null (edited since last generation), clears stored image
    persistLook({ generatedImage: generatedImage });
    setSaved(true);
    setShowSaveModal(true);
  };

  const handleMobileSave = () => {
    if (!isLoggedIn) {
      login("", "");
      return;
    }
    persistLook({ generatedImage: generatedImage });
    setSaved(true);
    setShowSavedPopup(true);
  };

  const openStylePicker = () => {
    if (!isLoggedIn) {
      login("", "");
      return;
    }
    setShowStylePicker(true);
  };

  // Resize + compress a user photo client-side before sending to the API
  const compressPhoto = (file: File, maxPx = 1024): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      img.src = objectUrl;
    });

  // ── Nano Banana 2 generation via Replicate ────────────────────────────────
  const generateOutfit = async (style: "mannequin" | "flatlay" | "tryon", photoUri?: string) => {
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
        body: JSON.stringify({
          pieces,
          style,
          ...(style === "tryon" && photoUri ? { userPhotoDataUri: photoUri } : {}),
        }),
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
    <div className="h-[calc(100dvh-56px)] md:h-[calc(100vh-64px)] flex flex-col overflow-hidden">


      {/* ─────────────────────────────────────────────────────────────────────
          3-COLUMN BODY
          relative wrapper bounds the AI drawer overlay
      ───────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {/* ── DESKTOP LAYOUT: hidden md:flex flex-col ──────────────────────── */}
        <div className="hidden md:flex md:flex-col md:h-full">

          {/* 3 panels row */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── LEFT PANEL: In this look (~280px) ────────────────────────── */}
          <aside className="flex flex-col border-r border-[var(--border)] bg-[var(--background)] min-h-0 overflow-hidden shrink-0" style={{ width: 280 }}>

            {/* Header */}
            <div className="px-4 pt-4 pb-3 shrink-0 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-0.5">In this look</p>
                <p className="font-display text-[20px] font-light text-[var(--foreground)]">
                  {selectedCount > 0 ? `${selectedCount} piece${selectedCount !== 1 ? "s" : ""}` : "Empty"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={clearAll}
                  className="font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                >
                  Clear All
                </button>
                <button onClick={shareOutfit} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors" title={copied ? "Copied!" : "Share look"}>
                  {copied ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
                      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.3" />
                      <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                      <line x1="10.3" y1="5" x2="5.7" y2="7" stroke="currentColor" strokeWidth="1.3" />
                      <line x1="5.7" y1="9" x2="10.3" y2="11" stroke="currentColor" strokeWidth="1.3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Slot rows */}
            <div className="flex-1 overflow-y-auto">
              {SLOTS.map(slot => {
                const picked = selection[slot.id];
                const variantId = variantOverrides[slot.id];
                const activeVariant = picked?.variants?.find(v => v.id === variantId);
                const colorKey = colorImageOverrides[slot.id];
                const colorImageUrl = colorKey && picked?.colorImages?.[colorKey]?.[0];
                const displayImage = colorImageUrl || activeVariant?.imageUrl || picked?.imageUrl;
                return (
                  <button
                    key={slot.id}
                    onClick={() => { setActiveSlot(slot.id); setCatalogCategory(slot.id); }}
                    className={`w-full grid grid-cols-[56px_1fr_auto] gap-2.5 px-3 py-2 items-center border-b border-[var(--border)] min-h-[76px] text-left transition-colors duration-150 hover:bg-[var(--surface)] ${
                      activeSlot === slot.id ? "bg-[var(--surface)]" : ""
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-[56px] h-[64px] bg-white border border-[var(--border)] shrink-0 overflow-hidden flex items-center justify-center">
                      {displayImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={displayImage} src={displayImage} alt={picked!.name} className="swatch-img-enter w-full h-full object-contain" />
                      ) : (
                        <div className="text-[var(--foreground-subtle)] opacity-30"><SlotIcon id={slot.id} size={16} /></div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="min-w-0">
                      <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-0.5">{slot.label}</p>
                      {picked ? (
                        <>
                          <p className="text-[12px] leading-snug text-[var(--foreground)] truncate">{picked.name}</p>
                          <p className="text-[10px] text-[var(--foreground-muted)] mt-0.5 truncate">{picked.brand}</p>
                          {/* Variant colour swatches (separate products) */}
                          {(picked.variants?.length ?? 0) > 1 && (() => {
                            const variants = picked.variants!;
                            const MAX = 6;
                            const visible = variants.slice(0, MAX);
                            const hidden = variants.length - MAX;
                            const popupKey = `slot-${slot.id}-variant`;
                            return (
                              <div className="relative flex items-center gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                                {visible.map(sw => (
                                  <button key={sw.id} title={sw.colorName}
                                    onClick={e => { e.stopPropagation(); selectVariant(slot.id, sw); }}
                                    className={`w-4 h-4 shrink-0 transition-all duration-200 ${(variantId ?? picked.id) === sw.id ? "scale-125" : "hover:scale-110 opacity-70 hover:opacity-100"}`}
                                    style={{
                                      background: sw.colorHex === "#multicolor" ? "conic-gradient(red,orange,yellow,green,blue,violet,red)" : sw.colorHex,
                                      boxShadow: (variantId ?? picked.id) === sw.id
                                        ? "inset 0 0 0 1px rgba(0,0,0,0.22), 0 0 0 2px var(--background), 0 0 0 3.5px var(--foreground)"
                                        : "inset 0 0 0 1px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(128,128,128,0.35)",
                                    }}
                                  />
                                ))}
                                {hidden > 0 && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setOpenSwatchPopup(openSwatchPopup === popupKey ? null : popupKey); }}
                                    className="w-3.5 h-3.5 shrink-0 flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity"
                                    style={{ boxShadow: "0 0 0 1.5px #fff, 0 0 0 3px rgba(0,0,0,0.22)" }}
                                  >
                                    <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                      <line x1="4" y1="1" x2="4" y2="7" />
                                      <line x1="1" y1="4" x2="7" y2="4" />
                                    </svg>
                                  </button>
                                )}
                                {openSwatchPopup === popupKey && (
                                  <div
                                    onClick={e => e.stopPropagation()}
                                    className="absolute top-full left-0 mt-1 bg-[var(--background)] border border-[var(--border)] p-2 shadow-lg z-50 flex flex-wrap gap-1.5"
                                    style={{ minWidth: "80px", maxWidth: "160px" }}
                                  >
                                    {variants.map(sw => (
                                      <button key={sw.id} title={sw.colorName}
                                        onClick={e => { e.stopPropagation(); selectVariant(slot.id, sw); setOpenSwatchPopup(null); }}
                                        className={`w-4 h-4 shrink-0 transition-all duration-200 ${(variantId ?? picked.id) === sw.id ? "scale-125" : "hover:scale-110 opacity-70 hover:opacity-100"}`}
                                        style={{
                                          background: sw.colorHex === "#multicolor" ? "conic-gradient(red,orange,yellow,green,blue,violet,red)" : sw.colorHex,
                                          boxShadow: (variantId ?? picked.id) === sw.id
                                            ? "inset 0 0 0 1px rgba(0,0,0,0.22), 0 0 0 2px var(--background), 0 0 0 3.5px var(--foreground)"
                                            : "inset 0 0 0 1px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(128,128,128,0.35)",
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {/* colorImages swatches (multiple colours within same product) */}
                          {Object.keys(picked.colorImages ?? {}).length > 1 && (() => {
                            const colorKeys = Object.keys(picked.colorImages!);
                            const MAX = 6;
                            const visibleKeys = colorKeys.slice(0, MAX);
                            const hidden = colorKeys.length - MAX;
                            const popupKey = `slot-${slot.id}-colorImage`;
                            return (
                              <div className="relative flex items-center gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                                {visibleKeys.map(color => {
                                  const img = picked.colorImages![color]?.[0];
                                  const isActive = (colorImageOverrides[slot.id] ?? colorKeys[0]) === color;
                                  return (
                                    <button key={color} title={color}
                                      onClick={e => { e.stopPropagation(); setColorImageOverrides(prev => ({ ...prev, [slot.id]: color })); }}
                                      className={`relative w-4 h-4 overflow-hidden shrink-0 transition-all duration-150 ${isActive ? "ring-2 ring-offset-1 ring-[var(--foreground)] scale-110" : "opacity-60 hover:opacity-100 hover:scale-105"}`}
                                    >
                                      {img && <img src={img} alt={color} className="w-full h-full object-cover" />}
                                    </button>
                                  );
                                })}
                                {hidden > 0 && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setOpenSwatchPopup(openSwatchPopup === popupKey ? null : popupKey); }}
                                    className="w-3.5 h-3.5 shrink-0 flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity"
                                    style={{ boxShadow: "0 0 0 1.5px #fff, 0 0 0 3px rgba(0,0,0,0.22)" }}
                                  >
                                    <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                      <line x1="4" y1="1" x2="4" y2="7" />
                                      <line x1="1" y1="4" x2="7" y2="4" />
                                    </svg>
                                  </button>
                                )}
                                {openSwatchPopup === popupKey && (
                                  <div
                                    onClick={e => e.stopPropagation()}
                                    className="absolute top-full left-0 mt-1 bg-[var(--background)] border border-[var(--border)] p-2 shadow-lg z-50 flex flex-wrap gap-1.5"
                                    style={{ minWidth: "80px", maxWidth: "160px" }}
                                  >
                                    {colorKeys.map(color => {
                                      const img = picked.colorImages![color]?.[0];
                                      const isActive = (colorImageOverrides[slot.id] ?? colorKeys[0]) === color;
                                      return (
                                        <button key={color} title={color}
                                          onClick={e => { e.stopPropagation(); setColorImageOverrides(prev => ({ ...prev, [slot.id]: color })); setOpenSwatchPopup(null); }}
                                          className={`relative w-4 h-4 overflow-hidden shrink-0 transition-all duration-150 ${isActive ? "ring-2 ring-offset-1 ring-[var(--foreground)] scale-110" : "opacity-60 hover:opacity-100 hover:scale-105"}`}
                                        >
                                          {img && <img src={img} alt={color} className="w-full h-full object-cover" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
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

            {/* Footer: Total + Share Look + Clear Look */}
            <div className="shrink-0 border-t border-[var(--border)] px-3 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
                  Total ({selectedCount} {selectedCount === 1 ? "item" : "items"})
                </p>
                <p className={`font-display font-light transition-all ${selectedCount > 0 ? "text-[18px] text-[var(--foreground)]" : "text-[16px] text-[var(--foreground-subtle)]"}`}>
                  {selectedCount > 0 ? formatPrice(totalPrice) : "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={shareOutfit}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 border border-[var(--border-strong)] font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1L14 7M14 7H10M14 7V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 10v4a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  {copied ? "Copied!" : "Share Look"}
                </button>
                <button
                  onClick={clearAll}
                  disabled={selectedCount === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 border border-[var(--border-strong)] font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M3 6H13L12 14H4L3 6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M1 3H15M6 3V2H10V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  Clear Look
                </button>
              </div>
            </div>
          </aside>

          {/* ── CENTER PANEL: Search + chips + product grid (flex-1) ─────── */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[var(--background)]">

            {/* Search bar */}
            <div className="shrink-0 px-4 pt-3 pb-2 border-b border-[var(--border)]">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] pointer-events-none">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products, brands, or categories..."
                  className="w-full h-10 bg-[var(--surface)] border border-[var(--border)] focus:border-[var(--border-strong)] outline-none pl-9 pr-8 text-[12px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Category chips + sort/filter row */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {/* Category chips */}
              <div className="flex items-center gap-1.5 flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {CATALOG_CHIPS.map(({ label, value }) => {
                  const isActive = catalogCategory === value;
                  return (
                    <button
                      key={label}
                      onClick={() => setCatalogCategory(isActive ? null : value)}
                      className={`shrink-0 px-3 py-1 rounded-full border font-mono text-[9px] tracking-[0.1em] uppercase whitespace-nowrap transition-all duration-150 ${
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
              {/* Sort select */}
              <div className="shrink-0 flex items-center gap-1.5">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="bg-transparent border border-[var(--border)] outline-none text-xs text-[var(--foreground)] px-2 py-1.5 cursor-pointer"
                >
                  <option value="featured">SORT | Featured</option>
                  <option value="new-in">SORT | Newest</option>
                  <option value="price-asc">SORT | Price ↑</option>
                  <option value="price-desc">SORT | Price ↓</option>
                </select>
                {/* Filters toggle button */}
                <button
                  onClick={() => setFiltersOpen(v => !v)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 border font-mono text-[9px] tracking-[0.12em] uppercase transition-all duration-150 ${
                    filtersOpen
                      ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                      : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="1" y1="3.5" x2="13" y2="3.5" />
                    <line x1="3" y1="7" x2="11" y2="7" />
                    <line x1="5" y1="10.5" x2="9" y2="10.5" />
                  </svg>
                  Filters
                  {hasActiveFilters && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] absolute top-1 right-1" />
                  )}
                </button>
              </div>
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
                    {expandedCatalogItems.map(item => {
                      const { product, forcedVariant } = item;
                      const matchingSlots = SLOTS.filter(s => s.categories.includes(product.category));
                      const selectedSlot = matchingSlots.find(s => selection[s.id]?.id === product.id);
                      const isSelected = !!selectedSlot;
                      const variantId = selectedSlot ? variantOverrides[selectedSlot.id] : undefined;
                      const targetSlot = selectedSlot ?? matchingSlots[0];
                      const previewVariantId = catalogPreviews[product.id];
                      const activeVariant = product.variants?.find(v => v.id === (previewVariantId ?? variantId));
                      const colorImageKeys = Object.keys(product.colorImages ?? {});
                      const hasColorImages = colorImageKeys.length > 1;
                      const selectedColorKey = catalogColorPreviews[product.id] ?? colorImageKeys[0];
                      const colorImageUrl = hasColorImages && product.colorImages![selectedColorKey]?.[0]
                        ? product.colorImages![selectedColorKey][0]
                        : null;
                      const displayImage = forcedVariant?.imageUrl ?? colorImageUrl ?? activeVariant?.imageUrl ?? product.imageUrl;
                      const hasVariants = (product.variants?.length ?? 0) > 1;

                      return (
                        <div
                          key={item.key}
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
                            {/* Colour swatches — slide up on hover */}
                            {hasColorImages && (
                              <div
                                className="absolute bottom-0 left-0 right-0 pointer-events-none group-hover:pointer-events-auto"
                                onClick={e => e.stopPropagation()}
                              >
                                <div className="translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out flex gap-1 p-1.5 pt-5 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
                                  {colorImageKeys.map((color, idx) => {
                                    const previewImg = product.colorImages![color]?.[0];
                                    const isActive = selectedColorKey === color;
                                    return (
                                      <button
                                        key={color}
                                        title={color}
                                        onClick={e => {
                                          e.stopPropagation();
                                          setCatalogColorPreviews(prev => ({ ...prev, [product.id]: color }));
                                          if (isSelected && targetSlot) {
                                            setColorImageOverrides(prev => ({ ...prev, [targetSlot.id]: color }));
                                          }
                                        }}
                                        style={{ transitionDelay: `${idx * 25}ms` }}
                                        className={`relative w-6 h-6 shrink-0 overflow-hidden border transition-all duration-200 ${
                                          isActive
                                            ? "border-white scale-110 shadow-md"
                                            : "border-white/50 hover:border-white hover:scale-105"
                                        }`}
                                      >
                                        {previewImg
                                          // eslint-disable-next-line @next/next/no-img-element
                                          ? <img src={previewImg} alt={color} className="w-full h-full object-cover" />
                                          : <span className="text-[6px] text-white leading-none capitalize block mt-1 text-center">{color[0]}</span>
                                        }
                                      </button>
                                    );
                                  })}
                                </div>
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
                            {hasVariants && (() => {
                              const variants = product.variants!;
                              const MAX = 5;
                              const visible = variants.slice(0, MAX);
                              const hidden = variants.length - MAX;
                              const popupKey = `catalog-${product.id}-variant`;
                              return (
                                <div className="relative flex items-center gap-1 mt-1" onClick={e => e.stopPropagation()}>
                                  {visible.map(swatch => {
                                    const activeId = catalogPreviews[product.id] ?? (isSelected ? variantId : null) ?? forcedVariant?.id ?? product.id;
                                    const isSwatchActive = activeId === swatch.id;
                                    return (
                                      <button
                                        key={swatch.id}
                                        title={swatch.colorName}
                                        onClick={e => {
                                          e.stopPropagation();
                                          setCatalogPreviews(prev => ({ ...prev, [product.id]: swatch.id }));
                                          if (isSelected && targetSlot) selectVariant(targetSlot.id, swatch);
                                        }}
                                        className={`w-3.5 h-3.5 shrink-0 transition-all duration-150 ${isSwatchActive ? "scale-110" : "hover:scale-105"}`}
                                        style={{
                                          background: swatch.colorHex === "#multicolor"
                                            ? "conic-gradient(red, orange, yellow, green, blue, violet, red)"
                                            : swatch.colorHex,
                                          boxShadow: isSwatchActive
                                            ? "0 0 0 2px #fff, 0 0 0 4px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.08)"
                                            : "0 0 0 1.5px #fff, 0 0 0 3px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(0,0,0,0.08)",
                                        }}
                                      />
                                    );
                                  })}
                                  {hidden > 0 && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setOpenSwatchPopup(openSwatchPopup === popupKey ? null : popupKey); }}
                                      className="w-3.5 h-3.5 shrink-0 flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity"
                                      style={{ boxShadow: "0 0 0 1.5px #fff, 0 0 0 3px rgba(0,0,0,0.22)" }}
                                    >
                                      <svg width="7" height="7" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <line x1="4" y1="1" x2="4" y2="7" />
                                        <line x1="1" y1="4" x2="7" y2="4" />
                                      </svg>
                                    </button>
                                  )}
                                  {openSwatchPopup === popupKey && (
                                    <div
                                      onClick={e => e.stopPropagation()}
                                      className="absolute bottom-full left-0 mb-1 bg-[var(--background)] border border-[var(--border)] p-2 shadow-lg z-50 flex flex-wrap gap-1.5"
                                      style={{ minWidth: "80px", maxWidth: "140px" }}
                                    >
                                      {variants.map(swatch => {
                                        const activeId = catalogPreviews[product.id] ?? (isSelected ? variantId : null) ?? forcedVariant?.id ?? product.id;
                                        const isSwatchActive = activeId === swatch.id;
                                        return (
                                          <button
                                            key={swatch.id}
                                            title={swatch.colorName}
                                            onClick={e => {
                                              e.stopPropagation();
                                              setCatalogPreviews(prev => ({ ...prev, [product.id]: swatch.id }));
                                              if (isSelected && targetSlot) selectVariant(targetSlot.id, swatch);
                                              setOpenSwatchPopup(null);
                                            }}
                                            className={`w-3.5 h-3.5 shrink-0 transition-all duration-150 ${isSwatchActive ? "scale-110" : "hover:scale-105"}`}
                                            style={{
                                              background: swatch.colorHex === "#multicolor"
                                                ? "conic-gradient(red, orange, yellow, green, blue, violet, red)"
                                                : swatch.colorHex,
                                              boxShadow: isSwatchActive
                                                ? "0 0 0 2px #fff, 0 0 0 4px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.08)"
                                                : "0 0 0 1.5px #fff, 0 0 0 3px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(0,0,0,0.08)",
                                            }}
                                          />
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* ── FILTERS PANEL: slides in from right (280px) ───────────────── */}
          <div
            className="shrink-0 overflow-hidden border-l border-[var(--border)] bg-[var(--background)] transition-all duration-200 flex flex-col"
            style={{ width: filtersOpen ? 280 : 0 }}
          >
            <div className="w-[280px] flex flex-col overflow-y-auto h-full">

              {/* Header */}
              <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground)]">Filters</p>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                    <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* CATEGORY */}
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] mb-2">Category</p>
                <select
                  value={catalogCategory ?? ""}
                  onChange={e => setCatalogCategory(e.target.value || null)}
                  className="bg-transparent border border-[var(--border)] outline-none text-xs text-[var(--foreground)] px-3 py-2 w-full cursor-pointer"
                >
                  <option value="">All</option>
                  {CATALOG_CHIPS.filter(c => c.value !== null).map(({ label, value }) => (
                    <option key={label} value={value!}>{label}</option>
                  ))}
                </select>
              </div>

              {/* PRICE */}
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] mb-2">Price</p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-[var(--foreground-subtle)]">$0</span>
                  <span className="text-[11px] font-medium text-[var(--foreground)]">
                    {maxPrice !== null && maxPrice < 2000 ? `$${maxPrice.toLocaleString()}` : "$2,000+"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={50}
                  value={maxPrice ?? 2000}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setMaxPrice(val >= 2000 ? null : val === 0 ? 1 : val);
                  }}
                  className="w-full h-1 cursor-pointer mb-3"
                  style={{ accentColor: "var(--foreground)" }}
                />
                <div className="flex flex-wrap gap-1.5">
                  {PRICE_BUCKETS.map(({ label, max }) => (
                    <button
                      key={label}
                      onClick={() => setMaxPrice(maxPrice === max ? null : max)}
                      className={`px-2.5 py-1 rounded-full border font-mono text-[8px] tracking-[0.08em] uppercase transition-all ${
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

              {/* GENDER */}
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] mb-2">Gender</p>
                <select
                  value={selectedGender ?? ""}
                  onChange={e => setSelectedGender((e.target.value || null) as typeof selectedGender)}
                  className="bg-transparent border border-[var(--border)] outline-none text-xs text-[var(--foreground)] px-3 py-2 w-full cursor-pointer"
                >
                  <option value="">All</option>
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="unisex">Unisex</option>
                </select>
              </div>

              {/* COLORS */}
              <div className="border-b border-[var(--border)] px-4 py-3">
                <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] mb-2">Colors</p>
                <div className="flex flex-wrap gap-2">
                  {(showAllColors ? availableColors : availableColors.slice(0, 6)).map(({ name, hex }) => {
                    const isActive = selectedColors.includes(name);
                    return (
                      <button
                        key={name}
                        title={name}
                        onClick={() => setSelectedColors(prev => isActive ? prev.filter(c => c !== name) : [...prev, name])}
                        className={`w-6 h-6 rounded-full shrink-0 transition-all ${isActive ? "scale-110" : "opacity-75 hover:opacity-100 hover:scale-105"}`}
                        style={{
                          background: hex === "#multicolor" ? "conic-gradient(red,orange,yellow,green,blue,violet,red)" : hex,
                          boxShadow: isActive
                            ? "0 0 0 2px var(--background), 0 0 0 3.5px var(--foreground)"
                            : "inset 0 0 0 1px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.06)",
                        }}
                      />
                    );
                  })}
                </div>
                {availableColors.length > 6 && (
                  <button
                    onClick={() => setShowAllColors(v => !v)}
                    className="mt-2 text-[10px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
                  >
                    {showAllColors ? "Show less" : `Show ${availableColors.length - 6} more`}
                  </button>
                )}
              </div>

              {/* BRANDS */}
              {availableBrands.length > 0 && (
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] mb-2">Brands</p>
                  {/* Brand search */}
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={brandSearch}
                      onChange={e => setBrandSearch(e.target.value)}
                      placeholder="Search brands…"
                      className="w-full bg-[var(--surface)] border border-[var(--border)] px-2 py-1.5 text-[11px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--border-strong)] transition-colors"
                    />
                    {brandSearch && (
                      <button
                        onClick={() => setBrandSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                      >
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M1 1L9 9M9 1L1 9" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {/* Brand list */}
                  <div className="flex flex-col gap-0.5">
                    {availableBrands
                      .filter(b => !brandSearch || b.toLowerCase().includes(brandSearch.toLowerCase()))
                      .slice(0, showAllBrands ? undefined : 8)
                      .map(brand => {
                        const isActive = selectedBrands.includes(brand);
                        return (
                          <label
                            key={brand}
                            className="flex items-center gap-2 px-1 py-1 cursor-pointer hover:bg-[var(--surface)] transition-colors"
                          >
                            <div
                              className={`flex items-center justify-center shrink-0 border transition-colors ${
                                isActive ? "bg-[var(--foreground)] border-[var(--foreground)]" : "border-[var(--border-strong)] bg-transparent"
                              }`}
                              style={{ width: 14, height: 14 }}
                            >
                              {isActive && (
                                <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <button
                              onClick={() => setSelectedBrands(prev => isActive ? prev.filter(b => b !== brand) : [...prev, brand])}
                              className={`text-[11px] truncate text-left ${isActive ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}
                            >
                              {brand}
                            </button>
                          </label>
                        );
                      })}
                    {availableBrands.filter(b => !brandSearch || b.toLowerCase().includes(brandSearch.toLowerCase())).length === 0 && (
                      <p className="px-1 py-2 text-[11px] text-[var(--foreground-subtle)]">No brands found</p>
                    )}
                  </div>
                  {/* Show more brands */}
                  {availableBrands.filter(b => !brandSearch || b.toLowerCase().includes(brandSearch.toLowerCase())).length > 8 && (
                    <button
                      onClick={() => setShowAllBrands(v => !v)}
                      className="mt-1.5 text-[10px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
                    >
                      {showAllBrands
                        ? "Show less"
                        : `Show ${availableBrands.filter(b => !brandSearch || b.toLowerCase().includes(brandSearch.toLowerCase())).length - 8} more`}
                    </button>
                  )}
                </div>
              )}

              {/* Clear filters button — shown when active */}
              {hasActiveFilters && (
                <div className="px-4 py-3 shrink-0 border-t border-[var(--border)] mt-auto sticky bottom-0 bg-[var(--background)]">
                  <button
                    onClick={clearFilters}
                    className="w-full py-2 border border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] font-mono text-[9px] tracking-[0.14em] uppercase transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              )}

            </div>
          </div>

          </div>{/* end 3 panels row */}

          {/* ── DESKTOP BOTTOM ACTION BAR ───────────────────────────────────── */}
          <div className="shrink-0 h-[52px] border-t border-[var(--border)] bg-[var(--background)] flex items-center justify-between px-0">
            {/* Left area matching left panel width */}
            <div className="flex items-center px-5" style={{ width: 280 }}>
              <p className="font-mono text-[11px] text-[var(--foreground-muted)]">
                {selectedCount > 0
                  ? `${selectedCount} piece${selectedCount !== 1 ? "s" : ""} · ${uniqueBrandCount} brand${uniqueBrandCount !== 1 ? "s" : ""}`
                  : "Add pieces to build your look"}
              </p>
            </div>
            {/* Right area: Generate + Save + Shop the Look */}
            <div className="flex items-center gap-2.5 px-5">
              {/* Generate */}
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
                    {selectedCount > 0 && <span>→</span>}
                  </>
                )}
              </button>
            </div>
          </div>

        </div>{/* end hidden md:flex md:flex-col md:h-full */}

        {/* ── MOBILE LAYOUT ─────────────────────────────────────────────────
            Hero canvas + bottom-sheet catalog panel.
        ───────────────────────────────────────────────────────────────────── */}
        <div className="md:hidden h-full flex flex-col overflow-hidden">

          {/* Mobile top header: back + ai stylist + save */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-[#0f0f0f]">
            <Link
              href="/"
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/15 transition-colors active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            {/* AI Stylist + Save — same pill shape, side by side */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleStylist}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-200 active:scale-95 ${
                  stylistOpen
                    ? "bg-white text-black border-white"
                    : "bg-white/10 text-white/70 border-white/20 hover:bg-white/15"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 1.5L9.5 6H14L10.5 8.5L11.8 13L8 10.5L4.2 13L5.5 8.5L2 6H6.5L8 1.5Z" />
                </svg>
                <span className="text-[9px] tracking-[0.1em] uppercase font-medium leading-none">AI Stylist</span>
              </button>
              <button
                onClick={handleMobileSave}
                disabled={selectedCount === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] tracking-[0.1em] uppercase font-medium leading-none transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
                  saved
                    ? "bg-white/20 text-white border-white/40"
                    : "bg-white/10 text-white/70 border-white/20 hover:bg-white/15"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3.5L9.5 7H13L10.5 9L11.5 12.5L8 10.5L4.5 12.5L5.5 9L3 7H6.5L8 3.5Z" />
                </svg>
                {saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>

          {/* 1. Hero canvas */}
          <div className="relative min-h-0 bg-[#0f0f0f] overflow-hidden" style={{ flex: "0 0 34%" }}>

            {/* Outfit silhouette figure */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-full" style={{ width: 230 }}>

                {/* Main stacked figure */}
                <div className="absolute inset-y-4 left-0 flex flex-col" style={{ width: 185 }}>
                  {FIGURE_SLOTS.map(({ id, label, flex }) => {
                    const picked = selection[id];
                    const variantId = variantOverrides[id];
                    const activeVariant = picked?.variants?.find(v => v.id === variantId);
                    const colorKey = colorImageOverrides[id];
                    const colorImageUrl = colorKey && picked?.colorImages?.[colorKey]?.[0];
                    const displayImage = colorImageUrl || activeVariant?.imageUrl || picked?.imageUrl;
                    return (
                      <button
                        key={id}
                        onClick={() => { setActiveSlot(id); setCatalogCategory(id); }}
                        style={{ flex }}
                        className={`relative overflow-hidden transition-all ${
                          activeSlot === id ? "ring-1 ring-inset ring-white/30 z-10" : ""
                        }`}
                      >
                        {!picked && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
                            <div className="text-white/15"><SlotIcon id={id} size={13} /></div>
                            <p className="font-mono text-[7px] tracking-[0.1em] uppercase text-white/15">{label}</p>
                          </div>
                        )}
                        {displayImage && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={displayImage}
                            alt={picked!.name}
                            className={`absolute inset-0 w-full h-full ${
                              id === "shoes" ? "object-contain p-2" : "object-contain"
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Accessories — two floating mini panels */}
                <div className="absolute right-0 flex flex-col gap-2" style={{ top: "50%", transform: "translateY(-50%)" }}>
                  {(["accessories", "accessories2"] as SlotId[]).map(id => {
                    const picked = selection[id];
                    const displayImage = picked?.imageUrl;
                    return (
                      <button
                        key={id}
                        onClick={() => { setActiveSlot(id); setCatalogCategory("accessories"); }}
                        className={`relative overflow-hidden border transition-all ${
                          activeSlot === id ? "border-white/30 ring-1 ring-white/20" : "border-white/10"
                        }`}
                        style={{ width: 38, height: 46 }}
                      >
                        {!picked && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-white/15"><SlotIcon id={id} size={9} /></div>
                          </div>
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

            {/* Left colour panel — slides in when active item has colour variants */}
            {(() => {
              const activeProduct = selection[activeSlot];
              const variants = activeProduct?.variants ?? [];
              const colorImgKeys = Object.keys(activeProduct?.colorImages ?? {});
              const useVariants = variants.length > 1;
              const useColorImages = !useVariants && colorImgKeys.length > 1;
              const hasColors = useVariants || useColorImages;

              type SwatchEntry = { id: string; hex: string | null; name: string; imgUrl?: string; isVariant: boolean };
              const colors: SwatchEntry[] = useVariants
                ? variants.map(v => ({ id: v.id, hex: v.colorHex, name: v.colorName, isVariant: true }))
                : colorImgKeys.map(k => ({ id: k, hex: null, name: k, imgUrl: activeProduct!.colorImages![k]?.[0], isVariant: false }));

              const activeId = useVariants
                ? (variantOverrides[activeSlot] ?? activeProduct?.id ?? "")
                : (colorImageOverrides[activeSlot] ?? colorImgKeys[0] ?? "");

              return (
                <div
                  className={`absolute left-3 top-1/2 -translate-y-1/2 z-10 flex flex-col rounded-[22px] transition-all duration-300 ease-out ${
                    hasColors && activeProduct ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"
                  }`}
                  style={{ background: "rgba(38,38,38,0.92)", boxShadow: "0 2px 16px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.07)", width: 56, maxHeight: "calc(100% - 32px)" }}
                >
                  <div
                    className="flex flex-col items-center gap-2 overflow-y-auto overflow-x-hidden py-3 px-2"
                    style={{ scrollbarWidth: "none", touchAction: "pan-y", overscrollBehavior: "contain" }}
                  >
                    {colors.map(color => {
                      const isActive = color.id === activeId;
                      return (
                        <button
                          key={color.id}
                          title={color.name}
                          onClick={() => {
                            if (color.isVariant) {
                              const swatch = variants.find(v => v.id === color.id);
                              if (swatch) selectVariant(activeSlot, swatch);
                            } else {
                              setColorImageOverrides(prev => ({ ...prev, [activeSlot]: color.id }));
                            }
                          }}
                          className={`relative w-8 h-8 rounded-full shrink-0 transition-all duration-200 ${isActive ? "scale-110" : "opacity-55 active:opacity-80 active:scale-105"}`}
                          style={{
                            background: color.hex === "#multicolor"
                              ? "conic-gradient(red,orange,yellow,green,blue,violet,red)"
                              : color.hex
                              ? color.hex
                              : color.imgUrl
                              ? `url(${color.imgUrl}) center/cover`
                              : "#555",
                            boxShadow: isActive
                              ? "inset 0 0 0 1px rgba(0,0,0,0.25), 0 0 0 2px #c9a84c, 0 0 0 3.5px rgba(201,168,76,0.25)"
                              : "inset 0 0 0 1px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.10)",
                          }}
                        >
                          {isActive && (
                            <svg className="absolute inset-0 m-auto w-3.5 h-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" viewBox="0 0 16 16" fill="none">
                              <path d="M3 8.5L6.5 12L13 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

          </div>

          {/* Price + Clear + Generate bar */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-1.5 bg-[#0f0f0f] border-t border-white/5">
            <div>
              <p className="text-white/40 text-[9px] mb-0.5 font-mono tracking-[0.12em] uppercase">Total price</p>
              <div className="flex items-center gap-1.5">
                <p className={`font-light leading-none transition-all ${
                  selectedCount > 0 ? "text-[20px] text-white" : "text-[16px] text-white/30"
                }`}>
                  {selectedCount > 0 ? formatPrice(totalPrice) : "—"}
                </p>
                {selectedCount > 0 && (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-white/35 shrink-0">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Clear — gray when empty, red when items added */}
              <button
                onClick={selectedCount > 0 ? clearAll : undefined}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-medium whitespace-nowrap border transition-all active:scale-95 ${
                  selectedCount > 0
                    ? "text-red-400 border-red-400/40 bg-red-400/10 hover:bg-red-400/20 cursor-pointer"
                    : "text-white/20 border-white/10 bg-transparent cursor-default"
                }`}
              >
                Clear
              </button>
            {selectedCount >= 1 && (
              <button
                onClick={openStylePicker}
                disabled={generating}
                className="flex items-center gap-2 bg-white/10 border border-white/15 text-white/90 px-4 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-all hover:bg-white/15 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1L7.2 4.8H11L8 7.2L9.1 11L6 8.8L2.9 11L4 7.2L1 4.8H4.8L6 1Z"
                      stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                  </svg>
                )}
                {generating ? "Generating…" : "Generate"}
              </button>
            )}
            </div>
          </div>

          {/* 2. Bottom sheet panel */}
          <div className="relative flex flex-col bg-[var(--background)] min-h-0 flex-1">

            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-0 shrink-0">
              <div className="w-8 h-[3px] rounded-full bg-[var(--border-strong)]" />
            </div>

            {/* Filters toolbar */}
            <div className="shrink-0 px-4 py-2 border-b border-[var(--border)]">
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className={`flex items-center gap-1.5 px-3.5 h-8 rounded-full border text-[12px] font-medium transition-all active:scale-95 ${
                  hasActiveFilters
                    ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                    : "border-[var(--border-strong)] text-[var(--foreground-muted)]"
                }`}
              >
                <svg width="13" height="10" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="1" y1="1.5" x2="13" y2="1.5" />
                  <line x1="3" y1="5.5" x2="11" y2="5.5" />
                  <line x1="5" y1="9.5" x2="9" y2="9.5" />
                </svg>
                Filters
                {activeFilterCount > 0 && <span className="text-[10px] opacity-80">· {activeFilterCount}</span>}
              </button>
            </div>

            {/* Category tabs */}
            <div className="shrink-0 flex gap-4 px-4 overflow-x-auto border-b border-[var(--border)]" style={{ scrollbarWidth: "none" }}>
              {MOBILE_CHIPS.map(({ label, value }) => {
                const isActive = catalogCategory === value && !likedOnly;
                return (
                  <button
                    key={label}
                    onClick={() => { setCatalogCategory(catalogCategory === value ? null : value); setLikedOnly(false); }}
                    className={`shrink-0 pb-2 pt-1 font-medium text-[13px] border-b-2 -mb-px transition-all whitespace-nowrap ${
                      isActive
                        ? "border-[var(--foreground)] text-[var(--foreground)]"
                        : "border-transparent text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              {/* Liked tab */}
              <button
                onClick={() => { setLikedOnly(v => !v); setCatalogCategory(null); }}
                className={`shrink-0 pb-2 pt-1 font-medium text-[13px] border-b-2 -mb-px transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  likedOnly
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill={likedOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.57 3.07 2 5 2C6.19 2 7.24 2.61 8 3.5C8.76 2.61 9.81 2 11 2C12.93 2 14.5 3.57 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z" />
                </svg>
                Liked
              </button>
            </div>


            {/* Horizontal product scroll */}
            <div ref={mobileScrollRef} className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: "none" }}>
              {expandedCatalogItems.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] opacity-50">
                    {search ? "No results" : "No items"}
                  </p>
                </div>
              ) : (
                <div className="flex gap-2.5 px-4 py-2 items-start">
                  {expandedCatalogItems.map(item => {
                    const { product, forcedVariant } = item;
                    const matchingSlots = SLOTS.filter(s => s.categories.includes(product.category));
                    const selectedSlot = matchingSlots.find(s => selection[s.id]?.id === product.id);
                    const isSelected = !!selectedSlot;
                    const variantId = selectedSlot ? variantOverrides[selectedSlot.id] : undefined;
                    const previewVariantId = catalogPreviews[product.id];
                    const activeVariant = product.variants?.find(v => v.id === (previewVariantId ?? variantId));
                    const colorImageKeys = Object.keys(product.colorImages ?? {});
                    const hasColorImages = colorImageKeys.length > 1;
                    const selectedColorKey = catalogColorPreviews[product.id] ?? colorImageKeys[0];
                    const colorImageUrl = hasColorImages && product.colorImages![selectedColorKey]?.[0]
                      ? product.colorImages![selectedColorKey][0]
                      : null;
                    const displayImage = forcedVariant?.imageUrl ?? colorImageUrl ?? activeVariant?.imageUrl ?? product.imageUrl;

                    return (
                      <div key={item.key} className="shrink-0 flex flex-col" style={{ width: 108 }}>
                        {/* Image area */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => selectProduct(product)}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectProduct(product); } }}
                          className={`relative overflow-hidden bg-white cursor-pointer transition-all ${
                            isSelected ? "ring-1 ring-[#c9a84c]" : ""
                          }`}
                          style={{ width: 108, height: 120 }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={displayImage}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-contain"
                          />
                          {/* Selected indicator */}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#c9a84c] flex items-center justify-center pointer-events-none">
                              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="pt-1.5">
                          <p className="text-[10px] font-medium text-[var(--foreground)] leading-snug line-clamp-2">{product.name}</p>
                          <p className="font-mono text-[9px] text-[var(--foreground-muted)] mt-0.5">{formatPrice(product.priceMin)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* ── MOBILE SAVE MODAL ─────────────────────────────────────────────── */}
      {showSaveModal && (
        <div className="md:hidden fixed inset-0 z-[60] flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSaveModal(false)}
          />
          {/* Sheet */}
          <div className="relative w-full bg-[var(--background)] rounded-t-2xl px-5 pb-8 pt-5 animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center mb-4">
              <div className="w-8 h-[3px] rounded-full bg-[var(--border-strong)]" />
            </div>

            {/* Outfit preview — small thumbnails of selected pieces */}
            <div className="flex gap-2 justify-center mb-5">
              {SLOTS.map(slot => {
                const picked = selection[slot.id];
                const variantId = variantOverrides[slot.id];
                const activeVariant = picked?.variants?.find(v => v.id === variantId);
                const colorKey = colorImageOverrides[slot.id];
                const colorImageUrl = colorKey && picked?.colorImages?.[colorKey]?.[0];
                const displayImage = colorImageUrl || activeVariant?.imageUrl || picked?.imageUrl;
                if (!picked) return null;
                return (
                  <div key={slot.id} className="w-16 h-20 bg-white overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={displayImage!} alt={picked.name} className="w-full h-full object-contain" />
                  </div>
                );
              })}
            </div>

            {/* Message */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-1">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="#c9a84c" stroke="none">
                  <path d="M7 12C7 12 1.5 8.5 1.5 5C1.5 3.34 2.84 2 4.5 2C5.56 2 6.48 2.56 7 3.38C7.52 2.56 8.44 2 9.5 2C11.16 2 12.5 3.34 12.5 5C12.5 8.5 7 12 7 12Z" />
                </svg>
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--foreground)]">Look saved</p>
              </div>
              <p className="text-[12px] text-[var(--foreground-subtle)]">Added to your saved looks</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Link
                href="/saved"
                onClick={() => setShowSaveModal(false)}
                className="w-full h-11 bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center font-mono text-[10px] tracking-[0.18em] uppercase rounded-full"
              >
                View saved looks →
              </Link>
              <button
                onClick={() => setShowSaveModal(false)}
                className="w-full h-11 border border-[var(--border-strong)] text-[var(--foreground-muted)] flex items-center justify-center font-mono text-[10px] tracking-[0.14em] uppercase rounded-full"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE FILTERS BOTTOM SHEET ───────────────────────────────────── */}
      {mobileFiltersOpen && (
        <div className="md:hidden fixed inset-0 z-[70] flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileFiltersOpen(false)}
          />
          {/* Sheet */}
          <div className="relative bg-[var(--background)] rounded-t-2xl flex flex-col" style={{ maxHeight: "90dvh" }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 shrink-0">
              <div className="w-8 h-[3px] rounded-full bg-[var(--border-strong)]" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0">
              <p className="text-[17px] font-medium text-[var(--foreground)]">Filters</p>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Scrollable sections */}
            <div className="overflow-y-auto flex-1 px-5" style={{ WebkitOverflowScrolling: "touch" }}>

              {/* Sort by */}
              <div className="mb-7">
                <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] mb-3">Sort by</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "featured", label: "Featured" },
                    { value: "new-in", label: "New In" },
                    { value: "price-asc", label: "Price: Low to High" },
                    { value: "price-desc", label: "Price: High to Low" },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setSortBy(value)}
                      className={`px-4 py-2 rounded-full border text-[13px] font-medium transition-all active:scale-95 ${
                        sortBy === value
                          ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                          : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="mb-7">
                <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] mb-3">Category</p>
                <div className="flex flex-wrap gap-2">
                  {MOBILE_CHIPS.map(({ label, value }) => (
                    <button
                      key={label}
                      onClick={() => setCatalogCategory(catalogCategory === value ? null : value)}
                      className={`px-4 py-2 rounded-full border text-[13px] font-medium transition-all active:scale-95 ${
                        catalogCategory === value
                          ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                          : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price range */}
              <div className="mb-7">
                <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] mb-3">Price range</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] text-[var(--foreground-subtle)]">$0</span>
                  <span className="text-[12px] font-medium text-[var(--foreground)]">
                    {maxPrice !== null && maxPrice < 2000 ? `$${maxPrice.toLocaleString()}` : "$2,000+"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={50}
                  value={maxPrice ?? 2000}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setMaxPrice(val >= 2000 ? null : val === 0 ? 1 : val);
                  }}
                  className="w-full h-1 accent-[var(--foreground)] cursor-pointer"
                  style={{ accentColor: "var(--foreground)" }}
                />
              </div>

              {/* Gender */}
              <div className="mb-7">
                <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] mb-3">Gender</p>
                <div className="flex flex-wrap gap-2">
                  {([null, "men", "women", "unisex"] as (Gender | null)[]).map(g => (
                    <button
                      key={g ?? "all"}
                      onClick={() => setSelectedGender(g)}
                      className={`px-4 py-2 rounded-full border text-[13px] font-medium transition-all active:scale-95 capitalize ${
                        selectedGender === g
                          ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                          : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {g === null ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div className="mb-7">
                <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] mb-3">Color</p>
                <div className="flex flex-wrap gap-3">
                  {availableColors.map(({ name, hex }) => {
                    const isActive = selectedColors.includes(name);
                    return (
                      <button
                        key={name}
                        title={name}
                        onClick={() => setSelectedColors(prev => isActive ? prev.filter(c => c !== name) : [...prev, name])}
                        className={`w-9 h-9 rounded-full shrink-0 transition-all active:scale-95 ${isActive ? "scale-110" : "opacity-75 hover:opacity-100 hover:scale-105"}`}
                        style={{
                          background: hex === "#multicolor" ? "conic-gradient(red,orange,yellow,green,blue,violet,red)" : hex,
                          boxShadow: isActive
                            ? "0 0 0 2.5px var(--background), 0 0 0 4px var(--foreground)"
                            : "inset 0 0 0 1px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.06)",
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Brand */}
              <div className="mb-4">
                <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] mb-3">Brand</p>
                {/* Brand search */}
                <div className="relative mb-3">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] pointer-events-none">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    value={brandSearch}
                    onChange={e => setBrandSearch(e.target.value)}
                    placeholder="Search brand"
                    className="w-full h-10 bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-9 pr-4 text-[13px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--border-strong)] transition-colors"
                  />
                </div>
                {/* Brand list */}
                <div>
                  {availableBrands
                    .filter(b => !brandSearch || b.toLowerCase().includes(brandSearch.toLowerCase()))
                    .map(brand => {
                      const isActive = selectedBrands.includes(brand);
                      return (
                        <button
                          key={brand}
                          onClick={() => setSelectedBrands(prev => isActive ? prev.filter(b => b !== brand) : [...prev, brand])}
                          className="w-full flex items-center justify-between py-3.5 border-b border-[var(--border)] text-left active:bg-[var(--surface)] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex items-center justify-center shrink-0 border transition-colors ${
                                isActive ? "bg-[var(--foreground)] border-[var(--foreground)]" : "border-[var(--border-strong)] bg-transparent"
                              }`}
                              style={{ width: 18, height: 18 }}
                            >
                              {isActive && (
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-[14px] ${isActive ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>
                              {brand}
                            </span>
                          </div>
                          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="text-[var(--foreground-subtle)] shrink-0">
                            <path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      );
                    })
                  }
                  {availableBrands.filter(b => !brandSearch || b.toLowerCase().includes(brandSearch.toLowerCase())).length === 0 && (
                    <p className="py-3 text-[13px] text-[var(--foreground-subtle)]">No brands found</p>
                  )}
                </div>
              </div>

            </div>

            {/* Footer: Clear all + Show results */}
            <div className="px-5 pt-4 pb-8 shrink-0 border-t border-[var(--border)] flex gap-3">
              <button
                onClick={() => { clearFilters(); }}
                className="flex-1 h-12 border border-[var(--border-strong)] text-[var(--foreground)] text-[14px] font-medium rounded-xl hover:bg-[var(--surface)] transition-colors active:scale-[0.98]"
              >
                Clear all
              </button>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="flex-1 h-12 bg-white text-black text-[14px] font-medium rounded-xl hover:bg-white/90 transition-colors active:scale-[0.98]"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Style picker modal ───────────────────────────────────────────────── */}
      {showStylePicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => { setShowStylePicker(false); setTryonStep(false); setUserPhotoDataUri(null); }}
        >
          <div
            className="bg-[var(--background)] shadow-2xl w-full max-w-sm mx-4 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              {tryonStep ? (
                <button
                  onClick={() => { setTryonStep(false); setUserPhotoDataUri(null); }}
                  className="flex items-center gap-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M10 6H2M2 6L6 2M2 6L6 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="font-mono text-[10px] tracking-[0.18em] uppercase">Back</span>
                </button>
              ) : (
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">
                  Choose style
                </p>
              )}
              <button
                onClick={() => { setShowStylePicker(false); setTryonStep(false); setUserPhotoDataUri(null); }}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                  <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* ── Step 1: Style selection ── */}
            {!tryonStep && (
              <>
                <div className="p-5 grid grid-cols-2 gap-3">
                  {/* Mannequin */}
                  <button
                    onClick={() => { setShowStylePicker(false); generateOutfit("mannequin"); }}
                    className="group flex flex-col items-center gap-3 p-4 border border-[var(--border)] hover:border-[var(--foreground)] transition-all duration-150"
                  >
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
                      <p className="font-mono text-[8px] text-[var(--foreground-subtle)]">Black studio</p>
                    </div>
                  </button>

                  {/* Flat lay */}
                  <button
                    onClick={() => { setShowStylePicker(false); generateOutfit("flatlay"); }}
                    className="group flex flex-col items-center gap-3 p-4 border border-[var(--border)] hover:border-[var(--foreground)] transition-all duration-150"
                  >
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

                {/* On You — full-width */}
                <div className="px-5 pb-5">
                  <button
                    onClick={() => setTryonStep(true)}
                    className="group w-full flex items-center gap-4 p-4 border border-[var(--border)] hover:border-[var(--foreground)] transition-all duration-150"
                  >
                    <div className="w-14 h-14 shrink-0 bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                      <svg width="28" height="40" viewBox="0 0 28 48" fill="none">
                        <ellipse cx="14" cy="5" rx="4" ry="4" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M7 12H21L22 28H16L14 44H14L12 28H6L7 12Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                        <path d="M7 14L2 20M21 14L26 20" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground)]">On You</p>
                        <span className="font-mono text-[7px] tracking-[0.12em] uppercase px-1.5 py-0.5 bg-[var(--foreground)] text-[var(--background)]">New</span>
                      </div>
                      <p className="font-mono text-[8px] text-[var(--foreground-subtle)]">Upload your photo · AI dresses you</p>
                    </div>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="text-[var(--foreground-subtle)] group-hover:text-[var(--foreground)] transition-colors shrink-0">
                      <path d="M2 6H10M10 6L6 2M10 6L6 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                <p className="px-5 pb-4 font-mono text-[8px] text-[var(--foreground-subtle)] text-center">
                  Product images sent as references · 1K resolution · Nano Banana 2
                </p>
              </>
            )}

            {/* ── Step 2: Photo upload for try-on ── */}
            {tryonStep && (
              <div className="p-5 flex flex-col gap-4">
                <p className="font-mono text-[9px] text-[var(--foreground-muted)] leading-relaxed">
                  Upload a full-body photo of yourself in a T-pose on a plain background. The AI will place you in a studio shot wearing the selected outfit.
                </p>

                {/* Drop zone */}
                <label className="relative cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const uri = await compressPhoto(file);
                      setUserPhotoDataUri(uri);
                    }}
                  />
                  {userPhotoDataUri ? (
                    /* Photo preview */
                    <div className="relative w-full aspect-[3/4] overflow-hidden border border-[var(--foreground)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={userPhotoDataUri} alt="Your photo" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
                        <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-white opacity-0 hover:opacity-100 transition-opacity">Change photo</p>
                      </div>
                    </div>
                  ) : (
                    /* Empty drop zone */
                    <div className="w-full aspect-[3/4] border border-dashed border-[var(--border-strong)] flex flex-col items-center justify-center gap-3 hover:border-[var(--foreground)] transition-colors">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--foreground-subtle)]">
                        <path d="M12 16V8M12 8L9 11M12 8L15 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                      <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
                        Click to upload
                      </p>
                      <p className="font-mono text-[8px] text-[var(--foreground-subtle)] text-center px-4">
                        Full body · T-pose · plain background
                      </p>
                    </div>
                  )}
                </label>

                <button
                  disabled={!userPhotoDataUri}
                  onClick={() => {
                    if (!userPhotoDataUri) return;
                    setShowStylePicker(false);
                    setTryonStep(false);
                    generateOutfit("tryon", userPhotoDataUri);
                  }}
                  className={`w-full h-10 font-mono text-[10px] tracking-[0.18em] uppercase transition-all duration-150 ${
                    userPhotoDataUri
                      ? "bg-[var(--foreground)] text-[var(--background)] hover:opacity-80"
                      : "bg-[var(--border)] text-[var(--foreground-subtle)] cursor-not-allowed"
                  }`}
                >
                  Generate
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Generate error toast ──────────────────────────────────────────────── */}
      {generateError && (
        <p className="fixed bottom-20 right-4 z-50 text-[11px] text-red-600 bg-[var(--background)] border border-red-300 px-3 py-2 shadow-md max-w-[260px]">
          {generateError}
        </p>
      )}

      {/* ── Saved popup (mobile) ─────────────────────────────────────────────── */}
      {showSavedPopup && (
        <div
          className="fixed inset-0 z-50 flex items-end md:hidden"
          onClick={() => setShowSavedPopup(false)}
        >
          <div
            className="w-full bg-[var(--background)] border-t border-[var(--border)] px-5 pt-5 pb-8 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">Outfit saved</p>
              <button
                onClick={() => setShowSavedPopup(false)}
                className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Outfit thumbnails */}
            {Object.values(selection).filter(Boolean).length > 0 && (
              <div className="flex gap-2 mb-5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {(Object.entries(selection) as [SlotId, Product][])
                  .filter(([, p]) => p != null)
                  .map(([slotId, product]) => {
                    const colorKey = colorImageOverrides[slotId];
                    const colorImageUrl = colorKey && product.colorImages?.[colorKey]?.[0];
                    const variantId = variantOverrides[slotId];
                    const activeVariant = product.variants?.find(v => v.id === variantId);
                    const img = colorImageUrl || activeVariant?.imageUrl || product.imageUrl;
                    return (
                      <div key={slotId} className="shrink-0 w-16 h-20 border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                        {img && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={product.name} className="w-full h-full object-contain p-1" />
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Navigation */}
            <Link
              href="/saved?tab=looks"
              onClick={() => setShowSavedPopup(false)}
              className="flex items-center justify-between px-4 py-3 border border-[var(--border)] hover:border-[var(--foreground)] transition-colors"
            >
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--foreground)]">My Looks</span>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* Mobile AI Stylist drawer — always mounted so chat history persists on open/close */}
      <div className="md:hidden">
        <StylistDrawer
          isOpen={stylistOpen}
          onClose={closeStylist}
          surface="builder"
          products={products}
          position="fixed"
          selection={selection}
        />
      </div>

      {/* ── Upgrade modal (402 from /api/generate-outfit) ─────────────────────── */}
      <UpgradeModal prompt={upgradePrompt} onClose={() => setUpgradePrompt(null)} />

      {/* ── Generating overlay ────────────────────────────────────────────────── */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative bg-[var(--background)] shadow-2xl max-w-xl w-full mx-4 overflow-hidden animate-scale-in">

            {/* Indeterminate progress line at top */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--surface)] overflow-hidden">
              <div className="absolute inset-y-0 w-1/2 bg-[var(--foreground)] origin-left animate-progress-bar" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3.5 border-b border-[var(--border)]">
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                  Generating Look
                </p>
                <p className="font-mono text-[9px] text-[var(--foreground-subtle)] mt-0.5">
                  {selectedCount} {selectedCount === 1 ? "piece" : "pieces"} ·{" "}
                  {activeStyle === "mannequin" ? "Mannequin" : activeStyle === "flatlay" ? "Flat lay" : "On You"}
                </p>
              </div>
              {/* Bouncing dots */}
              <div className="flex items-center gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="block w-1.5 h-1.5 rounded-full bg-[var(--foreground-subtle)]"
                    style={{ animation: `dot-bounce 1.2s ease-in-out ${i * 0.18}s infinite` }}
                  />
                ))}
              </div>
            </div>

            {/* Shimmer image placeholder */}
            <div className="relative w-full aspect-square bg-[var(--surface)] overflow-hidden flex flex-col items-center justify-center gap-4">
              {/* shimmer sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent animate-shimmer pointer-events-none" />
              {/* Pulsing central icon */}
              <svg
                width="48" height="48" viewBox="0 0 24 24" fill="none"
                className="text-[var(--foreground-subtle)] opacity-20 animate-pulse"
              >
                <path d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.6L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z"
                  stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <p className="font-mono text-[9px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] opacity-30 animate-pulse">
                Creating your look…
              </p>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-[var(--border)]">
              <p className="font-mono text-[9px] text-[var(--foreground-subtle)] leading-relaxed">
                This may take 10–30 seconds. Sit back and relax.
              </p>
            </div>
          </div>
        </div>
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
                  {activeStyle === "mannequin" ? "Mannequin" : activeStyle === "flatlay" ? "Flat lay" : "On You"} · {selectedCount} pieces
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Regenerate */}
                <button
                  onClick={() => { setShowModal(false); openStylePicker(); }}
                  className="font-mono flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M10 6A4 4 0 1 1 6 2M6 2L9 1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Regenerate
                </button>
                {/* Download */}
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

            <div className="px-5 py-3.5 border-t border-[var(--border)] flex items-center justify-between gap-4">
              <p className="font-mono text-[9px] text-[var(--foreground-subtle)] leading-relaxed">
                AI-generated image based on selected pieces. May not reflect exact products.
              </p>
              {/* Save */}
              <button
                onClick={() => { saveOutfit(); setShowModal(false); router.push("/saved"); }}
                className="font-mono flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] px-5 py-2.5 hover:opacity-80 transition-opacity shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 12C7 12 1.5 8.5 1.5 5C1.5 3.34 2.84 2 4.5 2C5.56 2 6.48 2.56 7 3.38C7.52 2.56 8.44 2 9.5 2C11.16 2 12.5 3.34 12.5 5C12.5 8.5 7 12 7 12Z" />
                </svg>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
