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

// Category accordion groups for the filter sidebar / mobile drawer
const CATEGORY_GROUPS = [
  {
    id: "outerwear",
    label: "Outerwear",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M5 2L2 5V7.5L4 6.5V14H12V6.5L14 7.5V5L11 2C11 2 10.2 3.5 8 3.5C5.8 3.5 5 2 5 2ZM6 2.5V7M10 2.5V7"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ),
    items: [
      { label: "Jackets", value: "outerwear" },
      { label: "Coats", value: "outerwear" },
      { label: "Parkas", value: "outerwear" },
      { label: "Vests", value: "outerwear" },
      { label: "Bomber Jackets", value: "outerwear" },
      { label: "Raincoats", value: "outerwear" },
      { label: "Blazers", value: "blazers" },
    ],
  },
  {
    id: "tops",
    label: "Tops",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6 2L2 5V7L4 6V14H12V6L14 7V5L10 2C10 2 9.5 4 8 4C6.5 4 6 2 6 2Z"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
    ),
    items: [
      { label: "T-Shirts", value: "tops" },
      { label: "Hoodies & Sweatshirts", value: "tops" },
      { label: "Shirts", value: "shirts" },
    ],
  },
  {
    id: "bottoms",
    label: "Bottoms",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 2H12L13 8H9L8 14H8L7 8H3L4 2Z"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      </svg>
    ),
    items: [
      { label: "Pants", value: "bottoms" },
      { label: "Jeans", value: "jeans" },
      { label: "Shorts", value: "shorts" },
      { label: "Skirts", value: "skirts" },
    ],
  },
  {
    id: "dresses",
    label: "Dresses",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6 2H10M8 2V5M5 5C5 5 4 7 3 9C2 11 2 14 2 14H14C14 14 14 11 13 9C12 7 11 5 11 5C10.5 6 9.5 7 8 7C6.5 7 5.5 6 5 5Z"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ),
    items: [
      { label: "Dresses", value: "dresses" },
      { label: "Jumpsuits", value: "jumpsuits" },
    ],
  },
  {
    id: "footwear",
    label: "Footwear",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 11.5C2 11.5 4 10 7 10C9 10 10 11 11 11H13.5C13.5 11 14 11 14 12V13H2V11.5Z"
          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M7 10V7.5C7 7.5 7.5 5 10 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
    items: [
      { label: "Sneakers", value: "footwear" },
      { label: "Sandals", value: "footwear" },
      { label: "Boots", value: "footwear" },
    ],
  },
  {
    id: "accessories",
    label: "Accessories",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="6" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <path d="M6 6V4.5C6 3.7 6.7 3 7.5 3H8.5C9.3 3 10 3.7 10 4.5V6" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
    items: [
      { label: "Bags", value: "bags" },
      { label: "Hats", value: "accessories" },
      { label: "Belts", value: "accessories" },
      { label: "Sunglasses", value: "accessories" },
      { label: "Watches", value: "accessories" },
    ],
  },
];

