"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OutfitCard from "@/components/outfit/OutfitCard";
import ProductCard from "@/components/product/ProductCard";
import type { Category, ColorGroup, Gender, Occasion, Outfit, Product, ProductSwatch } from "@/lib/types";
import { StylistDrawer } from "@/components/stylist/StylistDrawer";

type View = "outfits" | "pieces";
type SortOption = "featured" | "price-asc" | "price-desc" | "newest";

const CATEGORIES: Category[] = [
  "outerwear", "tops", "bottoms", "knitwear", "dresses", "footwear", "accessories",
];
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

/* ── Reusable filter UI atoms ── */

function FilterCheckbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2.5 w-full py-[5px] group text-left"
    >
      <div
        className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 transition-all duration-150 ${
          checked
            ? "border-[var(--foreground)] bg-[var(--foreground)]"
            : "border-[var(--border-strong)] group-hover:border-[var(--foreground)]"
        }`}
      >
        {checked && (
          <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
            <path
              d="M1 2.5L2.5 4L6 1"
              stroke="var(--background)"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span
        className={`text-xs capitalize transition-colors duration-200 ${
          checked
            ? "text-[var(--foreground)] font-medium"
            : "text-[var(--foreground-muted)] group-hover:text-[var(--foreground)]"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

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

function FilterSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | "";
  options: { value: T; label: string }[];
  onChange: (v: T | "") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentLabel = options.find((o) => o.value === value)?.label ?? "All";

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  return (
    <div ref={ref} className="relative w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-150 text-xs text-left ${
          open
            ? "border-[var(--foreground)] bg-[var(--surface)]"
            : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
        }`}
      >
        <span
          className={`capitalize font-medium tracking-wide ${
            value ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"
          }`}
        >
          {currentLabel}
        </span>
        <motion.svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="shrink-0 text-[var(--foreground-muted)]"
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.94 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.94 }}
            transition={{ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ transformOrigin: "top" }}
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.10)] overflow-hidden"
          >
            {/* All option */}
            <button
              onClick={() => { onChange(""); close(); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors duration-100 ${
                value === ""
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "text-[var(--foreground-muted)] hover:bg-[var(--fg-overlay-05)] hover:text-[var(--foreground)]"
              }`}
            >
              <span className="capitalize font-medium">All</span>
              {value === "" && (
                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                  <path d="M1 3.5L3.5 6L8 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            {options.map((opt, i) => (
              <motion.button
                key={opt.value}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.12, delay: i * 0.03 }}
                onClick={() => { onChange(opt.value); close(); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-colors duration-100 border-t border-[var(--border)] ${
                  value === opt.value
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--foreground-muted)] hover:bg-[var(--fg-overlay-05)] hover:text-[var(--foreground)]"
                }`}
              >
                <span className="capitalize font-medium">{opt.label}</span>
                {value === opt.value && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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

  // Restore tab from URL on mount (survives browser back navigation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v === "pieces" || v === "outfits") setView(v);
  }, []);
  const [sort, setSort] = useState<SortOption>("featured");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [selectedOccasions, setSelectedOccasions] = useState<Occasion[]>([]);
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [selectedColorGroupIds, setSelectedColorGroupIds] = useState<number[]>([]);
  const [aiOnly, setAiOnly] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllColors, setShowAllColors] = useState(false);

  /* Togglers */
  const toggleBrand = (b: string) =>
    setSelectedBrands((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b]));
  const toggleCategory = (c: Category) =>
    setSelectedCategories((p) =>
      p.includes(c) ? p.filter((x) => x !== c) : [...p, c]
    );
  const toggleOccasion = (o: Occasion) =>
    setSelectedOccasions((p) =>
      p.includes(o) ? p.filter((x) => x !== o) : [...p, o]
    );

  const toggleColorGroup = (id: number) =>
    setSelectedColorGroupIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const activeFiltersCount =
    selectedBrands.length +
    selectedCategories.length +
    selectedOccasions.length +
    selectedColorGroupIds.length +
    (selectedGender !== null ? 1 : 0) +
    (maxPrice !== null ? 1 : 0) +
    (aiOnly ? 1 : 0);

  const clearAll = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
    setSelectedOccasions([]);
    setSelectedGender(null);
    setMaxPrice(null);
    setSelectedColorGroupIds([]);
    setAiOnly(false);
    setSearchQuery("");
  };

  /* Filtered data */
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let r = products
      .filter((p) => !selectedBrands.length || selectedBrands.includes(p.brand))
      .filter(
        (p) =>
          !selectedCategories.length ||
          selectedCategories.includes(p.category as Category)
      )
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
      );

    if (sort === "price-asc") r = [...r].sort((a, b) => a.priceMin - b.priceMin);
    else if (sort === "price-desc")
      r = [...r].sort((a, b) => b.priceMax - a.priceMax);
    else if (sort === "newest")
      r = [...r].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    return r;
  }, [products, selectedBrands, selectedCategories, selectedGender, maxPrice, selectedColorGroupIds, searchQuery, sort]);

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
  }, [catalogOutfits, selectedOccasions, aiOnly, maxPrice, searchQuery, sort]);

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
  useEffect(() => { setPage(1); }, [sort, view, searchQuery, selectedBrands, selectedCategories, selectedOccasions, selectedGender, maxPrice, selectedColorGroupIds, aiOnly]);

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
    categories: selectedCategories.length ? (selectedCategories as string[]) : undefined,
    brands: selectedBrands.length ? selectedBrands : undefined,
    occasions: selectedOccasions.length ? (selectedOccasions as string[]) : undefined,
    gender: selectedGender ?? undefined,
    priceLabel: maxPrice !== null ? `<$${maxPrice.toLocaleString()}` : undefined,
    visibleCount: count,
  }), [view, searchQuery, selectedCategories, selectedBrands, selectedOccasions, selectedGender, maxPrice, count]);

  const filteredBrandsForSearch = BRANDS.filter(
    (b) => !brandSearch || b.toLowerCase().includes(brandSearch.toLowerCase())
  );

  /* Sidebar filter content — matches builder style exactly */
  const renderFilters = () => (
    <div>
      {view === "outfits" ? (
        <>
          {/* OCCASION */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Occasion</p>
            <FilterSelect<Occasion>
              value={selectedOccasions[0] ?? ""}
              options={OCCASIONS.map((occ) => ({ value: occ, label: occ.charAt(0).toUpperCase() + occ.slice(1) }))}
              onChange={(v) => setSelectedOccasions(v ? [v] : [])}
            />
          </div>
          {/* AI ONLY */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Curated by AI</p>
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
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* CATEGORY */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Category</p>
            <FilterSelect<Category>
              value={selectedCategories[0] ?? ""}
              options={CATEGORIES.map((cat) => ({ value: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1) }))}
              onChange={(v) => setSelectedCategories(v ? [v] : [])}
            />
          </div>
          {/* GENDER */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Gender</p>
            <FilterSelect<Gender>
              value={selectedGender ?? ""}
              options={[
                { value: "women" as Gender, label: "Women" },
                { value: "men" as Gender, label: "Men" },
                { value: "unisex" as Gender, label: "Unisex" },
              ]}
              onChange={(v) => setSelectedGender((v || null) as Gender | null)}
            />
          </div>
          {/* COLORS */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Colors</p>
            <div className="flex flex-wrap gap-2">
              {(showAllColors ? colorGroups : colorGroups.slice(0, 6)).map((cg) => {
                const isActive = selectedColorGroupIds.includes(cg.id);
                return (
                  <button
                    key={cg.id}
                    title={cg.name}
                    onClick={() => toggleColorGroup(cg.id)}
                    className={`w-7 h-7 rounded-full cursor-pointer transition-all ${isActive ? "scale-110" : "opacity-75 hover:opacity-100 hover:scale-105"}`}
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
                className="mt-2 text-[10px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
              >
                {showAllColors ? "Show less" : `Show ${colorGroups.length - 6} more`}
              </button>
            )}
          </div>
          {/* DESIGNER / BRANDS */}
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="text-[9px] tracking-[0.16em] uppercase font-bold text-[var(--foreground-muted)] mb-3">Designer</p>
            <div className="relative mb-3">
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
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
            <div className="flex flex-col gap-0.5">
              {filteredBrandsForSearch.slice(0, showAllBrands ? undefined : 8).map((brand) => {
                const isActive = selectedBrands.includes(brand);
                return (
                  <label key={brand} className="flex items-center gap-2 px-1 py-1 cursor-pointer hover:bg-[var(--surface)] transition-colors">
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
                      onClick={() => toggleBrand(brand)}
                      className={`text-[11px] truncate text-left ${isActive ? "text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}
                    >
                      {brand}
                    </button>
                  </label>
                );
              })}
              {filteredBrandsForSearch.length === 0 && (
                <p className="px-1 py-2 text-[11px] text-[var(--foreground-subtle)]">No brands found</p>
              )}
            </div>
            {filteredBrandsForSearch.length > 8 && (
              <button
                onClick={() => setShowAllBrands((v) => !v)}
                className="mt-1.5 text-[10px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
              >
                {showAllBrands ? "Show less" : `Show ${filteredBrandsForSearch.length - 8} more`}
              </button>
            )}
          </div>
        </>
      )}
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

          {/* View tabs */}
          <div className="flex gap-0 mt-6 w-fit bg-[var(--surface)] rounded-full p-1 border border-[var(--border)]">
            {(["pieces", "outfits"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => {
                  if (v !== view) {
                    setView(v);
                    setSelectedBrands([]);
                    setSelectedCategories([]);
                    setSelectedOccasions([]);
                    setSelectedColorGroupIds([]);
                    setAiOnly(false);
                    setMaxPrice(null);
                    setSearchQuery("");
                    setSearchOpen(false);
                    const url = new URL(window.location.href);
                    url.searchParams.set("view", v);
                    window.history.replaceState({}, "", url.toString());
                  }
                }}
                className="relative px-6 py-2 text-xs tracking-[0.14em] uppercase font-bold rounded-full z-10 transition-colors duration-200"
                style={{ color: view === v ? "var(--background)" : "var(--foreground-muted)" }}
              >
                {view === v && (
                  <motion.div
                    layoutId="browse-tab-pill"
                    className="absolute inset-0 rounded-full bg-[var(--foreground)]"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    style={{ zIndex: -1 }}
                  />
                )}
                {v}
              </button>
            ))}
          </div>
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
              className="fixed inset-0 top-16 z-40 bg-black/20"
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
              className="fixed left-0 top-16 bottom-0 z-50 w-[280px] bg-[var(--background)] border-r border-[var(--border)] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
                <p className="text-[11px] tracking-[0.18em] uppercase font-bold text-[var(--foreground)]">Filters</p>
                <motion.button
                  onClick={() => setFiltersOpen(false)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
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
            {/* Top toolbar */}
            <div className="flex items-center justify-between py-4 border-b border-[var(--border)] overflow-visible">
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-visible">

                {/* Filter toggle button */}
                <button
                  onClick={() => { setStylistOpen(false); setFiltersOpen(v => !v); }}
                  className={`shrink-0 flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase font-bold border rounded-full px-5 py-2.5 transition-all duration-200 ${
                    filtersOpen
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      : "border-[var(--foreground-muted)] text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)]"
                  }`}
                >
                  <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                    <path d="M1 1.5H12M3 5H10M5 8.5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <span>Filter</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[8px] font-bold flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>


                {/* Search toggle */}
                <div className="shrink-0 relative">
                  <AnimatePresence mode="wait" initial={false}>
                    {!searchOpen ? (
                      <motion.button
                        key="search-btn"
                        onClick={() => {
                          setSearchOpen(true);
                          setTimeout(() => searchInputRef.current?.focus(), 50);
                        }}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase font-bold border border-[var(--foreground-muted)] rounded-full px-5 py-2.5 text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-colors duration-200"
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                          <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                        <span>Search</span>
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
                          className="bg-transparent outline-none text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] text-[11px] mx-2 min-w-0 flex-1"
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

              {/* Sort */}
              <div className="relative flex items-center gap-2 shrink-0 ml-4" ref={sortRef}>
                <button
                  onClick={() => setSortOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-[10px] tracking-[0.14em] uppercase font-bold text-[var(--foreground)] hover:text-[var(--foreground-muted)] transition-colors duration-200 cursor-pointer"
                >
                  {sort === "featured" && "Featured"}
                  {sort === "price-asc" && "Price ↑"}
                  {sort === "price-desc" && "Price ↓"}
                  {sort === "newest" && "Newest"}
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="none"
                    className={`transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-lg overflow-hidden">
                    {(
                      [
                        { value: "featured", label: "Featured" },
                        { value: "price-asc", label: "Price ↑" },
                        { value: "price-desc", label: "Price ↓" },
                        { value: "newest", label: "Newest" },
                      ] as { value: SortOption; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setSort(opt.value); setSortOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-[9px] tracking-[0.14em] uppercase transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl ${
                          sort === opt.value
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
                {selectedCategories.map((cat) => (
                  <motion.div
                    key={cat}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    layout
                  >
                    <ActiveChip
                      label={cat}
                      onRemove={() => toggleCategory(cat)}
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
                          className="w-2.5 h-2.5 shrink-0"
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
              className="mt-6 pb-16"
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
                    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                    initial="hidden"
                    animate="show"
                  >
                    {pagedOutfits.map((outfit) => (
                      <motion.div
                        key={outfit.id}
                        className="rounded-xl bg-[var(--background)] hover:shadow-md transition-all duration-200"
                        variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
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
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                  initial="hidden"
                  animate="show"
                >
                  {pagedItems.map(({ product, forcedVariant, key }) => (
                    <motion.div
                      key={key}
                      className="rounded-xl bg-[var(--background)] hover:shadow-md transition-all duration-200"
                      variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
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
                      className="w-8 h-8 flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
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
                        return <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-[9px] text-[var(--foreground-subtle)]">…</span>;
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          className={`w-8 h-8 flex items-center justify-center text-[10px] tracking-[0.08em] transition-colors duration-150 ${
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
                      className="w-8 h-8 flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
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
