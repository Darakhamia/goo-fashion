"use client";

import { useState, useMemo, useEffect } from "react";
import OutfitCard from "@/components/outfit/OutfitCard";
import ProductCard from "@/components/product/ProductCard";
import { outfits } from "@/lib/data/outfits";
import type { Category, ColorGroup, Gender, Occasion, Product } from "@/lib/types";

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
  { id: 1,  name: "Black",  hexCode: "#1a1a1a", sortOrder: 1 },
  { id: 2,  name: "White",  hexCode: "#f5f5f5", sortOrder: 2 },
  { id: 3,  name: "Grey",   hexCode: "#808080", sortOrder: 3 },
  { id: 4,  name: "Beige",  hexCode: "#c8ad8f", sortOrder: 4 },
  { id: 5,  name: "Brown",  hexCode: "#7a4f35", sortOrder: 5 },
  { id: 6,  name: "Navy",   hexCode: "#1a2d5a", sortOrder: 6 },
  { id: 7,  name: "Blue",   hexCode: "#2563ad", sortOrder: 7 },
  { id: 8,  name: "Green",  hexCode: "#2d6a3f", sortOrder: 8 },
  { id: 9,  name: "Red",    hexCode: "#c0392b", sortOrder: 9 },
  { id: 10, name: "Pink",   hexCode: "#d4607a", sortOrder: 10 },
  { id: 11, name: "Orange", hexCode: "#d4621a", sortOrder: 11 },
  { id: 12, name: "Yellow", hexCode: "#c9a227", sortOrder: 12 },
  { id: 13, name: "Purple", hexCode: "#6b3fa0", sortOrder: 13 },
  { id: 14, name: "Multi",  hexCode: "#e0e0e0", sortOrder: 14 },
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
  const [view, setView] = useState<View>("outfits");
  const [searchQuery, setSearchQuery] = useState("");

  // Restore tab from URL on mount (survives browser back navigation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    if (v === "pieces" || v === "outfits") setView(v);
  }, []);
  const [sort, setSort] = useState<SortOption>("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [colorGroups, setColorGroups] = useState<ColorGroup[]>(DEFAULT_COLOR_GROUPS);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCatalogProducts(d); })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
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
    brand: true,
    category: true,
    gender: true,
    color: true,
    occasion: true,
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
    let r = outfits
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
  }, [selectedOccasions, aiOnly, selectedPriceIdx, searchQuery, sort]);

  const count =
    view === "outfits" ? filteredOutfits.length : filteredProducts.length;

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
            <div className="flex flex-wrap gap-3 pt-1">
              {colorGroups.map((cg) => {
                const active = selectedColorGroupIds.includes(cg.id);
                return (
                  <button
                    key={cg.id}
                    onClick={() => toggleColorGroup(cg.id)}
                    className="flex flex-col items-center gap-1.5 group"
                    title={cg.name}
                  >
                    <span
                      className={`w-6 h-6 rounded-full transition-all duration-150 ${
                        active
                          ? "ring-2 ring-offset-2 ring-[var(--foreground)] scale-110"
                          : "ring-1 ring-[var(--border)] group-hover:ring-[var(--foreground-muted)]"
                      }`}
                      style={{ backgroundColor: cg.hexCode }}
                    />
                    <span
                      className={`text-[9px] tracking-[0.06em] capitalize transition-colors duration-150 ${
                        active
                          ? "text-[var(--foreground)] font-medium"
                          : "text-[var(--foreground-subtle)] group-hover:text-[var(--foreground-muted)]"
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
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto">
        {/* ── Page header ── */}
        <div className="px-6 md:px-12 pt-12 md:pt-16">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            Browse
          </p>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)]">
              The Edit
            </h1>

            {/* Search */}
            <div className="relative md:w-72">
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
            {(["outfits", "pieces"] as View[]).map((v) => (
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
                className={`px-6 py-3.5 text-xs tracking-[0.12em] uppercase font-medium transition-colors duration-200 border-b-2 -mb-px ${
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
              <div className="flex items-center gap-4">
                {/* Filter toggle — unified for all screen sizes */}
                <button
                  onClick={() => setFiltersOpen(true)}
                  className="flex items-center gap-2 text-[9px] tracking-[0.14em] uppercase font-medium border border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-all duration-200 px-3 py-1.5"
                >
                  <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                    <path d="M1 1.5H12M3 5H10M5 8.5H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <span>Filters</span>
                  {activeFiltersCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[8px] font-bold flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                <span className="text-[10px] text-[var(--foreground-subtle)] tracking-[0.06em]">
                  {count} {view === "outfits" ? "outfits" : "pieces"}
                  {searchQuery && (
                    <span className="ml-1">
                      for &ldquo;{searchQuery}&rdquo;
                    </span>
                  )}
                </span>
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="hidden sm:block text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
                  Sort:
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="text-[10px] tracking-[0.08em] uppercase bg-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)] focus:outline-none cursor-pointer transition-colors duration-200"
                >
                  <option value="featured">Featured</option>
                  <option value="price-asc">Price ↑</option>
                  <option value="price-desc">Price ↓</option>
                  <option value="newest">Newest</option>
                </select>
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
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cg.hexCode }}
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
              {view === "pieces" && loadingProducts ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-px bg-[var(--border)]">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-[var(--background)] p-4">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-px bg-[var(--border)] stagger-children">
                    {filteredOutfits.map((outfit) => (
                      <div
                        key={outfit.id}
                        className="bg-[var(--background)] p-4 animate-fade-up"
                      >
                        <OutfitCard outfit={outfit} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState onClear={clearAll} noun="outfits" />
                )
              ) : filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-px bg-[var(--border)] stagger-children">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="bg-[var(--background)] p-4 animate-fade-up"
                    >
                      <ProductCard product={product} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState onClear={clearAll} noun="pieces" />
              )}
            </div>
          </main>
        </div>
      </div>

      {/* ── Filter overlay panel (all screen sizes) ── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${
          filtersOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setFiltersOpen(false)}
      />
      {/* Slide-in panel from the left */}
      <div
        className={`fixed top-16 left-0 bottom-0 z-50 w-72 flex flex-col bg-[var(--background)] border-r border-[var(--border)] shadow-2xl transition-transform duration-300 ease-in-out ${
          filtersOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <span className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground)]">
            Filters
          </span>
          <button
            onClick={() => setFiltersOpen(false)}
            className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1 -mr-1"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
          {renderFilters()}
        </div>
        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-[var(--border)] shrink-0">
          <button
            onClick={() => setFiltersOpen(false)}
            className="w-full text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] py-3.5 hover:opacity-80 transition-opacity duration-200"
          >
            View {count} result{count !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
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
