"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OutfitCard from "@/components/outfit/OutfitCard";
import ProductCard from "@/components/product/ProductCard";
import type { ColorGroup, Gender, Occasion, Outfit, Product, ProductSwatch } from "@/lib/types";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";
import { useLikes } from "@/lib/context/likes-context";
import { track } from "@/lib/analytics/track";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

type View = "outfits" | "pieces";
type SortOption = "featured" | "price-asc" | "price-desc" | "newest";

const STYLE_FILTERS = ["Casual", "Sport", "Streetwear", "Classic", "Smart Casual", "Outdoor", "Home", "Premium"] as const;
type StyleFilter = typeof STYLE_FILTERS[number];

const OCCASIONS: Occasion[] = [
  "casual", "work", "evening", "formal", "weekend", "sport",
];
const GENDERS: Gender[] = ["women", "men", "unisex"];

const DEFAULT_COLOR_GROUPS: ColorGroup[] = [
  { id: 1,  name: "White",      hexCode: "#ffffff", sortOrder: 1 },
  { id: 2,  name: "Multicolor", hexCode: "#multicolor", sortOrder: 2 },
  { id: 3,  name: "Brown",      hexCode: "#7a4f35", sortOrder: 3 },
  { id: 4,  name: "Pink",       hexCode: "#e8698a", sortOrder: 4 },
  { id: 5,  name: "Yellow",     hexCode: "#f5c518", sortOrder: 5 },
  { id: 6,  name: "Orange",     hexCode: "#e87722", sortOrder: 6 },
  { id: 7,  name: "Grey",       hexCode: "#808080", sortOrder: 7 },
  { id: 8,  name: "Black",      hexCode: "#111111", sortOrder: 8 },
  { id: 9,  name: "Green",      hexCode: "#2d6a3f", sortOrder: 9 },
  { id: 10, name: "Red",        hexCode: "#c0392b", sortOrder: 10 },
  { id: 11, name: "Violet",     hexCode: "#7b3fa0", sortOrder: 11 },
  { id: 12, name: "Blue",       hexCode: "#1a47a0", sortOrder: 12 },
  { id: 13, name: "Beige",      hexCode: "#d4c5a9", sortOrder: 13 },
];

