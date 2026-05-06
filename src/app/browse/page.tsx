"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
const PRICE_RANGES = [
  { label: "Under $200", min: 0, max: 200 },
  { label: "$200 – $500", min: 200, max: 500 },
  { label: "$500 – $1,000", min: 500, max: 1000 },
  { label: "Over $1,000", min: 1000, max: Infinity },
];

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

function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--border)]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3.5 text-[10px] tracking-[0.16em] uppercase font-medium text-[var(--foreground)] hover:text-[var(--foreground-muted)] transition-colors duration-200"
      >
        <span>{title}</span>
        <span className="text-sm leading-none text-[var(--foreground-muted)] font-light">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

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
      className="flex items-center gap-1.5 text-[9px] tracking-[0.10em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-2.5 py-1 hover:bg-[var(--fg-overlay-05)] transition-colors duration-200 capitalize"
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
  const [selectedPriceIdx, setSelectedPriceIdx] = useState<number | null>(null);
  const [selectedColorGroupIds, setSelectedColorGroupIds] = useState<number[]>([]);
  const [aiOnly, setAiOnly] = useState(false);

  /* Accordion state */
  const [openSections, setOpenSections] = useState({
    brand: false,
    category: false,
    gender: false,
    color: false,
    occasion: false,
    price: false,
  });
  const toggleSection = (k: keyof typeof openSections) =>
    setOpenSections((p) => ({ ...p, [k]: !p[k] }));

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
    (selectedPriceIdx !== null ? 1 : 0) +
    (aiOnly ? 1 : 0);

  const clearAll = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
    setSelectedOccasions([]);
    setSelectedGender(null);
    setSelectedPriceIdx(null);
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
          selectedPriceIdx === null ||
          (p.priceMin >= PRICE_RANGES[selectedPriceIdx].min &&
            p.priceMin < PRICE_RANGES[selectedPriceIdx].max)
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
  }, [products, selectedBrands, selectedCategories, selectedGender, selectedPriceIdx, selectedColorGroupIds, searchQuery, sort]);

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
          selectedPriceIdx === null ||
          (o.totalPriceMin >= PRICE_RANGES[selectedPriceIdx].min &&
            o.totalPriceMin < PRICE_RANGES[selectedPriceIdx].max)
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
  }, [catalogOutfits, selectedOccasions, aiOnly, selectedPriceIdx, searchQuery, sort]);

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
  useEffect(() => { setPage(1); }, [sort, view, searchQuery, selectedBrands, selectedCategories, selectedOccasions, selectedGender, selectedPriceIdx, selectedColorGroupIds, aiOnly]);

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
    priceLabel: selectedPriceIdx !== null ? PRICE_RANGES[selectedPriceIdx].label : undefined,
    visibleCount: count,
  }), [view, searchQuery, selectedCategories, selectedBrands, selectedOccasions, selectedGender, selectedPriceIdx, count]);

  /* Sidebar filter content rendered as a function to get fresh JSX in both desktop + mobile */
  const renderFilters = () => (
    <div>
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground)]">
          Refinements
        </span>
        {activeFiltersCount > 0 && (
          <button
            onClick={clearAll}
            className="text-[9px] tracking-[0.10em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200 underline underline-offset-2"
          >
            Clear all
          </button>
        )}
      </div>

      {view === "outfits" ? (
        <>
          <AccordionSection
            title="Occasion"
            open={openSections.occasion}
            onToggle={() => toggleSection("occasion")}
          >
            <div className="flex flex-col">
              {OCCASIONS.map((occ) => (
                <FilterCheckbox
                  key={occ}
                  checked={selectedOccasions.includes(occ)}
                  onToggle={() => toggleOccasion(occ)}
                  label={occ}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            title="Curated by AI"
            open={openSections.category}
            onToggle={() => toggleSection("category")}
          >
            <FilterCheckbox
              checked={aiOnly}
              onToggle={() => setAiOnly(!aiOnly)}
              label="AI outfits only"
            />
          </AccordionSection>
        </>
      ) : (
        <>
          <AccordionSection
            title="Designer"
            open={openSections.brand}
            onToggle={() => toggleSection("brand")}
          >
            <div className="flex flex-col">
              {BRANDS.map((brand) => (
                <FilterCheckbox
                  key={brand}
                  checked={selectedBrands.includes(brand)}
                  onToggle={() => toggleBrand(brand)}
                  label={brand}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            title="Category"
            open={openSections.category}
            onToggle={() => toggleSection("category")}
          >
            <div className="flex flex-col">
              {CATEGORIES.map((cat) => (
                <FilterCheckbox
                  key={cat}
                  checked={selectedCategories.includes(cat)}
                  onToggle={() => toggleCategory(cat)}
                  label={cat}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            title="Gender"
            open={openSections.gender}
            onToggle={() => toggleSection("gender")}
          >
            <div className="flex flex-col">
              {GENDERS.map((g) => (
                <FilterCheckbox
                  key={g}
                  checked={selectedGender === g}
                  onToggle={() => setSelectedGender(selectedGender === g ? null : g)}
                  label={g}
                />
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            title="Color"
            open={openSections.color}
            onToggle={() => toggleSection("color")}
          >
            <div className="flex flex-col">
              {colorGroups.map((cg) => {
                const active = selectedColorGroupIds.includes(cg.id);
                return (
                  <button
                    key={cg.id}
                    onClick={() => toggleColorGroup(cg.id)}
                    className="flex items-center gap-2.5 w-full py-[5px] group text-left"
                  >
                    <div
                      className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 transition-all duration-150 ${
                        active
                          ? "border-[var(--foreground)] bg-[var(--foreground)]"
                          : "border-[var(--border-strong)] group-hover:border-[var(--foreground)]"
                      }`}
                    >
                      {active && (
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
                      className="w-3.5 h-3.5 shrink-0 border border-[rgba(0,0,0,0.15)]"
                      style={
                        cg.hexCode === "#multicolor"
                          ? { background: "conic-gradient(red, orange, yellow, green, blue, violet, red)" }
                          : { backgroundColor: cg.hexCode }
                      }
                    />
                    <span
                      className={`text-xs uppercase tracking-[0.08em] transition-colors duration-200 ${
                        active
                          ? "text-[var(--foreground)] font-medium"
                          : "text-[var(--foreground-muted)] group-hover:text-[var(--foreground)]"
                      }`}
                    >
                      {cg.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </AccordionSection>
        </>
      )}

      <AccordionSection
        title="Price"
        open={openSections.price}
        onToggle={() => toggleSection("price")}
      >
        <div className="flex flex-col">
          {PRICE_RANGES.map((range, idx) => (
            <FilterCheckbox
              key={range.label}
              checked={selectedPriceIdx === idx}
              onToggle={() =>
                setSelectedPriceIdx(selectedPriceIdx === idx ? null : idx)
              }
              label={range.label}
            />
          ))}
        </div>
      </AccordionSection>

      <div className="border-t border-[var(--border)]" />
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto">
        {/* ── Page header ── */}
        <div className="px-6 md:px-12 pt-12 md:pt-16">
          <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-[var(--foreground-subtle)] mb-4">
            Browse
          </p>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
            <div>
              <h1 className="text-6xl md:text-8xl font-black uppercase text-[var(--foreground)] leading-none tracking-tight">
                The Edit
              </h1>
              <p className="mt-3 text-sm font-medium text-[var(--foreground-muted)] max-w-xs leading-relaxed">
                Curated pieces from the world's most forward-thinking brands.
              </p>
            </div>

            {/* Search */}
            <div className="relative md:w-[480px] mt-2">
              <input
                type="text"
                placeholder="Search outfits, brands, styles…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-4 py-2.5 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors duration-200 pr-8"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 2L10 10M10 2L2 10"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ) : (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] pointer-events-none">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                    <path
                      d="M11 11L14 14"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              )}
            </div>
          </div>

          {/* View tabs */}
          <div className="flex border-b border-[var(--border)]">
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
                    setSelectedPriceIdx(null);
                    // Persist tab in URL so browser back restores it
                    const url = new URL(window.location.href);
                    url.searchParams.set("view", v);
                    window.history.replaceState({}, "", url.toString());
                  }
                }}
                className={`px-6 py-3.5 text-xs tracking-[0.14em] uppercase font-bold transition-colors duration-200 border-b-2 -mb-px ${
                  view === v
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* ── Grid layout (always full-width) ── */}
        <div>
          {/* Main content */}
          <main className="min-w-0 px-6 md:px-8 lg:px-10">
            {/* Top toolbar */}
            <div className="flex items-center justify-between py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                {/* Filter toggle */}
                <button
                  onClick={() => { setStylistOpen(false); setFiltersOpen(v => !v); }}
                  className={`flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase font-bold border rounded-full px-4 py-2 transition-all duration-200 ${
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

                {/* Trending toggle */}
                <button
                  onClick={() => { setFiltersOpen(false); setStylistOpen(true); }}
                  className={`flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase font-bold border rounded-full px-4 py-2 transition-all duration-200 ${
                    stylistOpen
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                      : "border-[var(--foreground-muted)] text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)]"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 1.5L9.5 6H14L10.5 8.5L11.8 13L8 10.5L4.2 13L5.5 8.5L2 6H6.5L8 1.5Z" />
                  </svg>
                  <span>Trending</span>
                </button>
              </div>

              {/* Sort */}
              <div className="relative flex items-center gap-2" ref={sortRef}>
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
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[120px] bg-[var(--surface)] border border-[var(--border)] shadow-sm">
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
                        className={`w-full text-left px-4 py-2.5 text-[9px] tracking-[0.14em] uppercase transition-colors duration-150 ${
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

            {/* ── Inline horizontal filter strip ── */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                filtersOpen ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="overflow-x-auto border-b border-[var(--border)] py-3">
                <div className="flex items-center gap-2 min-w-max px-1">
                  {/* Gender */}
                  {GENDERS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setSelectedGender(selectedGender === g ? null : g)}
                      className={`shrink-0 px-3 py-1.5 text-[9px] tracking-[0.14em] uppercase font-bold border transition-all duration-150 rounded-full ${
                        selectedGender === g
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >{g}</button>
                  ))}

                  <div className="w-px h-5 bg-[var(--border-strong)] shrink-0 mx-1" />

                  {/* Categories (pieces only) */}
                  {view === "pieces" && CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleCategory(c)}
                      className={`shrink-0 px-3 py-1.5 text-[9px] tracking-[0.14em] uppercase font-bold border transition-all duration-150 rounded-full ${
                        selectedCategories.includes(c)
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >{c}</button>
                  ))}

                  {/* Occasions (outfits only) */}
                  {view === "outfits" && OCCASIONS.map((o) => (
                    <button
                      key={o}
                      onClick={() => toggleOccasion(o)}
                      className={`shrink-0 px-3 py-1.5 text-[9px] tracking-[0.14em] uppercase font-bold border transition-all duration-150 rounded-full ${
                        selectedOccasions.includes(o)
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >{o}</button>
                  ))}

                  <div className="w-px h-5 bg-[var(--border-strong)] shrink-0 mx-1" />

                  {/* Price ranges */}
                  {PRICE_RANGES.map((r, idx) => (
                    <button
                      key={r.label}
                      onClick={() => setSelectedPriceIdx(selectedPriceIdx === idx ? null : idx)}
                      className={`shrink-0 px-3 py-1.5 text-[9px] tracking-[0.14em] uppercase font-bold border transition-all duration-150 rounded-full ${
                        selectedPriceIdx === idx
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >{r.label}</button>
                  ))}

                  <div className="w-px h-5 bg-[var(--border-strong)] shrink-0 mx-1" />

                  {/* Colors */}
                  {colorGroups.map((cg) => (
                    <button
                      key={cg.id}
                      onClick={() => toggleColorGroup(cg.id)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[9px] tracking-[0.14em] uppercase font-bold border transition-all duration-150 rounded-full ${
                        selectedColorGroupIds.includes(cg.id)
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : "border-[var(--border-strong)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                        style={
                          cg.hexCode === "#multicolor"
                            ? { background: "conic-gradient(red,orange,yellow,green,blue,violet,red)" }
                            : { backgroundColor: cg.hexCode }
                        }
                      />
                      {cg.name}
                    </button>
                  ))}

                  {activeFiltersCount > 0 && (
                    <>
                      <div className="w-px h-5 bg-[var(--border-strong)] shrink-0 mx-1" />
                      <button
                        onClick={clearAll}
                        className="shrink-0 px-3 py-1.5 text-[9px] tracking-[0.14em] uppercase font-bold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
                      >Clear all</button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Active filter chips */}
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-4">
                {selectedBrands.map((brand) => (
                  <ActiveChip
                    key={brand}
                    label={brand}
                    onRemove={() => toggleBrand(brand)}
                  />
                ))}
                {selectedCategories.map((cat) => (
                  <ActiveChip
                    key={cat}
                    label={cat}
                    onRemove={() => toggleCategory(cat)}
                  />
                ))}
                {selectedOccasions.map((occ) => (
                  <ActiveChip
                    key={occ}
                    label={occ}
                    onRemove={() => toggleOccasion(occ)}
                  />
                ))}
                {selectedGender && (
                  <ActiveChip
                    label={selectedGender}
                    onRemove={() => setSelectedGender(null)}
                  />
                )}
                {selectedPriceIdx !== null && (
                  <ActiveChip
                    label={PRICE_RANGES[selectedPriceIdx].label}
                    onRemove={() => setSelectedPriceIdx(null)}
                  />
                )}
                {selectedColorGroupIds.map((id) => {
                  const cg = colorGroups.find((g) => g.id === id);
                  if (!cg) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => toggleColorGroup(id)}
                      className="flex items-center gap-1.5 text-[9px] tracking-[0.10em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-2.5 py-1 hover:bg-[var(--fg-overlay-05)] transition-colors duration-200"
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
                  );
                })}
                {aiOnly && (
                  <ActiveChip label="AI Only" onRemove={() => setAiOnly(false)} />
                )}
              </div>
            )}


            {/* Product / Outfit grid */}
            <div className="mt-6 pb-16">
              {view === "outfits" && loadingOutfits ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 border-t border-l border-[var(--border)]">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="border-r border-b border-[var(--border)] p-2">
                      <div className="animate-pulse">
                        <div className="bg-[var(--surface)] aspect-[3/4] w-full mb-3" />
                        <div className="bg-[var(--surface)] h-3 w-3/4 mb-2" />
                        <div className="bg-[var(--surface)] h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : view === "pieces" && loadingProducts ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 border-t border-l border-[var(--border)]">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="border-r border-b border-[var(--border)] p-2">
                      <div className="animate-pulse">
                        <div className="bg-[var(--surface)] aspect-[3/4] w-full mb-3" />
                        <div className="bg-[var(--surface)] h-3 w-3/4 mb-2" />
                        <div className="bg-[var(--surface)] h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : view === "outfits" ? (
                filteredOutfits.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 border-t border-l border-[var(--border)] stagger-children">
                    {pagedOutfits.map((outfit) => (
                      <div
                        key={outfit.id}
                        className="border-r border-b border-[var(--border)] p-2 animate-fade-up"
                      >
                        <OutfitCard outfit={outfit} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState onClear={clearAll} noun="outfits" />
                )
              ) : displayItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 border-t border-l border-[var(--border)] stagger-children">
                  {pagedItems.map(({ product, forcedVariant, key }) => (
                    <div
                      key={key}
                      className="border-r border-b border-[var(--border)] p-2 animate-fade-up"
                    >
                      <ProductCard product={product} initialVariant={forcedVariant} />
                    </div>
                  ))}
                </div>
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
                              ? "bg-[var(--foreground)] text-[var(--background)]"
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
            </div>
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
    <div className="py-24 text-center">
      <p className="font-display text-xl font-light text-[var(--foreground)] mb-2">
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