const SUBCAT_LABEL_TO_VALUE: Record<string, string> = Object.fromEntries(
  CATEGORY_GROUPS.flatMap(g => g.items.map(i => [i.label, i.value]))
);

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
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [expandedCategoryGroups, setExpandedCategoryGroups] = useState<Set<string>>(new Set());
  const [likedOnly, setLikedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [brandSearch, setBrandSearch] = useState("");
  const [sortBy, setSortBy] = useState<"featured" | "new-in" | "price-asc" | "price-desc">("featured");
  const [sortDropOpen, setSortDropOpen] = useState(false);
  const sortDropRef = useRef<HTMLDivElement>(null);
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
  const [colorPickerSlot, setColorPickerSlot] = useState<SlotId | null>(null);
  const [colorPickerProduct, setColorPickerProduct] = useState<Product | null>(null);

  const [shopAdded, setShopAdded] = useState(false);
  const [showAllColors, setShowAllColors] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [genderDropOpen, setGenderDropOpen] = useState(false);

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

  // Close sort dropdown when clicking outside
  useEffect(() => {
    if (!sortDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortDropRef.current && !sortDropRef.current.contains(e.target as Node)) setSortDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortDropOpen]);

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

  const filterByCategory = (list: Product[], cat: string | null, subs: string[] = []) => {
    if (subs.length > 0) {
      const vals = [...new Set(subs.map(l => SUBCAT_LABEL_TO_VALUE[l]).filter(Boolean))];
      return list.filter(p => vals.includes(p.category));
    }
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
    Array.from(new Set(filterByCategory(products, catalogCategory, selectedSubcategories).map(p => p.brand))).sort() as Brand[],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [catalogCategory, selectedSubcategories, products]);

  // Always show all 13 standard color groups (same as Browse)
  const availableColors = STANDARD_COLORS;

  const catalogProducts = useMemo(() => {
    let list = filterByCategory(products, catalogCategory, selectedSubcategories);

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
  }, [catalogCategory, selectedSubcategories, products, search, likedOnly, likedProducts, maxPrice, selectedBrands, selectedColors, selectedGender, sortBy]);

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

  const hasActiveFilters = maxPrice !== null || selectedBrands.length > 0 || selectedColors.length > 0 || selectedGender !== null || sortBy !== "featured" || likedOnly || catalogCategory !== null || selectedSubcategories.length > 0;
  const activeFilterCount = (maxPrice !== null ? 1 : 0) + selectedBrands.length + selectedColors.length + (selectedGender !== null ? 1 : 0) + (sortBy !== "featured" ? 1 : 0) + (likedOnly ? 1 : 0);

  // ── Actions ───────────────────────────────────────────────────────────────

  // Auto-routes product into the correct slot based on its category.
  // For multi-slot categories (accessories), fills the first empty slot; toggles off if already selected.
  const selectProduct = (product: Product) => {
    const matchingSlots = SLOTS.filter(s => s.categories.includes(product.category));
    if (matchingSlots.length === 0) return;

    // Determine target slot using current selection (before state update)
    const alreadyInSlot = matchingSlots.find(s => selection[s.id]?.id === product.id);

    if (alreadyInSlot) {
      // Toggle off
      setSelection(prev => {
        const next = { ...prev };
        delete next[alreadyInSlot.id];
        updateURL(next);
        return next;
      });
      setVariantOverrides(vo => { const n = { ...vo }; delete n[alreadyInSlot.id]; return n; });
      setColorImageOverrides(co => { const n = { ...co }; delete n[alreadyInSlot.id]; return n; });
      setActiveSlot(alreadyInSlot.id);
      setSaved(false);
      setGeneratedImage(null);
      return;
    }

    // Find first empty slot, or fall back to first slot
    const emptySlot = matchingSlots.find(s => !selection[s.id]) ?? matchingSlots[0];

    setSelection(prev => {
      const next = { ...prev, [emptySlot.id]: product };
      updateURL(next);
      return next;
    });
    setVariantOverrides(vo => {
      const n = { ...vo };
      const previewVariantId = catalogPreviews[product.id];
      if (previewVariantId) n[emptySlot.id] = previewVariantId;
      else delete n[emptySlot.id];
      return n;
    });
    setColorImageOverrides(co => {
      const colorKey = catalogColorPreviews[product.id];
      if (colorKey) return { ...co, [emptySlot.id]: colorKey };
      const n = { ...co }; delete n[emptySlot.id]; return n;
    });
    setActiveSlot(emptySlot.id);
    setSaved(false);
    setGeneratedImage(null);

    // Open color picker if product has multiple color options
    const hasMultipleColors =
      Object.keys(product.colorImages ?? {}).length > 1 ||
      (product.variants?.length ?? 0) > 1;
    if (hasMultipleColors) {
      setColorPickerProduct(product);
      setColorPickerSlot(emptySlot.id);
    }
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
    setSelectedSubcategories([]);
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

          {/* ── LEFT PANEL: In this look (300px) ─────────────────────────── */}
          <aside className="flex flex-col border-r border-[var(--border)] bg-[var(--background)] min-h-0 overflow-hidden shrink-0" style={{ width: 300 }}>

            {/* Header */}
            <div className="px-6 pt-6 pb-4 shrink-0 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-1">In this look</p>
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {selectedCount > 0 ? `${selectedCount} piece${selectedCount !== 1 ? "s" : ""}` : "0 pieces"}
                </p>
              </div>
            </div>

            {/* Slot cards */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {SLOTS.map(slot => {
                const picked = selection[slot.id];
                const variantId = variantOverrides[slot.id];
                const activeVariant = picked?.variants?.find(v => v.id === variantId);
                const colorKey = colorImageOverrides[slot.id];
                const colorImageUrl = colorKey && picked?.colorImages?.[colorKey]?.[0];
                const displayImage = colorImageUrl || activeVariant?.imageUrl || picked?.imageUrl;

                if (!picked) {
                  return (
                    <button
                      key={slot.id}
                      onClick={() => { setActiveSlot(slot.id); setCatalogCategory(slot.id); }}
                      className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-3 flex items-center gap-3 cursor-pointer hover:border-[var(--foreground-muted)] transition-colors text-left w-full"
                    >
                      <div className="w-16 h-20 rounded-lg bg-[var(--surface)] flex items-center justify-center shrink-0 text-[var(--foreground-subtle)] opacity-40">
                        <SlotIcon id={slot.id} size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] tracking-[0.14em] uppercase font-medium text-[var(--foreground-subtle)] mb-1">{slot.label}</p>
                        <p className="text-[11px] text-[var(--foreground-subtle)] italic">Click to add</p>
                      </div>
                    </button>
                  );
                }

                return (
                  <div
                    key={slot.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-sm p-3 flex items-start gap-3 relative cursor-pointer hover:border-[var(--foreground-muted)] transition-colors"
                    onClick={() => { setActiveSlot(slot.id); setCatalogCategory(slot.id); }}
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-20 rounded-lg overflow-hidden bg-white border border-[var(--border)] shrink-0 flex items-center justify-center">
                      {displayImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={displayImage} src={displayImage} alt={picked!.name} className="swatch-img-enter w-full h-full object-contain" />
                      ) : (
                        <div className="text-[var(--foreground-subtle)] opacity-30"><SlotIcon id={slot.id} size={16} /></div>
                      )}
                    </div>
                    {/* Remove button top-right */}
                    <button
                      onClick={e => clearSlot(slot.id, e)}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--surface)] flex items-center justify-center text-[var(--foreground-muted)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all"
                      aria-label={`Remove ${slot.label}`}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                    {/* Info */}
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-[9px] tracking-[0.14em] uppercase font-medium text-[var(--foreground-subtle)] mb-1">{slot.label}</p>
                      {picked ? (
                        <>
                          <p className="text-[12px] font-semibold text-[var(--foreground)] leading-snug line-clamp-2">{picked.name}</p>
                          <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">{picked.brand}</p>
                          <p className="text-[13px] font-bold text-[var(--foreground)] mt-1">{formatPrice(picked.priceMin)}</p>
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
                                    className={`w-4 h-4 shrink-0 rounded-full transition-all duration-200 ${(variantId ?? picked.id) === sw.id ? "scale-125" : "hover:scale-110 opacity-70 hover:opacity-100"}`}
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
                                    className="w-3.5 h-3.5 shrink-0 rounded-full flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity"
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
                                        className={`w-4 h-4 shrink-0 rounded-full transition-all duration-200 ${(variantId ?? picked.id) === sw.id ? "scale-125" : "hover:scale-110 opacity-70 hover:opacity-100"}`}
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
                                      className={`relative w-4 h-4 rounded-full overflow-hidden shrink-0 transition-all duration-150 ${isActive ? "ring-2 ring-offset-1 ring-[var(--foreground)] scale-110" : "opacity-60 hover:opacity-100 hover:scale-105"}`}
                                    >
                                      {img && <img src={img} alt={color} className="w-full h-full object-cover" />}
                                    </button>
                                  );
                                })}
                                {hidden > 0 && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setOpenSwatchPopup(openSwatchPopup === popupKey ? null : popupKey); }}
                                    className="w-3.5 h-3.5 shrink-0 rounded-full flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity"
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
                                          className={`relative w-4 h-4 rounded-full overflow-hidden shrink-0 transition-all duration-150 ${isActive ? "ring-2 ring-offset-1 ring-[var(--foreground)] scale-110" : "opacity-60 hover:opacity-100 hover:scale-105"}`}
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
                  </div>
                );
              })}
            </div>

            {/* Footer: Total + Share Look + Clear Look */}
            <div className="shrink-0 border-t border-[var(--border)] px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">Total</p>
                <p className={`text-2xl font-bold transition-all ${selectedCount > 0 ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"}`}>
                  {selectedCount > 0 ? formatPrice(totalPrice) : "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={shareOutfit}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-[var(--border-strong)] rounded-lg py-2.5 text-[10px] tracking-[0.1em] uppercase font-bold text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.3" />
                    <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.3" />
                    <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
                    <line x1="10.3" y1="5" x2="5.7" y2="7" stroke="currentColor" strokeWidth="1.3" />
                    <line x1="5.7" y1="9" x2="10.3" y2="11" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                  {copied ? "Copied!" : "Share look"}
                </button>
                <button
                  onClick={clearAll}
                  disabled={selectedCount === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-[var(--border-strong)] rounded-lg py-2.5 text-[10px] tracking-[0.1em] uppercase font-bold text-[var(--foreground-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M3 6H13L12 14H4L3 6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M1 3H15M6 3V2H10V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  Clear look
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
                  className="w-full h-10 bg-[var(--surface)] rounded-xl border border-[var(--border)] focus:border-[var(--border-strong)] outline-none pl-10 pr-8 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors"
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
            <div className="shrink-0 px-4 py-2 border-b border-[var(--border)] flex items-center justify-between gap-4">
              {/* Category chips — scrollable, no scrollbar */}
              <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {/* All chip */}
                <button
                  onClick={() => { setCatalogCategory(null); setLikedOnly(false); }}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
                    catalogCategory === null && !likedOnly
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "border border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  All
                </button>

                {/* Liked chip — right after All */}
                <button
                  onClick={() => { setLikedOnly(v => !v); if (!likedOnly) setCatalogCategory(null); }}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
                    likedOnly
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "border border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <path d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z" stroke="currentColor" strokeWidth="1.3" fill={likedOnly ? "currentColor" : "none"} />
                  </svg>
                  Liked
                </button>

                {([
                  { label: "Tops", value: "tops" },
                  { label: "Outerwear", value: "outerwear" },
                  { label: "Bottoms", value: "bottoms" },
                  { label: "Shoes", value: "footwear" },
                  { label: "Accessories", value: "accessories" },
                  { label: "Bags", value: "bags" },
                  { label: "New In", value: "new-in" },
                ] as Array<{ label: string; value: string | null }>).map(({ label, value }) => {
                  const isNewIn = value === "new-in";
                  const isActive = isNewIn ? sortBy === "new-in" : catalogCategory === value;
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        if (isNewIn) {
                          setSortBy(sortBy === "new-in" ? "featured" : "new-in");
                        } else {
                          setCatalogCategory(isActive ? null : value);
                          setSelectedSubcategories([]);
                        }
                      }}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all duration-150 ${
                        isActive
                          ? "bg-[var(--foreground)] text-[var(--background)]"
                          : "border border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}

              </div>
              {/* Right controls: sort + grid/list toggle + filters */}
              <div className="shrink-0 flex items-center gap-2">
                <div className="relative" ref={sortDropRef}>
                  <button
                    onClick={() => setSortDropOpen(v => !v)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-[11px] font-semibold transition-all duration-150 ${
                      sortDropOpen
                        ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                        : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {sortBy === "featured" && "Featured"}
                    {sortBy === "new-in" && "New In"}
                    {sortBy === "price-asc" && "Price ↑"}
                    {sortBy === "price-desc" && "Price ↓"}
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`transition-transform duration-200 ${sortDropOpen ? "rotate-180" : ""}`}>
                      <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {sortDropOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden">
                      {([
                        { value: "featured", label: "Featured" },
                        { value: "price-asc", label: "Price ↑" },
                        { value: "price-desc", label: "Price ↓" },
                      ] as { value: typeof sortBy; label: string }[]).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => { setSortBy(opt.value); setSortDropOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-[10px] tracking-[0.12em] uppercase transition-colors duration-150 ${
                            sortBy === opt.value
                              ? "text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
                              : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Filters toggle button */}
                <button
                  onClick={() => setFiltersOpen(v => !v)}
                  className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
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
                  {activeFilterCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1 right-1" />
                  )}
                </button>
              </div>
            </div>

            {/* Product grid — 4 columns */}
            <div className="flex-1 overflow-y-auto p-3">
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
                <div className="grid grid-cols-4 gap-3">
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
                          className={`group relative rounded-xl border bg-[var(--background)] overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col text-left ${
                            isSelected
                              ? "ring-2 ring-[var(--foreground)] border-[var(--foreground)]"
                              : "border-[var(--border)] hover:border-[var(--foreground-muted)]"
                          }`}
                        >
                          {/* Image */}
                          <div className="relative aspect-[3/4] bg-white overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={displayImage}
                              alt={product.name}
                              className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                            />
                            {!isSelected && (
                              <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm border border-[var(--border)] shadow-sm flex items-center justify-center text-[var(--foreground-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                  <line x1="5" y1="1" x2="5" y2="9" />
                                  <line x1="1" y1="5" x2="9" y2="5" />
                                </svg>
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                                <svg width="10" height="8" viewBox="0 0 12 10" fill="none">
                                  <path d="M1.5 5L4.5 8L10.5 1.5" stroke="var(--background)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
                                        className={`relative w-6 h-6 shrink-0 overflow-hidden border rounded-full transition-all duration-200 ${
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
                          <div className="px-3 pt-3 pb-3.5">
                            <p className="text-[13px] font-semibold text-[var(--foreground)] truncate leading-snug">{product.brand}</p>
                            <p className="text-[11px] text-[var(--foreground-muted)] truncate mt-0.5 leading-snug">{product.name}</p>
                            <p className="text-[12px] font-medium text-[var(--foreground)] mt-1.5">{formatPrice(product.priceMin)}</p>
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
                                        className={`w-3.5 h-3.5 shrink-0 rounded-full transition-all duration-150 ${isSwatchActive ? "scale-110" : "hover:scale-105"}`}
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
                                      className="w-3.5 h-3.5 shrink-0 rounded-full flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] hover:opacity-70 transition-opacity"
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
                                            className={`w-3.5 h-3.5 shrink-0 rounded-full transition-all duration-150 ${isSwatchActive ? "scale-110" : "hover:scale-105"}`}
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
            className="shrink-0 border-l border-[var(--border)] bg-[var(--background)] overflow-hidden transition-all duration-200 flex flex-col"
            style={{ width: filtersOpen ? 280 : 0 }}
          >
            <div className="w-[280px] flex flex-col h-full">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
                <p className="text-[11px] tracking-[0.18em] uppercase font-bold text-[var(--foreground)]">Filters</p>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                    <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">

              {/* LIKED */}
              <div className="border-b border-[var(--border)] px-5 py-4">
                <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Saved</p>
                <button
                  onClick={() => { setLikedOnly(v => !v); if (!likedOnly) setCatalogCategory(null); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                    likedOnly
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <span className="flex items-center gap-2 text-[11px] font-semibold">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z" stroke="currentColor" strokeWidth="1.3" fill={likedOnly ? "currentColor" : "none"} />
                    </svg>
                    My Liked Items
                  </span>
                  {likedOnly && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>

              {/* CATEGORY */}
              <div className="border-b border-[var(--border)] px-5 py-4">
                <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Category</p>
                <button
                  onClick={() => toggleSection("category")}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                    !collapsedSections.has("category")
                      ? "border-[var(--foreground)] text-[var(--foreground)]"
                      : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <span className="text-[12px] font-semibold">
                    {selectedSubcategories.length === 0 && !catalogCategory
                      ? "All"
                      : selectedSubcategories.length === 1
                        ? selectedSubcategories[0]
                        : `${selectedSubcategories.length} selected`}
                  </span>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className={`transition-transform duration-200 ${collapsedSections.has("category") ? "" : "rotate-180"}`}>
                    <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {!collapsedSections.has("category") && (
                  <div className="mt-2 border border-[var(--border)] rounded-xl overflow-hidden">
                    <button
                      onClick={() => { setCatalogCategory(null); setSelectedSubcategories([]); }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--surface)] transition-colors"
                    >
                      <span className={`text-[12px] font-medium ${selectedSubcategories.length === 0 && !catalogCategory ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>All</span>
                      {selectedSubcategories.length === 0 && !catalogCategory && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    {CATEGORY_GROUPS.map(group => {
                      const grpOpen = expandedCategoryGroups.has(group.id);
                      const grpLabels = group.items.map(i => i.label);
                      const grpUniqueVals = [...new Set(group.items.map(i => i.value))];
                      const grpActive = grpLabels.some(l => selectedSubcategories.includes(l));
                      const grpViewAllChecked = grpLabels.every(l => selectedSubcategories.includes(l));
                      return (
                        <div key={group.id} className="border-t border-[var(--border)]">
                          <button
                            onClick={() => setExpandedCategoryGroups(prev => {
                              const next = new Set(prev);
                              next.has(group.id) ? next.delete(group.id) : next.add(group.id);
                              return next;
                            })}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-[var(--surface)] transition-colors"
                          >
                            <span className={`shrink-0 ${grpActive ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>{group.icon}</span>
                            <span className={`flex-1 text-left text-[12px] font-semibold ${grpActive ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>{group.label}</span>
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className={`text-[var(--foreground-subtle)] transition-transform duration-200 ${grpOpen ? "rotate-180" : ""}`}>
                              <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          {grpOpen && (
                            <>
                              <button
                                onClick={() => {
                                  setCatalogCategory(null);
                                  setSelectedSubcategories(prev =>
                                    grpViewAllChecked
                                      ? prev.filter(l => !grpLabels.includes(l))
                                      : [...new Set([...prev, ...grpLabels])]
                                  );
                                }}
                                className="w-full flex items-center justify-between pl-10 pr-4 py-2.5 border-t border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
                              >
                                <span className={`text-[12px] font-semibold italic underline underline-offset-2 decoration-[var(--border-strong)] ${grpViewAllChecked ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>View all</span>
                                <div className="shrink-0 flex items-center justify-center border transition-colors" style={{ width: 16, height: 16, borderRadius: "50%", background: grpViewAllChecked ? "var(--foreground)" : "transparent", borderColor: grpViewAllChecked ? "var(--foreground)" : "var(--border-strong)" }}>
                                  {grpViewAllChecked && <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                </div>
                              </button>
                              {group.items.map(item => {
                                const isChk = selectedSubcategories.includes(item.label);
                                return (
                                  <button
                                    key={item.label}
                                    onClick={() => { setCatalogCategory(null); setSelectedSubcategories(prev => isChk ? prev.filter(l => l !== item.label) : [...prev, item.label]); }}
                                    className="w-full flex items-center justify-between pl-10 pr-4 py-2.5 border-t border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
                                  >
                                    <span className={`text-[12px] ${isChk ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>{item.label}</span>
                                    <div className="shrink-0 flex items-center justify-center border transition-colors" style={{ width: 16, height: 16, borderRadius: "50%", background: isChk ? "var(--foreground)" : "transparent", borderColor: isChk ? "var(--foreground)" : "var(--border-strong)" }}>
                                      {isChk && <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                    </div>
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* PRICE */}
              <div className="border-b border-[var(--border)] px-5 py-4">
                <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Price</p>
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
                  className="w-full cursor-pointer mb-3"
                  style={{ accentColor: "var(--foreground)" }}
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {([
                    { label: "All", max: null },
                    { label: "<$200", max: 200 },
                    { label: "<$500", max: 500 },
                    { label: "<$1k", max: 1000 },
                    { label: "<$2k", max: 2000 },
                  ] as Array<{ label: string; max: number | null }>).map(({ label, max }) => (
                    <button
                      key={label}
                      onClick={() => setMaxPrice(maxPrice === max ? null : max)}
                      className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold transition-all ${
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
              <div className="border-b border-[var(--border)] px-5 py-4">
                <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Gender</p>
                <button
                  onClick={() => setGenderDropOpen(v => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                    genderDropOpen
                      ? "border-[var(--foreground)] text-[var(--foreground)]"
                      : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <span className="text-[12px] font-semibold capitalize">
                    {selectedGender === null ? "All" : selectedGender.charAt(0).toUpperCase() + selectedGender.slice(1)}
                  </span>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className={`transition-transform duration-200 ${genderDropOpen ? "rotate-180" : ""}`}>
                    <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {genderDropOpen && (
                  <div className="mt-2 border border-[var(--border)] rounded-xl overflow-hidden">
                    {([null, "men", "women", "unisex"] as (typeof selectedGender)[]).map(g => {
                      const label = g === null ? "All" : g.charAt(0).toUpperCase() + g.slice(1);
                      const isActive = selectedGender === g;
                      return (
                        <button
                          key={label}
                          onClick={() => { setSelectedGender(g); setGenderDropOpen(false); }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-[var(--surface)] ${g !== null ? "border-t border-[var(--border)]" : ""}`}
                        >
                          <span className={`text-[12px] font-medium ${isActive ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>{label}</span>
                          {isActive && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* COLORS */}
              <div className="border-b border-[var(--border)] px-5 py-4">
                <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Colors</p>
                <div className="flex flex-wrap gap-2">
                  {(showAllColors ? availableColors : availableColors.slice(0, 6)).map(({ name, hex }) => {
                    const isActive = selectedColors.includes(name);
                    return (
                      <button
                        key={name}
                        title={name}
                        onClick={() => setSelectedColors(prev => isActive ? prev.filter(c => c !== name) : [...prev, name])}
                        className={`w-7 h-7 rounded-full cursor-pointer transition-all ${isActive ? "scale-110" : "opacity-75 hover:opacity-100 hover:scale-105"}`}
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
                <div className="border-b border-[var(--border)] px-5 py-4">
                  <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Brands</p>
                  {/* Brand search */}
                  <div className="relative mb-3">
                    <input
                      type="text"
                      value={brandSearch}
                      onChange={e => setBrandSearch(e.target.value)}
                      placeholder="Search brands…"
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--border-strong)] transition-colors"
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
                <div className="px-5 py-4">
                  <button
                    onClick={clearFilters}
                    className="w-full mt-3 py-2 rounded-lg border border-[var(--border-strong)] text-[10px] tracking-[0.12em] uppercase font-bold text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              </div>{/* end scrollable content */}

            </div>
          </div>

          </div>{/* end 3 panels row */}

          {/* ── DESKTOP BOTTOM ACTION BAR ───────────────────────────────────── */}
          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--background)] flex items-center">
            {/* Left section matching left panel width */}
            <div className="shrink-0 px-6 py-3 border-r border-[var(--border)]" style={{ width: 300 }}>
              <p className={`text-[11px] text-[var(--foreground-muted)] ${selectedCount === 0 ? "italic" : ""}`}>
                {selectedCount > 0
                  ? `${selectedCount} piece${selectedCount !== 1 ? "s" : ""} • ${uniqueBrandCount} brand${uniqueBrandCount !== 1 ? "s" : ""}`
                  : "Add pieces to build your look"}
              </p>
            </div>
            {/* Right section: Generate + Save + Shop the Look */}
            <div className="flex-1 flex items-center justify-end gap-3 px-5 py-3">
              {/* Generate */}
              <button
                onClick={openStylePicker}
                disabled={generating || selectedCount === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-strong)] text-[11px] font-semibold text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-all disabled:opacity-30"
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
              {/* Shop the Look — secondary */}
              <button
                onClick={shopTheLook}
                disabled={selectedCount === 0}
                className="flex items-center gap-2 border border-[var(--border-strong)] text-[var(--foreground-muted)] px-4 py-2.5 rounded-xl text-[11px] font-semibold hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {shopAdded ? (
                  <span>Added ✓</span>
                ) : (
                  <>
                    <span>Shop{selectedCount > 0 ? ` ${formatPrice(totalPrice)}` : " the look"}</span>
                    {selectedCount > 0 && <span>→</span>}
                  </>
                )}
              </button>
              {/* Save — primary */}
              <button
                onClick={saveOutfit}
                disabled={selectedCount === 0}
                className={`px-5 py-2.5 rounded-xl text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 ${
                  saved
                    ? "bg-[var(--foreground)]/70 text-[var(--background)]"
                    : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
                }`}
              >
                {saved ? (
                  <>
                    <svg width="11" height="9" viewBox="0 0 12 10" fill="none">
                      <path d="M1.5 5L4.5 8L10.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Saved
                  </>
                ) : "Save"}
              </button>
              {saved && (
                <Link
                  href="/saved?tab=looks"
                  className="text-[11px] font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  View →
                </Link>
              )}
            </div>
          </div>

        </div>{/* end hidden md:flex md:flex-col md:h-full */}

        {/* ── MOBILE LAYOUT ─────────────────────────────────────────────────
            Hero canvas + bottom-sheet catalog panel.
        ───────────────────────────────────────────────────────────────────── */}
        <div className="md:hidden h-full flex flex-col overflow-hidden">

          {/* Mobile top header: back + ai stylist + save */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-[var(--background)] border-b border-[var(--border)]">
            <Link
              href="/"
              className="w-9 h-9 rounded-full bg-[var(--surface)] flex items-center justify-center text-[var(--foreground-muted)] hover:bg-[var(--surface-hover,var(--surface))] transition-colors active:scale-95"
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
                    ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                    : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
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
                    ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                    : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)]"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3.5L9.5 7H13L10.5 9L11.5 12.5L8 10.5L4.5 12.5L5.5 9L3 7H6.5L8 3.5Z" />
                </svg>
                {saved ? "Saved" : "Save"}
              </button>
            </div>
          </div>

          {/* Mobile collage preview */}
          <div className="shrink-0 bg-[var(--background)]">

            {/* Collage canvas */}
            <div className="relative mx-4 mt-3 mb-2 rounded-xl overflow-hidden" style={{ height: 200 }}>
              {selectedCount === 0 ? (
                <div className="absolute inset-0 border border-dashed border-[var(--border-strong)] rounded-xl flex flex-col items-center justify-center gap-2">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-[var(--foreground-subtle)]">
                    <rect x="2" y="2" width="11" height="11" rx="1.5" />
                    <rect x="15" y="2" width="11" height="11" rx="1.5" />
                    <rect x="2" y="15" width="11" height="11" rx="1.5" />
                    <rect x="15" y="15" width="11" height="11" rx="1.5" />
                  </svg>
                  <span className="text-[10px] text-[var(--foreground-subtle)] tracking-[0.12em] uppercase font-mono">Add items to build your look</span>
                </div>
              ) : (() => {
                const items = SLOTS
                  .filter(slot => selection[slot.id])
                  .map(slot => {
                    const picked = selection[slot.id]!;
                    const variantId = variantOverrides[slot.id];
                    const activeVariant = picked.variants?.find(v => v.id === variantId);
                    const colorKey = colorImageOverrides[slot.id];
                    const colorImgUrl = colorKey && picked.colorImages?.[colorKey]?.[0];
                    const imageUrl = colorImgUrl || activeVariant?.imageUrl || picked.imageUrl;
                    return { slotId: slot.id, name: picked.name, imageUrl };
                  });

                const n = items.length;

                const cell = (item: { slotId: string; name: string; imageUrl?: string }, key: string, pad = "p-2") => (
                  <div key={key} className="relative overflow-hidden flex-1 bg-white">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.name} className={`absolute inset-0 w-full h-full object-contain ${pad}`} />
                    )}
                    <button
                      onClick={() => clearSlot(item.slotId as SlotId)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center z-10"
                      aria-label={`Remove ${item.name}`}
                    >
                      <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                        <path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                );

                if (n === 1) return (
                  <div className="absolute inset-0 flex">{cell(items[0], "s0", "p-3")}</div>
                );

                if (n === 2) return (
                  <div className="absolute inset-0 flex gap-px bg-gray-200">
                    {items.map((s, i) => cell(s, `s${i}`))}
                  </div>
                );

                if (n === 3) return (
                  <div className="absolute inset-0 flex flex-col gap-px bg-gray-200">
                    <div className="flex gap-px bg-gray-200" style={{ flex: "0 0 60%" }}>
                      {items.slice(0, 2).map((s, i) => cell(s, `s${i}`))}
                    </div>
                    <div className="relative overflow-hidden flex-1 bg-white">
                      {items[2].imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={items[2].imageUrl} alt={items[2].name} className="absolute inset-0 w-full h-full object-contain p-2" />
                      )}
                      <button onClick={() => clearSlot(items[2].slotId as SlotId)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center z-10" aria-label={`Remove ${items[2].name}`}>
                        <svg width="7" height="7" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      </button>
                    </div>
                  </div>
                );

                if (n === 4) return (
                  <div className="absolute inset-0 flex flex-col gap-px bg-gray-200">
                    <div className="flex gap-px flex-1 bg-gray-200">
                      {items.slice(0, 2).map((s, i) => cell(s, `s${i}`))}
                    </div>
                    <div className="flex gap-px flex-1 bg-gray-200">
                      {items.slice(2, 4).map((s, i) => cell(s, `s${i + 2}`))}
                    </div>
                  </div>
                );

                if (n === 5) return (
                  <div className="absolute inset-0 flex flex-col gap-px bg-gray-200">
                    <div className="flex gap-px bg-gray-200" style={{ flex: "0 0 57%" }}>
                      {items.slice(0, 2).map((s, i) => cell(s, `s${i}`))}
                    </div>
                    <div className="flex gap-px bg-gray-200" style={{ flex: "0 0 43%" }}>
                      {items.slice(2, 5).map((s, i) => cell(s, `s${i + 2}`))}
                    </div>
                  </div>
                );

                return (
                  <div className="absolute inset-0 flex flex-col gap-px bg-gray-200">
                    <div className="flex gap-px bg-gray-200" style={{ flex: "0 0 40%" }}>
                      {items.slice(0, 2).map((s, i) => cell(s, `s${i}`))}
                    </div>
                    <div className="flex gap-px bg-gray-200" style={{ flex: "0 0 33%" }}>
                      {items.slice(2, 5).map((s, i) => cell(s, `s${i + 2}`))}
                    </div>
                    <div className="relative overflow-hidden bg-white" style={{ flex: "0 0 27%" }}>
                      {items[5].imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={items[5].imageUrl} alt={items[5].name} className="absolute inset-0 w-full h-full object-contain p-2" />
                      )}
                      <button onClick={() => clearSlot(items[5].slotId as SlotId)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center z-10" aria-label={`Remove ${items[5].name}`}>
                        <svg width="7" height="7" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Total + Clear all + Generate */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">Total</span>
                <span className={`text-[20px] font-bold leading-none transition-all ${
                  selectedCount > 0 ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"
                }`}>
                  {selectedCount > 0 ? formatPrice(totalPrice) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedCount >= 1 && (
                  <button
                    onClick={openStylePicker}
                    disabled={generating}
                    className="flex items-center gap-1.5 border border-[var(--border-strong)] rounded-full px-3 py-1.5 text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1L7.2 4.8H11L8 7.2L9.1 11L6 8.8L2.9 11L4 7.2L1 4.8H4.8L6 1Z"
                          stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                      </svg>
                    )}
                    {generating ? "Generating…" : "Generate"}
                  </button>
                )}
                <button
                  onClick={clearAll}
                  disabled={selectedCount === 0}
                  className="text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>

          {/* Bottom panel — filters + products */}
          <div className="flex-1 min-h-0 flex flex-col bg-[var(--background)]">

            {/* Filters + category chips in one scrollable row */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className={`shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full border text-[11px] font-medium transition-all active:scale-95 mr-1 ${
                  hasActiveFilters
                    ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                    : "border-[var(--border-strong)] text-[var(--foreground-muted)]"
                }`}
              >
                <svg width="12" height="9" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="1" y1="1.5" x2="13" y2="1.5" />
                  <line x1="3" y1="5.5" x2="11" y2="5.5" />
                  <line x1="5" y1="9.5" x2="9" y2="9.5" />
                </svg>
                Filters{activeFilterCount > 0 && <span className="text-[10px] opacity-80"> · {activeFilterCount}</span>}
              </button>
              {MOBILE_CHIPS.map(({ label, value }) => {
                const isActive = catalogCategory === value && !likedOnly;
                return (
                  <button
                    key={label}
                    onClick={() => { setCatalogCategory(catalogCategory === value ? null : value); setLikedOnly(false); }}
                    className={`shrink-0 px-3 h-8 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-[var(--foreground)] text-[var(--background)]"
                        : "border border-[var(--border-strong)] text-[var(--foreground-muted)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                onClick={() => { setLikedOnly(v => !v); setCatalogCategory(null); }}
                className={`shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                  likedOnly
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "border border-[var(--border-strong)] text-[var(--foreground-muted)]"
                }`}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill={likedOnly ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
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
                          onClick={() => {
                            const hasMultipleColors =
                              Object.keys(product.colorImages ?? {}).length > 1 ||
                              (product.variants?.length ?? 0) > 1;
                            if (isSelected && selectedSlot && hasMultipleColors) {
                              setColorPickerProduct(product);
                              setColorPickerSlot(selectedSlot.id);
                            } else {
                              selectProduct(product);
                            }
                          }}
                          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectProduct(product); } }}
                          className={`relative overflow-hidden bg-white cursor-pointer transition-all rounded-xl border ${
                            isSelected
                              ? "ring-2 ring-[var(--foreground)] border-[var(--foreground)]"
                              : "border-[var(--border)]"
                          }`}
                          style={{ width: 108, height: 120 }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={displayImage}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-contain"
                          />
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#c9a84c] flex items-center justify-center pointer-events-none">
                              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                          {isSelected && ((product.variants?.length ?? 0) > 1 || Object.keys(product.colorImages ?? {}).length > 1) && (
                            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 pointer-events-none">
                              {(product.variants?.length ?? 0) > 1
                                ? product.variants!.slice(0, 3).map(sw => sw.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img key={sw.id} src={sw.imageUrl} alt={sw.colorName} className="w-3.5 h-3.5 rounded-sm object-cover border border-white/60 bg-white" />
                                  ) : (
                                    <span key={sw.id} className="w-3.5 h-3.5 rounded-sm border border-white/60" style={{ background: sw.colorHex }} />
                                  ))
                                : Object.keys(product.colorImages!).slice(0, 3).map(c => {
                                    const img = product.colorImages![c]?.[0];
                                    return img ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img key={c} src={img} alt={c} className="w-3.5 h-3.5 rounded-sm object-cover border border-white/60" />
                                    ) : null;
                                  })
                              }
                            </div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="pt-1.5">
                          <p className="text-[10px] font-semibold text-[var(--foreground)] truncate leading-snug">{product.brand}</p>
                          <p className="text-[9px] text-[var(--foreground-muted)] truncate mt-0.5">{product.name}</p>
                          <p className="text-[9px] font-medium text-[var(--foreground)] mt-0.5">{formatPrice(product.priceMin)}</p>
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
                <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                  {/* All row */}
                  <button
                    onClick={() => { setCatalogCategory(null); setSelectedSubcategories([]); }}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--surface)] transition-colors active:bg-[var(--surface)]"
                  >
                    <span className={`text-[14px] font-medium ${selectedSubcategories.length === 0 && !catalogCategory ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>All</span>
                    {selectedSubcategories.length === 0 && !catalogCategory && (
                      <svg width="11" height="9" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  {/* Group rows */}
                  {CATEGORY_GROUPS.map(group => {
                    const isOpen = expandedCategoryGroups.has(group.id);
                    const groupLabels = group.items.map(i => i.label);
                    const groupUniqueValues = [...new Set(group.items.map(i => i.value))];
                    const groupActive = groupLabels.some(l => selectedSubcategories.includes(l));
                    const viewAllChecked = groupLabels.every(l => selectedSubcategories.includes(l));
                    return (
                      <div key={group.id} className="border-t border-[var(--border)]">
                        <button
                          onClick={() => setExpandedCategoryGroups(prev => {
                            const next = new Set(prev);
                            next.has(group.id) ? next.delete(group.id) : next.add(group.id);
                            return next;
                          })}
                          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--surface)] transition-colors active:bg-[var(--surface)]"
                        >
                          <span className={`shrink-0 ${groupActive ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>{group.icon}</span>
                          <span className={`flex-1 text-left text-[14px] font-semibold ${groupActive ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>{group.label}</span>
                          <svg width="10" height="10" viewBox="0 0 9 9" fill="none" className={`text-[var(--foreground-subtle)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                            <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {isOpen && (<>
                          {/* View all row */}
                          <button
                            onClick={() => {
                              setCatalogCategory(null);
                              setSelectedSubcategories(prev =>
                                viewAllChecked
                                  ? prev.filter(l => !groupLabels.includes(l))
                                  : [...new Set([...prev, ...groupLabels])]
                              );
                            }}
                            className="w-full flex items-center justify-between border-t border-[var(--border)] pl-12 pr-4 py-3.5 hover:bg-[var(--surface)] transition-colors active:bg-[var(--surface)]"
                          >
                            <span className={`text-[14px] font-semibold italic underline underline-offset-2 decoration-[var(--border-strong)] ${viewAllChecked ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>View all</span>
                            <div
                              className="shrink-0 flex items-center justify-center border transition-colors"
                              style={{ width: 20, height: 20, borderRadius: "50%", background: viewAllChecked ? "var(--foreground)" : "transparent", borderColor: viewAllChecked ? "var(--foreground)" : "var(--border-strong)" }}
                            >
                              {viewAllChecked && (
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </button>
                          {/* Subcategory items */}
                          {group.items.map(item => {
                            const isChecked = selectedSubcategories.includes(item.label);
                            return (
                              <button
                                key={item.label}
                                onClick={() => {
                                  setCatalogCategory(null);
                                  setSelectedSubcategories(prev =>
                                    isChecked ? prev.filter(l => l !== item.label) : [...prev, item.label]
                                  );
                                }}
                                className="w-full flex items-center justify-between border-t border-[var(--border)] pl-12 pr-4 py-3.5 hover:bg-[var(--surface)] transition-colors active:bg-[var(--surface)]"
                              >
                                <span className={`text-[14px] ${isChecked ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>{item.label}</span>
                                <div
                                  className="shrink-0 flex items-center justify-center border transition-colors"
                                  style={{ width: 20, height: 20, borderRadius: "50%", background: isChecked ? "var(--foreground)" : "transparent", borderColor: isChecked ? "var(--foreground)" : "var(--border-strong)" }}
                                >
                                  {isChecked && (
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                      <path d="M1 4L3.5 6.5L9 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </>)}
                      </div>
                    );
                  })}
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


      {/* ── MOBILE COLOR PICKER SHEET ─────────────────────────────────────── */}
      {colorPickerSlot && colorPickerProduct && (() => {
        const slotProduct = colorPickerProduct;

        // Build unified list of color options from both variants and colorImages
        const variantSwatches = slotProduct.variants ?? [];
        const colorImageKeys = Object.keys(slotProduct.colorImages ?? {});
        const useVariants = variantSwatches.length > 1;
        const useColorImages = colorImageKeys.length > 1;

        // Current selections
        const activeVariantId = variantOverrides[colorPickerSlot] ?? slotProduct.id;
        const activeColorKey = colorImageOverrides[colorPickerSlot] ?? colorImageKeys[0];

        // Active display name shown in header
        const activeLabel = useVariants
          ? (variantSwatches.find(s => s.id === activeVariantId)?.colorName ?? slotProduct.name)
          : activeColorKey;

        return (
          <div className="md:hidden fixed inset-0 z-[65] flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => { setColorPickerSlot(null); setColorPickerProduct(null); }}
            />
            <div className="relative bg-[var(--background)] rounded-t-2xl px-5 pb-10 pt-4 animate-slide-up">
              {/* Handle */}
              <div className="flex justify-center mb-3">
                <div className="w-8 h-[3px] rounded-full bg-[var(--border-strong)]" />
              </div>
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-[11px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] font-mono">{slotProduct.brand}</p>
                  <p className="text-[16px] font-semibold text-[var(--foreground)] mt-0.5">{slotProduct.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[14px] font-bold text-[var(--foreground)]">{formatPrice(slotProduct.priceMin)}</p>
                    {activeLabel && (
                      <span className="text-[11px] text-[var(--foreground-muted)] bg-[var(--surface)] px-2 py-0.5 rounded-full">{activeLabel}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setColorPickerSlot(null); setColorPickerProduct(null); }}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--surface)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors active:scale-95 shrink-0 ml-3"
                  aria-label="Close color picker"
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Variant swatches (separate product entries per color) */}
              {useVariants && (
                <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {variantSwatches.map(swatch => {
                    const isActive = activeVariantId === swatch.id;
                    return (
                      <button
                        key={swatch.id}
                        onClick={() => {
                          selectVariant(colorPickerSlot, swatch);
                        }}
                        className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                      >
                        <div className={`relative w-[72px] h-[72px] overflow-hidden rounded-xl bg-white border-2 transition-all ${
                          isActive ? "border-[var(--foreground)]" : "border-[var(--border)]"
                        }`}>
                          {swatch.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={swatch.imageUrl} alt={swatch.colorName} className="w-full h-full object-contain p-1" />
                          )}
                          {!swatch.imageUrl && (
                            <div
                              className="w-full h-full"
                              style={{ background: swatch.colorHex === "#multicolor" ? "conic-gradient(red,orange,yellow,green,blue,violet,red)" : swatch.colorHex }}
                            />
                          )}
                          {isActive && (
                            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#c9a84c] flex items-center justify-center pointer-events-none">
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <span className={`text-[10px] leading-tight text-center w-[72px] truncate transition-colors ${
                          isActive ? "text-[var(--foreground)] font-medium" : "text-[var(--foreground-muted)]"
                        }`}>{swatch.colorName}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* colorImages swatches (multiple colorways within same product) */}
              {useColorImages && (
                <div className={`flex gap-3 overflow-x-auto pb-1 ${useVariants ? "mt-3 pt-3 border-t border-[var(--border)]" : ""}`} style={{ scrollbarWidth: "none" }}>
                  {colorImageKeys.map(color => {
                    const img = slotProduct.colorImages![color]?.[0];
                    const isActive = activeColorKey === color;
                    return (
                      <button
                        key={color}
                        onClick={() => {
                          setColorImageOverrides(prev => ({ ...prev, [colorPickerSlot]: color }));
                          setSaved(false);
                        }}
                        className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                      >
                        <div className={`relative w-[72px] h-[72px] overflow-hidden rounded-xl bg-white border-2 transition-all ${
                          isActive ? "border-[var(--foreground)]" : "border-[var(--border)]"
                        }`}>
                          {img && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt={color} className="w-full h-full object-contain p-1" />
                          )}
                          {isActive && (
                            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#c9a84c] flex items-center justify-center pointer-events-none">
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <span className={`text-[10px] leading-tight text-center w-[72px] truncate transition-colors ${
                          isActive ? "text-[var(--foreground)] font-medium" : "text-[var(--foreground-muted)]"
                        }`}>{color}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Style picker modal ───────────────────────────────────────────────── */}
      {showStylePicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => { setShowStylePicker(false); setTryonStep(false); setUserPhotoDataUri(null); }}
        >
          <div
            className="bg-[var(--background)] shadow-2xl w-full max-w-sm mx-4 animate-scale-in rounded-2xl overflow-hidden"
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
                    className="group flex flex-col items-center gap-3 p-4 border border-[var(--border)] hover:border-[var(--foreground)] transition-all duration-150 rounded-xl"
                  >
                    <div className="w-full aspect-square bg-[var(--surface)] rounded-lg flex items-center justify-center text-[var(--foreground)]">
                      <svg width="32" height="48" viewBox="0 0 32 56" fill="none">
                        <ellipse cx="16" cy="6" rx="5" ry="5" fill="currentColor" opacity="0.6" />
                        <rect x="10" y="13" width="12" height="22" rx="2" fill="currentColor" opacity="0.6" />
                        <rect x="4" y="13" width="6" height="16" rx="2" fill="currentColor" opacity="0.45" />
                        <rect x="22" y="13" width="6" height="16" rx="2" fill="currentColor" opacity="0.45" />
                        <rect x="10" y="36" width="5" height="18" rx="2" fill="currentColor" opacity="0.6" />
                        <rect x="17" y="36" width="5" height="18" rx="2" fill="currentColor" opacity="0.6" />
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
                    className="group flex flex-col items-center gap-3 p-4 border border-[var(--border)] hover:border-[var(--foreground)] transition-all duration-150 rounded-xl"
                  >
                    <div className="w-full aspect-square bg-[var(--surface)] border border-[var(--border)] rounded-lg flex items-center justify-center text-[var(--foreground)]">
                      <svg width="48" height="36" viewBox="0 0 56 40" fill="none">
                        <rect x="4" y="4" width="20" height="14" rx="2" fill="currentColor" opacity="0.5" />
                        <rect x="32" y="4" width="20" height="14" rx="2" fill="currentColor" opacity="0.4" />
                        <rect x="4" y="24" width="20" height="12" rx="2" fill="currentColor" opacity="0.6" />
                        <rect x="32" y="24" width="20" height="12" rx="2" fill="currentColor" opacity="0.45" />
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
                    className="group w-full flex items-center gap-4 p-4 border border-[var(--border)] hover:border-[var(--foreground)] transition-all duration-150 rounded-xl"
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
          <div className="relative bg-[var(--background)] shadow-2xl max-w-xl w-full mx-4 overflow-hidden animate-scale-in rounded-2xl">

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
            className="relative bg-[var(--background)] shadow-2xl max-w-xl w-full mx-4 animate-scale-in rounded-2xl overflow-hidden"
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
                className="font-mono flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] px-5 py-2.5 rounded-xl hover:opacity-80 transition-opacity shrink-0"
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