const BROWSE_CATEGORY_GROUPS = [
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
      { label: "Knitwear", value: "knitwear" },
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

const BROWSE_SUBCAT_TO_VALUE: Record<string, string> = Object.fromEntries(
  BROWSE_CATEGORY_GROUPS.flatMap(g => g.items.map(i => [i.label, i.value]))
);

function ActiveChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      onClick={onRemove}
      className="flex items-center gap-1.5 text-[9px] tracking-[0.10em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-2.5 py-1 hover:bg-[var(--fg-overlay-05)] transition-colors duration-200 capitalize rounded-full"
    >
      {label}
      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
        <path
          d="M1 1L6 6M6 1L1 6"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

/* ── Main page ── */

export default function BrowsePage() {
  const [view, setView] = useState<View>("pieces");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchExpandedWidth, setSearchExpandedWidth] = useState(220);
  useEffect(() => {
    const update = () => setSearchExpandedWidth(window.innerWidth < 480 ? 140 : 220);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const [stylistOpen, setStylistOpen] = useState(false);

  // Report search terms (debounced) so the admin analytics "Search Terms"
  // list has data — fires once the user stops typing for a second.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const id = setTimeout(() => track("search", { query: q }), 1000);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Restore tab from URL on mount (survives browser back navigation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v === "pieces" || v === "outfits") setView(v);
    // Seed the search box from ?search= so the WebSite SearchAction (and shared
    // links) land on a pre-filtered catalog.
    const q = params.get("search");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q) setSearchQuery(q);
  }, []);
  const [sort, setSort] = useState<SortOption>("featured");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [likedOnly, setLikedOnly] = useState(false);
  const { likedProducts } = useLikes();

  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setFiltersOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [filtersOpen]);

  // Lock background scroll while the filter sidebar is open
  useScrollLock(filtersOpen);

  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [catalogOutfits, setCatalogOutfits] = useState<Outfit[]>([]);
  const [loadingOutfits, setLoadingOutfits] = useState(true);
  const [colorGroups, setColorGroups] = useState<ColorGroup[]>(DEFAULT_COLOR_GROUPS);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCatalogProducts(d); })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    fetch("/api/outfits")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCatalogOutfits(d); })
      .catch(() => {})
      .finally(() => setLoadingOutfits(false));
  }, []);

  useEffect(() => {
    fetch("/api/color-groups")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setColorGroups(d); })
      .catch(() => {});
  }, []);

  const products = catalogProducts;
  const BRANDS = useMemo(
    () => [...new Set(products.map((p) => p.brand))].sort() as string[],
    [products]
  );

  /* Filters */
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [expandedCategoryGroups, setExpandedCategoryGroups] = useState<Set<string>>(new Set());
  const [selectedOccasions, setSelectedOccasions] = useState<Occasion[]>([]);
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [genderOpen, setGenderOpen] = useState(false);
  const [occasionOpen, setOccasionOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [selectedColorGroupIds, setSelectedColorGroupIds] = useState<number[]>([]);
  const [aiOnly, setAiOnly] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<StyleFilter | null>(null);
  const [brandSearch, setBrandSearch] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllColors, setShowAllColors] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);

  /* Togglers */
  const toggleBrand = (b: string) =>
    setSelectedBrands((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b]));
  const toggleSubcategory = (label: string) =>
    setSelectedSubcategories(p => p.includes(label) ? p.filter(x => x !== label) : [...p, label]);
  const toggleOccasion = (o: Occasion) =>
    setSelectedOccasions((p) =>
      p.includes(o) ? p.filter((x) => x !== o) : [...p, o]
    );

  const toggleColorGroup = (id: number) =>
    setSelectedColorGroupIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const activeFiltersCount =
    selectedBrands.length +
    selectedSubcategories.length +
    selectedOccasions.length +
    selectedColorGroupIds.length +
    (selectedGender !== null ? 1 : 0) +
    (maxPrice !== null ? 1 : 0) +
    (aiOnly ? 1 : 0) +
    (likedOnly ? 1 : 0) +
    (selectedStyle !== null ? 1 : 0);

  const clearAll = () => {
    setSelectedBrands([]);
    setSelectedSubcategories([]);
    setExpandedCategoryGroups(new Set());
    setSelectedOccasions([]);
    setSelectedGender(null);
    setMaxPrice(null);
    setSelectedColorGroupIds([]);
    setAiOnly(false);
    setLikedOnly(false);
    setSearchQuery("");
    setSelectedStyle(null);
  };

  /* Filtered data */
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let r = products
      .filter((p) => !selectedBrands.length || selectedBrands.includes(p.brand))
      .filter((p) => {
        if (!selectedSubcategories.length) return true;
        const vals = [...new Set(selectedSubcategories.map(l => BROWSE_SUBCAT_TO_VALUE[l]).filter(Boolean))];
        return vals.includes(p.category);
      })
      .filter(
        (p) =>
          !selectedGender ||
          !p.gender ||
          p.gender === selectedGender ||
          p.gender === "unisex"
      )
      .filter(
        (p) =>
          maxPrice === null || p.priceMin <= maxPrice
      )
      .filter(
        (p) =>
          !selectedColorGroupIds.length ||
          (p.colorGroupIds ?? []).some((id) => selectedColorGroupIds.includes(id))
      )
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
      .filter((p) => !likedOnly || likedProducts.includes(p.id));

    if (sort === "price-asc") r = [...r].sort((a, b) => a.priceMin - b.priceMin);
    else if (sort === "price-desc")
      r = [...r].sort((a, b) => b.priceMax - a.priceMax);
    else if (sort === "newest")
      r = [...r].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    return r;
  }, [products, selectedBrands, selectedSubcategories, selectedGender, maxPrice, selectedColorGroupIds, searchQuery, sort, likedOnly, likedProducts]);

  const filteredOutfits = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let r = catalogOutfits
      .filter(
        (o) =>
          !selectedOccasions.length ||
          selectedOccasions.includes(o.occasion as Occasion)
      )
      .filter((o) => !aiOnly || o.isAIGenerated)
      .filter(
        (o) =>
          maxPrice === null || o.totalPriceMin <= maxPrice
      )
      .filter((o) => {
        if (!selectedStyle) return true;
        const s = selectedStyle.toLowerCase();
        return (
          o.occasion.toLowerCase() === s ||
          o.styleKeywords.some((k) => k.toLowerCase().includes(s))
        );
      })
      .filter(
        (o) =>
          !q ||
          o.name.toLowerCase().includes(q) ||
          o.occasion.toLowerCase().includes(q) ||
          o.styleKeywords.some((k) => k.toLowerCase().includes(q))
      );

    if (sort === "price-asc")
      r = [...r].sort((a, b) => a.totalPriceMin - b.totalPriceMin);
    else if (sort === "price-desc")
      r = [...r].sort((a, b) => b.totalPriceMax - a.totalPriceMax);
    return r;
  }, [catalogOutfits, selectedOccasions, aiOnly, maxPrice, selectedStyle, searchQuery, sort]);

  // When color filters are active, expand each product into one entry per matching
  // color variant. This lets a single product appear as multiple cards when multiple
  // selected colors are present in its variant group.
  type DisplayItem = { product: Product; forcedVariant: ProductSwatch | null; key: string };
  const displayItems = useMemo((): DisplayItem[] => {
    if (!selectedColorGroupIds.length) {
      return filteredProducts.map((p) => ({ product: p, forcedVariant: null, key: p.id }));
    }

    const items: DisplayItem[] = [];
    const seen = new Set<string>();

    for (const product of filteredProducts) {
      const variants = product.variants ?? [];

      if (!variants.length) {
        // Standalone product (no variant group) — show once
        if (!seen.has(product.id)) {
          seen.add(product.id);
          items.push({ product, forcedVariant: null, key: product.id });
        }
        continue;
      }

      // Find all variants whose colorGroupIds intersect the active color filter
      const matching = variants.filter((v) =>
        (v.colorGroupIds ?? []).some((id) => selectedColorGroupIds.includes(id))
      );

      if (!matching.length) {
        // No variant specifically tagged — fall back to showing the base card once
        if (!seen.has(product.id)) {
          seen.add(product.id);
          items.push({ product, forcedVariant: null, key: product.id });
        }
        continue;
      }

      for (const variant of matching) {
        if (!seen.has(variant.id)) {
          seen.add(variant.id);
          // If the matching variant IS the base product, don't force a variant
          const forcedVariant = variant.id === product.id ? null : variant;
          items.push({ product, forcedVariant, key: `${product.id}__${variant.id}` });
        }
      }
    }

    return items;
  }, [filteredProducts, selectedColorGroupIds]);

  const count =
    view === "outfits" ? filteredOutfits.length : displayItems.length;

  // Reset to page 1 whenever filters/sort/view change
  useEffect(() => { setPage(1); }, [sort, view, searchQuery, selectedBrands, selectedSubcategories, selectedOccasions, selectedGender, maxPrice, selectedColorGroupIds, aiOnly, selectedStyle]);

  const totalPages = Math.ceil(count / PAGE_SIZE);
  const pagedItems = useMemo(
    () => displayItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [displayItems, page, PAGE_SIZE]
  );
  const pagedOutfits = useMemo(
    () => filteredOutfits.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredOutfits, page, PAGE_SIZE]
  );

  /* Browse context passed to the AI Stylist — mirrors active filter state */
  const browseContext = useMemo(() => ({
    view,
    searchQuery: searchQuery || undefined,
    categories: selectedSubcategories.length ? selectedSubcategories : undefined,
    brands: selectedBrands.length ? selectedBrands : undefined,
    occasions: selectedOccasions.length ? (selectedOccasions as string[]) : undefined,
    gender: selectedGender ?? undefined,
    priceLabel: maxPrice !== null ? `<$${maxPrice.toLocaleString()}` : undefined,
    visibleCount: count,
  }), [view, searchQuery, selectedSubcategories, selectedBrands, selectedOccasions, selectedGender, maxPrice, count]);

  const filteredBrandsForSearch = BRANDS.filter(
    (b) => !brandSearch || b.toLowerCase().includes(brandSearch.toLowerCase())
  );

  /* Sidebar filter content — matches builder style exactly */
  const renderFilters = () => (
    <div>
      {/* MY LIKED ITEMS */}
      <div className="border-b border-[var(--border)] px-5 py-4">
        <button
          onClick={() => setLikedOnly((v) => !v)}
          className="w-full flex items-center justify-between group"
        >
          <span className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
              <path d="M8 13.5C8 13.5 2 9.5 2 5.5C2 3.567 3.567 2 5.5 2C6.695 2 7.739 2.6 8.368 3.531C8.997 2.6 10.041 2 11.236 2C13.169 2 14.736 3.567 14.736 5.5C14.736 9.5 8 13.5 8 13.5Z" stroke="currentColor" strokeWidth="1.5" fill={likedOnly ? "currentColor" : "none"} />
            </svg>
            <span className="text-[13px] tracking-[0.15em] uppercase font-black text-[var(--foreground)]" style={{ textShadow: "0 0 14px rgba(255,255,255,0.4)" }}>My Liked Items</span>
          </span>
          <svg width="11" height="11" viewBox="0 0 9 9" fill="none" className={`text-[var(--foreground)] transition-transform duration-200 ${likedOnly ? "rotate-180" : ""}`}>
            <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {view === "outfits" ? (
        <>
          {/* OCCASION */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[13px] tracking-[0.15em] uppercase font-black text-[var(--foreground)] mb-3" style={{ textShadow: "0 0 14px rgba(255,255,255,0.4)" }}>Occasion</p>
            <button
              onClick={() => setOccasionOpen(v => !v)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border transition-all duration-150 ${
                occasionOpen || selectedOccasions.length > 0
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-[var(--border-strong)] text-[var(--foreground)] opacity-55 hover:opacity-100 hover:border-[var(--foreground)]"
              }`}
            >
              <span className="text-[13px] font-bold capitalize">
                {selectedOccasions.length === 0 ? "All" : selectedOccasions.length === 1 ? selectedOccasions[0] : `${selectedOccasions.length} selected`}
              </span>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className={`transition-transform duration-200 ${occasionOpen ? "rotate-180" : ""}`}>
                <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {occasionOpen && (
              <div className="mt-3 border border-[var(--border)] rounded-xl overflow-hidden">
                <button
                  onClick={() => setSelectedOccasions([])}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--surface)] transition-colors"
                >
                  <span className={`text-[14px] font-bold ${selectedOccasions.length === 0 ? "text-[var(--foreground)]" : "text-[var(--foreground)] opacity-50"}`}>All</span>
                  {selectedOccasions.length === 0 && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                </button>
                {OCCASIONS.map((occ, i) => {
                  const isChk = selectedOccasions.includes(occ);
                  return (
                    <button key={occ} onClick={() => toggleOccasion(occ)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-[var(--surface)] ${i >= 0 ? "border-t border-[var(--border)]" : ""}`}
                    >
                      <span className={`text-[14px] font-bold capitalize ${isChk ? "text-[var(--foreground)]" : "text-[var(--foreground)] opacity-50"}`}>{occ}</span>
                      <div className="shrink-0 flex items-center justify-center border transition-colors" style={{ width: 16, height: 16, borderRadius: "50%", background: isChk ? "var(--foreground)" : "transparent", borderColor: isChk ? "var(--foreground)" : "var(--border-strong)" }}>
                        {isChk && <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* AI ONLY */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[13px] tracking-[0.15em] uppercase font-black text-[var(--foreground)] mb-3" style={{ textShadow: "0 0 14px rgba(255,255,255,0.4)" }}>Curated by AI</p>
            <button
              onClick={() => setAiOnly((v) => !v)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-150 ${
                aiOnly
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                  : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <span className="text-[11px] font-semibold">AI outfits only</span>
              {aiOnly && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* CATEGORY */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <button
              onClick={() => setCategoryOpen(v => !v)}
              className="w-full flex items-center justify-between mb-0 group"
            >
              <p className="text-[13px] tracking-[0.15em] uppercase font-black text-[var(--foreground)] group-hover:opacity-80 transition-opacity" style={{ textShadow: "0 0 14px rgba(255,255,255,0.4)" }}>Category</p>
              <svg width="11" height="11" viewBox="0 0 9 9" fill="none" className={`text-[var(--foreground)] transition-transform duration-200 ${categoryOpen ? "rotate-180" : ""}`}>
                <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {categoryOpen && (
            <div className="mt-3 border border-[var(--border)] rounded-xl overflow-hidden">
              {/* All */}
              <button
                onClick={() => setSelectedSubcategories([])}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--surface)] transition-colors"
              >
                <span className={`text-[14px] font-bold ${selectedSubcategories.length === 0 ? "text-[var(--foreground)]" : "text-[var(--foreground)] opacity-50"}`}>All</span>
                {selectedSubcategories.length === 0 && (
                  <svg width="12" height="9" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </button>
              {BROWSE_CATEGORY_GROUPS.map(group => {
                const grpOpen = expandedCategoryGroups.has(group.id);
                const grpLabels = group.items.map(i => i.label);
                const grpViewAllChecked = grpLabels.every(l => selectedSubcategories.includes(l));
                const grpActive = grpLabels.some(l => selectedSubcategories.includes(l));
                return (
                  <div key={group.id} className="border-t border-[var(--border)]">
                    {/* Group header */}
                    <button
                      onClick={() => setExpandedCategoryGroups(prev => {
                        const next = new Set(prev);
                        next.has(group.id) ? next.delete(group.id) : next.add(group.id);
                        return next;
                      })}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--surface)] transition-colors"
                    >
                      <span className={`shrink-0 text-base ${grpActive ? "text-[var(--foreground)]" : "text-[var(--foreground)] opacity-50"}`}>{group.icon}</span>
                      <span className={`flex-1 text-left text-[14px] font-bold ${grpActive ? "text-[var(--foreground)]" : "text-[var(--foreground)] opacity-50"}`}>{group.label}</span>
                      <svg width="11" height="11" viewBox="0 0 9 9" fill="none" className={`text-[var(--foreground)] opacity-50 transition-transform duration-200 ${grpOpen ? "rotate-180" : ""}`}>
                        <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {grpOpen && (
                      <>
                        {/* View all */}
                        <button
                          onClick={() => setSelectedSubcategories(prev =>
                            grpViewAllChecked
                              ? prev.filter(l => !grpLabels.includes(l))
                              : [...new Set([...prev, ...grpLabels])]
                          )}
                          className="w-full flex items-center justify-between pl-6 pr-4 py-2.5 hover:bg-[var(--surface)] transition-colors"
                        >
                          <span className={`text-[13px] font-black tracking-wide uppercase ${grpViewAllChecked ? "text-[var(--foreground)]" : "text-[var(--foreground)] opacity-50"}`}>View all</span>
                          <div className="shrink-0 flex items-center justify-center border-2 transition-all" style={{ width: 20, height: 20, borderRadius: "50%", background: grpViewAllChecked ? "var(--foreground)" : "transparent", borderColor: grpViewAllChecked ? "var(--foreground)" : "rgba(255,255,255,0.2)" }}>
                            {grpViewAllChecked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="var(--background)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </div>
                        </button>
                        {/* Sub-items */}
                        {group.items.map(item => {
                          const isChk = selectedSubcategories.includes(item.label);
                          return (
                            <button
                              key={item.label}
                              onClick={() => toggleSubcategory(item.label)}
                              className={`w-full flex items-center justify-between pl-6 pr-4 py-2.5 hover:bg-[var(--surface)] transition-colors ${isChk ? "bg-[var(--surface)]" : ""}`}
                            >
                              <span className={`text-[14px] font-semibold transition-opacity ${isChk ? "text-[var(--foreground)]" : "text-[var(--foreground)] opacity-60"}`}>{item.label}</span>
                              <div className="shrink-0 flex items-center justify-center border-2 transition-all" style={{ width: 20, height: 20, borderRadius: "50%", background: isChk ? "var(--foreground)" : "transparent", borderColor: isChk ? "var(--foreground)" : "rgba(255,255,255,0.2)" }}>
                                {isChk && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="var(--background)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
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
          {/* GENDER */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <button
              onClick={() => setGenderOpen(v => !v)}
              className="w-full flex items-center justify-between group"
            >
              <p className="text-[13px] tracking-[0.15em] uppercase font-black text-[var(--foreground)] group-hover:opacity-80 transition-opacity" style={{ textShadow: "0 0 14px rgba(255,255,255,0.4)" }}>
                Gender{selectedGender !== null && <span className="ml-2 text-[10px] font-semibold opacity-60 capitalize">— {selectedGender}</span>}
              </p>
              <svg width="11" height="11" viewBox="0 0 9 9" fill="none" className={`text-[var(--foreground)] transition-transform duration-200 ${genderOpen ? "rotate-180" : ""}`}>
                <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {genderOpen && (
              <div className="mt-3 border border-[var(--border)] rounded-xl overflow-hidden">
                {([null, "women", "men", "unisex"] as (Gender | null)[]).map((g, i) => {
                  const label = g === null ? "All" : g.charAt(0).toUpperCase() + g.slice(1);
                  const isActive = selectedGender === g;
                  return (
                    <button key={label}
                      onClick={() => { setSelectedGender(g); setGenderOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-[var(--surface)] ${i > 0 ? "border-t border-[var(--border)]" : ""}`}
                    >
                      <span className={`text-[14px] font-bold ${isActive ? "text-[var(--foreground)]" : "text-[var(--foreground)] opacity-50"}`}>{label}</span>
                      {isActive && (
                        <svg width="12" height="9" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* COLORS */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <button
              onClick={() => setColorsOpen(v => !v)}
              className="w-full flex items-center justify-between group"
            >
              <p className="text-[13px] tracking-[0.15em] uppercase font-black text-[var(--foreground)] group-hover:opacity-80 transition-opacity" style={{ textShadow: "0 0 14px rgba(255,255,255,0.4)" }}>Colors</p>
              <svg width="11" height="11" viewBox="0 0 9 9" fill="none" className={`text-[var(--foreground)] transition-transform duration-200 ${colorsOpen ? "rotate-180" : ""}`}>
                <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {colorsOpen && (<>
            <div className="flex flex-wrap gap-2.5 mt-3">
              {(showAllColors ? colorGroups : colorGroups.slice(0, 6)).map((cg) => {
                const isActive = selectedColorGroupIds.includes(cg.id);
                return (
                  <button
                    key={cg.id}
                    title={cg.name}
                    onClick={() => toggleColorGroup(cg.id)}
                    className={`w-9 h-9 rounded-full cursor-pointer transition-all ${isActive ? "scale-110" : "opacity-70 hover:opacity-100 hover:scale-105"}`}
                    style={{
                      background: cg.hexCode === "#multicolor" ? "conic-gradient(red,orange,yellow,green,blue,violet,red)" : cg.hexCode,
                      boxShadow: isActive
                        ? "0 0 0 2px var(--background), 0 0 0 3.5px var(--foreground)"
                        : "inset 0 0 0 1px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.06)",
                    }}
                  />
                );
              })}
            </div>
            {colorGroups.length > 6 && (
              <button
                onClick={() => setShowAllColors((v) => !v)}
                className="mt-2 text-[12px] font-semibold text-[var(--foreground)] opacity-50 hover:opacity-100 transition-opacity underline underline-offset-2"
              >
                {showAllColors ? "Show less" : `Show ${colorGroups.length - 6} more`}
              </button>
            )}
            </>)}
          </div>
          {/* DESIGNER / BRANDS */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <button
              onClick={() => setBrandsOpen(v => !v)}
              className="w-full flex items-center justify-between group"
            >
              <p className="text-[13px] tracking-[0.15em] uppercase font-black text-[var(--foreground)] group-hover:opacity-80 transition-opacity" style={{ textShadow: "0 0 14px rgba(255,255,255,0.4)" }}>Designer</p>
              <svg width="11" height="11" viewBox="0 0 9 9" fill="none" className={`text-[var(--foreground)] transition-transform duration-200 ${brandsOpen ? "rotate-180" : ""}`}>
                <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {brandsOpen && (<>
            <div className="relative mb-3 mt-3">
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Search brands…"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-base md:text-[13px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--border-strong)] transition-colors"
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
            <div className="flex flex-col gap-0.5">
              {filteredBrandsForSearch.slice(0, showAllBrands ? undefined : 8).map((brand) => {
                const isActive = selectedBrands.includes(brand);
                return (
                  <button
                    key={brand}
                    onClick={() => toggleBrand(brand)}
                    className="w-full flex items-center justify-between px-1 py-2.5 hover:bg-[var(--surface)] rounded-lg transition-colors"
                  >
                    <span className={`text-[13px] truncate text-left font-semibold ${isActive ? "text-[var(--foreground)]" : "text-[var(--foreground)] opacity-55"}`}>
                      {brand}
                    </span>
                    <div className="shrink-0 flex items-center justify-center border transition-colors ml-2" style={{ width: 18, height: 18, borderRadius: "50%", background: isActive ? "var(--foreground)" : "transparent", borderColor: isActive ? "var(--foreground)" : "var(--border-strong)" }}>
                      {isActive && <svg width="9" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                  </button>
                );
              })}
              {filteredBrandsForSearch.length === 0 && (
                <p className="px-1 py-2 text-[13px] text-[var(--foreground)] opacity-40">No brands found</p>
              )}
            </div>
            {filteredBrandsForSearch.length > 8 && (
              <button
                onClick={() => setShowAllBrands((v) => !v)}
                className="mt-2 text-[12px] font-semibold text-[var(--foreground)] opacity-50 hover:opacity-100 transition-opacity underline underline-offset-2"
              >
                {showAllBrands ? "Show less" : `Show ${filteredBrandsForSearch.length - 8} more`}
              </button>
            )}
            </>)}
          </div>
        </>
      )}
      {/* PRICE */}
      <div className="border-b border-[var(--border)] px-5 py-4">
        <button
          onClick={() => setPriceOpen(v => !v)}
          className="w-full flex items-center justify-between group"
        >
          <p className="text-[13px] tracking-[0.15em] uppercase font-black text-[var(--foreground)] group-hover:opacity-80 transition-opacity" style={{ textShadow: "0 0 14px rgba(255,255,255,0.4)" }}>
            Price{maxPrice !== null && maxPrice < 2000 && <span className="ml-2 text-[10px] font-semibold opacity-60">{`— < $${maxPrice.toLocaleString()}`}</span>}
          </p>
          <svg width="11" height="11" viewBox="0 0 9 9" fill="none" className={`text-[var(--foreground)] transition-transform duration-200 ${priceOpen ? "rotate-180" : ""}`}>
            <path d="M1.5 3L4.5 6L7.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {priceOpen && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-[var(--foreground)] opacity-40">$0</span>
              <span className="text-[13px] font-bold text-[var(--foreground)]">
                {maxPrice !== null && maxPrice < 2000 ? `$${maxPrice.toLocaleString()}` : "$2,000+"}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2000}
              step={50}
              value={maxPrice ?? 2000}
              onChange={(e) => {
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
                  className={`px-3.5 py-1.5 rounded-full border text-[12px] font-bold transition-all ${
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
        )}
      </div>
      {/* CLEAR FILTERS */}
      {activeFiltersCount > 0 && (
        <div className="px-5 py-4">
          <button
            onClick={clearAll}
            className="w-full py-2 rounded-lg border border-[var(--border-strong)] text-[10px] tracking-[0.12em] uppercase font-bold text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto">
        {/* ── Page header ── */}
        <div className="px-6 md:px-12 pt-12 md:pt-16">
          <div className="mb-8">
            <h1 className="text-6xl md:text-8xl font-black uppercase text-[var(--foreground)] leading-none tracking-tight">
              Browse
            </h1>
            <p className="mt-3 text-sm font-medium text-[var(--foreground-muted)] max-w-xs leading-relaxed">
              Curated pieces from the world's most forward-thinking brands.
            </p>
            <div className="mt-6 border-t border-[var(--border)]" />
          </div>

          {/* View tabs — moved to toolbar */}
        </div>


        {/* ── FILTER SIDEBAR OVERLAY ── */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              key="filter-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setFiltersOpen(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              key="filter-sidebar"
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.8 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-[var(--background)] border-r border-[var(--border)] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
                <p className="text-[15px] tracking-[0.14em] uppercase font-black text-[var(--foreground)]" style={{ textShadow: "0 0 14px rgba(255,255,255,0.3)" }}>Filters</p>
                <motion.button
                  onClick={() => setFiltersOpen(false)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-1.5 -mr-1.5 rounded-full bg-[var(--surface)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                    <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </motion.button>
              </div>
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                {renderFilters()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div>
          <main className="px-6 md:px-8 lg:px-10">
            {/* Toolbar: flex row, items-end so chips align with bottom pill */}
            <div className="pt-4 pb-4 border-b border-[var(--border)]">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-3 sm:flex-nowrap">

                {/* Left column: Filter+Search on top, Pieces/Outfits below.
                    Full width on mobile so the segmented toggle never clips. */}
                <div className="flex flex-col gap-3 shrink-0 w-full sm:w-auto">
                  <div className="flex gap-2 items-center">
                    {/* Filter */}
                    <button
                      onClick={() => { setStylistOpen(false); setFiltersOpen(v => !v); }}
                      className={`shrink-0 flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase font-bold border rounded-full px-3 sm:px-5 py-2.5 transition-all duration-200 ${
                        filtersOpen
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : "border-[var(--foreground-muted)] text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)]"
                      }`}
                    >
                      <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                        <path d="M1 1.5H12M3 5H10M5 8.5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      <span className="hidden sm:inline">Filter</span>
                      {activeFiltersCount > 0 && (
                        <span className="w-4 h-4 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[8px] font-bold flex items-center justify-center">
                          {activeFiltersCount}
                        </span>
                      )}
                    </button>

                    {/* Search */}
                    <div className="shrink-0 relative">
                      <AnimatePresence mode="wait" initial={false}>
                        {!searchOpen ? (
                          <motion.button
                            key="search-btn"
                            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.92 }}
                            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                            className="flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase font-bold border border-[var(--foreground-muted)] rounded-full px-3 sm:px-5 py-2.5 text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-colors duration-200"
                          >
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                            <span className="hidden sm:inline">Search</span>
                          </motion.button>
                        ) : (
                          <motion.div
                            key="search-input"
                            initial={{ opacity: 0, width: 80, scale: 0.96 }}
                            animate={{ opacity: 1, width: searchExpandedWidth, scale: 1 }}
                            exit={{ opacity: 0, width: 80, scale: 0.96 }}
                            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                            className="flex items-center border border-[var(--foreground)] rounded-full pl-3.5 pr-1.5 py-1.5 overflow-hidden"
                          >
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[var(--foreground-muted)]">
                              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                              <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                            <input
                              ref={searchInputRef}
                              type="text"
                              placeholder="Search…"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="bg-transparent outline-none text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] text-base md:text-[11px] mx-2 min-w-0 flex-1"
                            />
                            <button
                              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                              className="w-6 h-6 rounded-full bg-[var(--border)] hover:bg-[var(--border-strong)] flex items-center justify-center shrink-0 transition-colors"
                            >
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-[var(--foreground)]" />
                              </svg>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Pieces/Outfits pill — w-full fills column = Filter+Search width */}
                  <div className="w-full relative flex border border-[var(--foreground-muted)] rounded-full overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 w-1/2 bg-[var(--foreground)] rounded-full"
                      animate={{ x: view === "pieces" ? "0%" : "100%" }}
                      transition={{ type: "spring", stiffness: 500, damping: 42, mass: 0.8 }}
                    />
                    {(["pieces", "outfits"] as View[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          if (v !== view) {
                            setView(v);
                            setSelectedBrands([]); setSelectedSubcategories([]); setSelectedOccasions([]);
                            setSelectedColorGroupIds([]); setAiOnly(false); setMaxPrice(null);
                            setSearchQuery(""); setSearchOpen(false); setSelectedStyle(null);
                            const url = new URL(window.location.href); url.searchParams.set("view", v);
                            window.history.replaceState({}, "", url.toString());
                          }
                        }}
                        className="relative z-10 flex-1 py-2.5 text-[11px] tracking-[0.14em] uppercase font-bold whitespace-nowrap transition-colors duration-200 text-center"
                        style={{ color: view === v ? "var(--background)" : "var(--foreground-muted)" }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider + style chips — centered with Pieces/Outfits pill, scrollable */}
                <div
                  className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto self-end pb-[1px] no-scrollbar"
                >
                  <div className="hidden sm:block w-px h-5 shrink-0 bg-[var(--border)]" />
                  {STYLE_FILTERS.map((style) => (
                    <button
                      key={style}
                      onClick={() => setSelectedStyle(selectedStyle === style ? null : style)}
                      className={`shrink-0 px-3 py-1.5 text-[10px] tracking-[0.08em] sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.12em] rounded-full uppercase font-bold border transition-all duration-200 whitespace-nowrap ${
                        selectedStyle === style
                          ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                          : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>

                {/* Sort — self-start aligns with Filter+Search on desktop; on the
                    wrapped mobile row it sits beside the scrollable style chips */}
                <div className="relative shrink-0 self-end sm:self-start" ref={sortRef}>
                  <button
                    onClick={() => setSortOpen((o) => !o)}
                    className={`flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase font-bold border rounded-full px-3 sm:px-5 py-2.5 transition-all duration-200 ${
                      sortOpen
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                        : "border-[var(--foreground-muted)] text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)]"
                    }`}
                  >
                    <svg width="11" height="10" viewBox="0 0 11 10" fill="none">
                      <path d="M1 1.5H10M2.5 5H8.5M4 8.5H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <span className="hidden sm:inline">
                      {sort === "featured" && "Featured"}
                      {sort === "price-asc" && "Price ↑"}
                      {sort === "price-desc" && "Price ↓"}
                      {sort === "newest" && "Newest"}
                    </span>
                    {sort !== "featured" && (
                      <span className="sm:hidden text-[9px]">
                        {sort === "price-asc" && "↑"}
                        {sort === "price-desc" && "↓"}
                        {sort === "newest" && "New"}
                      </span>
                    )}
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}>
                      <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {sortOpen && (
                    <div className="absolute right-0 top-full mt-2 z-50 min-w-[140px] bg-[var(--background)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden">
                      {([
                        { value: "featured", label: "Featured" },
                        { value: "price-asc", label: "Price ↑" },
                        { value: "price-desc", label: "Price ↓" },
                        { value: "newest", label: "Newest" },
                      ] as { value: SortOption; label: string }[]).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setSort(opt.value); setSortOpen(false); }}
                          className={`w-full text-left px-5 py-3 text-[10px] tracking-[0.14em] uppercase font-bold transition-colors duration-150 flex items-center justify-between gap-3 ${
                            sort === opt.value
                              ? "text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
                              : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)]"
                          }`}
                        >
                          {opt.label}
                          {sort === opt.value && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>


            {/* Active filter chips */}
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-4">
                <AnimatePresence>
                {selectedBrands.map((brand) => (
                  <motion.div
                    key={brand}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    layout
                  >
                    <ActiveChip
                      label={brand}
                      onRemove={() => toggleBrand(brand)}
                    />
                  </motion.div>
                ))}
                {selectedSubcategories.map((sub) => (
                  <motion.div
                    key={sub}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    layout
                  >
                    <ActiveChip
                      label={sub}
                      onRemove={() => toggleSubcategory(sub)}
                    />
                  </motion.div>
                ))}
                {selectedOccasions.map((occ) => (
                  <motion.div
                    key={occ}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    layout
                  >
                    <ActiveChip
                      label={occ}
                      onRemove={() => toggleOccasion(occ)}
                    />
                  </motion.div>
                ))}
                {selectedGender && (
                  <motion.div
                    key="gender"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    layout
                  >
                    <ActiveChip
                      label={selectedGender}
                      onRemove={() => setSelectedGender(null)}
                    />
                  </motion.div>
                )}
                {maxPrice !== null && (
                  <motion.div
                    key="price"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    layout
                  >
                    <ActiveChip
                      label={maxPrice < 2000 ? `<$${maxPrice.toLocaleString()}` : "<$2k"}
                      onRemove={() => setMaxPrice(null)}
                    />
                  </motion.div>
                )}
                {selectedColorGroupIds.map((id) => {
                  const cg = colorGroups.find((g) => g.id === id);
                  if (!cg) return null;
                  return (
                    <motion.div
                      key={id}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.15 }}
                      layout
                    >
                      <button
                        onClick={() => toggleColorGroup(id)}
                        className="flex items-center gap-1.5 text-[9px] tracking-[0.10em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-2.5 py-1 hover:bg-[var(--fg-overlay-05)] transition-colors duration-200 rounded-full"
                      >
                        <span
                          className="w-2.5 h-2.5 shrink-0 rounded-full"
                          style={
                            cg.hexCode === "#multicolor"
                              ? { background: "conic-gradient(red, orange, yellow, green, blue, violet, red)" }
                              : { backgroundColor: cg.hexCode }
                          }
                        />
                        {cg.name}
                        <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                          <path d="M1 1L6 6M6 1L1 6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                        </svg>
                      </button>
                    </motion.div>
                  );
                })}
                {aiOnly && (
                  <motion.div
                    key="aiOnly"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    layout
                  >
                    <ActiveChip label="AI Only" onRemove={() => setAiOnly(false)} />
                  </motion.div>
                )}
                {selectedStyle && (
                  <motion.div
                    key="style"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    layout
                  >
                    <ActiveChip label={selectedStyle} onRemove={() => setSelectedStyle(null)} />
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            )}


            {/* Product / Outfit grid */}
            <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mt-10 pb-16"
            >
              {view === "outfits" && loadingOutfits ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
                      <div className="animate-pulse p-2">
                        <div className="bg-[var(--surface)] aspect-[3/4] w-full mb-3" />
                        <div className="bg-[var(--surface)] h-3 w-3/4 mb-2" />
                        <div className="bg-[var(--surface)] h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : view === "pieces" && loadingProducts ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
                      <div className="animate-pulse p-2">
                        <div className="bg-[var(--surface)] aspect-[3/4] w-full mb-3" />
                        <div className="bg-[var(--surface)] h-3 w-3/4 mb-2" />
                        <div className="bg-[var(--surface)] h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : view === "outfits" ? (
                filteredOutfits.length > 0 ? (
                  <motion.div
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 stagger-children"
                    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
                    initial="hidden"
                    animate="show"
                  >
                    {pagedOutfits.map((outfit) => (
                      <motion.div
                        key={outfit.id}
                        className="rounded-xl bg-[var(--background)] hover:shadow-md transition-all duration-200"
                        variants={{ hidden: { opacity: 0, y: 16, filter: 'blur(8px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring' as const, bounce: 0.2, duration: 0.8 } } }}
                      >
                        <OutfitCard outfit={outfit} />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <EmptyState onClear={clearAll} noun="outfits" />
                )
              ) : displayItems.length > 0 ? (
                <motion.div
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 stagger-children"
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
                  initial="hidden"
                  animate="show"
                >
                  {pagedItems.map(({ product, forcedVariant, key }) => (
                    <motion.div
                      key={key}
                      className="rounded-xl bg-[var(--background)] hover:shadow-md transition-all duration-200"
                      variants={{ hidden: { opacity: 0, y: 16, filter: 'blur(8px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring' as const, bounce: 0.2, duration: 0.8 } } }}
                    >
                      <ProductCard product={product} initialVariant={forcedVariant} />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <EmptyState onClear={clearAll} noun="pieces" />
              )}

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 pb-6 border-t border-[var(--border)] mt-6">
                  <span className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)} of {count} {view === "outfits" ? "outfits" : "pieces"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      disabled={page === 1}
                      className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
                    >
                      <svg width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M6 1L1 5.5L6 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                      let p: number;
                      if (totalPages <= 7) {
                        p = i + 1;
                      } else if (page <= 4) {
                        p = i < 5 ? i + 1 : i === 5 ? -1 : totalPages;
                      } else if (page >= totalPages - 3) {
                        p = i === 0 ? 1 : i === 1 ? -1 : totalPages - 6 + i;
                      } else {
                        p = i === 0 ? 1 : i === 1 ? -1 : i === 5 ? -1 : i === 6 ? totalPages : page + i - 3;
                      }
                      if (p === -1) {
                        return <span key={`ellipsis-${i}`} className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-[9px] text-[var(--foreground-subtle)]">…</span>;
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          className={`w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-[10px] tracking-[0.08em] transition-colors duration-150 ${
                            page === p
                              ? "bg-[var(--foreground)] text-[var(--background)] rounded-lg"
                              : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      disabled={page === totalPages}
                      className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
                    >
                      <svg width="7" height="11" viewBox="0 0 7 11" fill="none"><path d="M1 1L6 5.5L1 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* ── AI Stylist drawer ── */}
      <StylistDrawer
        isOpen={stylistOpen}
        onClose={() => setStylistOpen(false)}
        surface="browse"
        products={catalogProducts}
        browseContext={browseContext}
      />

    </div>
  );
}

function EmptyState({
  onClear,
  noun,
}: {
  onClear: () => void;
  noun: string;
}) {
  return (
    <div className="py-24 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)] mx-2">
      <p className="text-xl font-semibold text-[var(--foreground)] mb-2">
        No {noun} found
      </p>
      <p className="text-sm text-[var(--foreground-muted)] mb-4">
        Try adjusting your search or filters
      </p>
      <button
        onClick={onClear}
        className="text-xs text-[var(--foreground)] link-underline"
      >
        Clear all filters
      </button>
    </div>
  );
}
