"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { ColorGroup, Product, Category, StyleKeyword, Retailer, Gender, CropData } from "@/lib/types";
import { subcategoryToValue, groupForProduct, resolveSubcategory, type CategoryGroup } from "@/lib/categories";
import { useCategoryTree } from "@/lib/hooks/useCategoryTree";
import { ImageCropEditor } from "@/components/admin/ImageCropEditor";

const fmtPrice = (n: number) => `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)}`;

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

// Sort options shown in the admin toolbar dropdown. Each maps to a (key, direction) pair
// that drives the same sortKey/sortDir state used by the clickable column headers.
type SortColumn = "name" | "brand" | "category" | "priceMin" | "createdAt";
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "brand:asc", label: "Brand A–Z" },
  { value: "priceMin:asc", label: "Price: low → high" },
  { value: "priceMin:desc", label: "Price: high → low" },
];

// ── Constants ──────────────────────────────────────────────────────────────────

const SUGGESTED_BRANDS = [
  "Acne Studios", "Arket", "& Other Stories", "A.P.C.", "Balenciaga",
  "Bottega Veneta", "Burberry", "Cos", "Fear of God", "Gucci",
  "Jacquemus", "Jil Sander", "Lemaire", "Louis Vuitton", "Maison Margiela",
  "Massimo Dutti", "Miu Miu", "Nike", "Prada", "Sandro", "The Row",
  "Toteme", "Valentino", "Zara",
];

/**
 * Size presets per stored category value.
 *
 * The category tree itself lives in lib/categories.ts and is shared with the
 * catalog filters and the breadcrumbs — this table only carries what the admin
 * needs on top of it. `swimwear` is not in that tree (nothing on the site
 * filters by it) but keeps its sizes so an existing piece still edits cleanly.
 */
const SIZE_PRESETS: Record<string, { sizeType: "letter" | "number" | "eu" | "one-size"; sizes: string[] }> = {
  tops:        { sizeType: "letter",   sizes: ["XXS","XS","S","M","L","XL","XXL","XXXL"] },
  shirts:      { sizeType: "letter",   sizes: ["XXS","XS","S","M","L","XL","XXL"] },
  knitwear:    { sizeType: "letter",   sizes: ["XS","S","M","L","XL","XXL"] },
  bottoms:     { sizeType: "letter",   sizes: ["XS","S","M","L","XL","XXL"] },
  jeans:       { sizeType: "number",   sizes: ["24","25","26","27","28","29","30","31","32","33","34","36","38"] },
  shorts:      { sizeType: "letter",   sizes: ["XS","S","M","L","XL","XXL"] },
  skirts:      { sizeType: "letter",   sizes: ["XS","S","M","L","XL"] },
  outerwear:   { sizeType: "letter",   sizes: ["XS","S","M","L","XL","XXL"] },
  blazers:     { sizeType: "letter",   sizes: ["XS","S","M","L","XL","XXL"] },
  dresses:     { sizeType: "letter",   sizes: ["XS","S","M","L","XL","XXL"] },
  jumpsuits:   { sizeType: "letter",   sizes: ["XS","S","M","L","XL","XXL"] },
  footwear:    { sizeType: "eu",       sizes: ["35","36","37","38","39","40","41","42","43","44","45","46"] },
  accessories: { sizeType: "one-size", sizes: ["One Size","XS/S","S/M","M/L","L/XL"] },
  bags:        { sizeType: "one-size", sizes: ["One Size"] },
  swimwear:    { sizeType: "letter",   sizes: ["XS","S","M","L","XL"] },
};

/** "Footwear › Boots" for a stored pair, for the table and section headers. */
function categoryPath(category: string, subcategory: string | undefined, tree: CategoryGroup[]): string {
  const group = groupForProduct(category, subcategory, tree);
  const sub = resolveSubcategory(category, subcategory, tree);
  if (!group) return category;
  return sub ? `${group.label} › ${sub}` : group.label;
}

/**
 * The "show me what still needs filling in" filter.
 *
 * Sorting a catalogue out means finding the gaps, and a gap is invisible in a
 * list that only lets you filter by what a product *has*. Each entry answers
 * "which pieces are still missing this?".
 */
const MISSING_FILTERS: { value: string; label: string; test: (p: Product) => boolean }[] = [
  { value: "subcategory", label: "No subcategory", test: (p) => !p.subcategory },
  { value: "colorGroups", label: "No colour filter", test: (p) => !p.colorGroupIds?.length },
  { value: "colors", label: "No colours", test: (p) => !p.colors?.length },
  { value: "style", label: "No style keywords", test: (p) => !p.styleKeywords?.length },
  { value: "gender", label: "No gender", test: (p) => !p.gender },
  { value: "description", label: "No description", test: (p) => !p.description?.trim() },
  { value: "sizes", label: "No sizes", test: (p) => !p.sizes?.length },
  { value: "image", label: "No image", test: (p) => !p.imageUrl?.trim() },
];

const filterSelectCls =
  "rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 outline-none focus:border-[var(--foreground)] transition-colors cursor-pointer max-w-[180px]";

const STYLE_KEYWORDS: StyleKeyword[] = [
  "minimal", "streetwear", "classic", "avant-garde", "romantic",
  "utilitarian", "bohemian", "preppy", "sporty", "dark", "maximalist", "coastal", "academic",
];

const AVAILABILITY_OPTIONS = ["in stock", "low stock", "sold out"] as const;

/**
 * Photo-backdrop sampling sizes. The sample is small enough to answer "how many
 * photos have a backdrop" in a few seconds; the batch is the most the API takes
 * in one call.
 */
const BACKDROP_SAMPLE = 40;
const BACKDROP_BATCH = 1000;

/**
 * How many batches one click will work through before handing back control.
 *
 * The point is not to need thirty clicks for a catalogue. It is bounded anyway,
 * because an unbounded loop against a job that has quietly stopped making
 * progress would spin forever — see the stall check in the loop itself.
 */
const BACKDROP_MAX_ROUNDS = 40;

// Static fallback color groups — shown even before Supabase is configured.
// IDs match the seed data in supabase-schema.sql (sort_order order).
const DEFAULT_COLOR_GROUPS: ColorGroup[] = [
  { id: 1,  name: "White",      hexCode: "#ffffff",      sortOrder: 1 },
  { id: 2,  name: "Multicolor", hexCode: "#multicolor",  sortOrder: 2 },
  { id: 3,  name: "Brown",      hexCode: "#7a4f35",      sortOrder: 3 },
  { id: 4,  name: "Pink",       hexCode: "#e8698a",      sortOrder: 4 },
  { id: 5,  name: "Yellow",     hexCode: "#f5c518",      sortOrder: 5 },
  { id: 6,  name: "Orange",     hexCode: "#e87722",      sortOrder: 6 },
  { id: 7,  name: "Grey",       hexCode: "#808080",      sortOrder: 7 },
  { id: 8,  name: "Black",      hexCode: "#111111",      sortOrder: 8 },
  { id: 9,  name: "Green",      hexCode: "#2d6a3f",      sortOrder: 9 },
  { id: 10, name: "Red",        hexCode: "#c0392b",      sortOrder: 10 },
  { id: 11, name: "Violet",     hexCode: "#7b3fa0",      sortOrder: 11 },
  { id: 12, name: "Blue",       hexCode: "#1a47a0",      sortOrder: 12 },
  { id: 13, name: "Beige",      hexCode: "#d4c5a9",      sortOrder: 13 },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface RetailerForm {
  name: string;
  url: string;
  price: string;
  availability: "in stock" | "low stock" | "sold out";
  isOfficial: boolean;
  rating: string;       // "4.5" or ""
  reviewCount: string;  // "1234" or ""
}

interface ProductFormState {
  name: string;
  brand: string;
  category: Category;
  /** Filter subcategory, e.g. "Sneakers" under footwear. "" = not set. */
  subcategory: string;
  gender: Gender | "";
  description: string;
  priceMin: string;
  priceMax: string;
  images: string[];
  colorsRaw: string;
  sizes: string;
  material: string;
  styleKeywords: StyleKeyword[];
  retailers: RetailerForm[];
  isNew: boolean;
  /** HEX swatch color for this product (used when it's part of a variant group) */
  variantColorHex: string;
  /** IDs of other products linked to this one as color variants */
  linkedProductIds: string[];
  /** Base color group IDs for filter (from color_groups table) */
  colorGroupIds: number[];
}

const defaultForm: ProductFormState = {
  name: "",
  brand: "",
  category: "outerwear",
  subcategory: "Jackets",
  gender: "",
  description: "",
  priceMin: "",
  priceMax: "",
  images: [""],
  colorsRaw: "",
  sizes: "",
  material: "",
  styleKeywords: ["minimal"],
  retailers: [],
  isNew: false,
  variantColorHex: "#888888",
  linkedProductIds: [],
  colorGroupIds: [],
};

// ── Group-variants types ────────────────────────────────────────────────────

interface GroupEntry {
  id: string;
  colorHex: string;
  isPrimary: boolean;
}

interface GroupModalState {
  open: boolean;
  entries: GroupEntry[];      // products currently being configured
  existingGroupId?: string;   // set when editing an existing group
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const inputCls =
  "rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-transparent text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-subtle)]";
const selectCls =
  "rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 w-full text-sm bg-[var(--background)] text-[var(--foreground)] transition-colors";
const labelCls =
  "block text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5";
const sectionCls = "border-t border-[var(--border)] pt-4 mt-1";

// ── CSV Parser ─────────────────────────────────────────────────────────────────

type ImportTab = "csv" | "json";

function parseCSV(text: string): Partial<Product>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { values.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    values.push(cur.trim());
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = values[i] ?? ""; });
    return {
      name: o.name,
      brand: o.brand as Product["brand"] || "Zara" as Product["brand"],
      category: (o.category as Category) || "tops",
      description: o.description || "",
      imageUrl: o.imageurl || o.image_url || o.image || "",
      images: o.imageurl ? [o.imageurl] : [],
      colors: o.colors ? o.colors.split("|").map((s) => s.trim()) : [],
      sizes: o.sizes ? o.sizes.split("|").map((s) => s.trim()) : [],
      material: o.material || "",
      priceMin: parseFloat(o.pricemin || o.price_min || o.price || "0") || 0,
      priceMax: parseFloat(o.pricemax || o.price_max || o.price || "0") || 0,
      styleKeywords: ((o.stylekeywords || o.style_keywords)
        ? (o.stylekeywords || o.style_keywords).split("|").map((s) => s.trim() as StyleKeyword)
        : ["minimal" as StyleKeyword]) as StyleKeyword[],
      isNew: o.isnew === "true" || o.is_new === "true",
      isSaved: false,
      currency: "USD",
      retailers: [],
    };
  }).filter((p) => !!p.name);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveColors(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ImageList({
  images,
  onChange,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
}) {
  const [uploading, setUploading] = useState<number | null>(null);

  const addRow = () => onChange([...images, ""]);
  const removeRow = (i: number) => onChange(images.filter((_, idx) => idx !== i));
  const setVal = (i: number, v: string) =>
    onChange(images.map((img, idx) => (idx === i ? v : img)));

  const handleBlur = async (i: number, url: string) => {
    if (!url || !url.startsWith("http")) return;
    // skip if already stored in Supabase
    if (url.includes("supabase.co/storage")) return;
    setUploading(i);
    try {
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.url) setVal(i, data.url);
    } catch {}
    setUploading(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {images.map((url, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 flex flex-col gap-1">
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={(e) => setVal(i, e.target.value)}
                onBlur={(e) => handleBlur(i, e.target.value)}
                placeholder="https://…"
                className={`${inputCls} ${uploading === i ? "opacity-50" : ""}`}
                disabled={uploading === i}
              />
              {uploading === i && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2">
                  <span className="w-3.5 h-3.5 border border-[var(--foreground)] border-t-transparent rounded-full animate-spin inline-block" />
                </span>
              )}
            </div>
            {url && uploading !== i && (
              <div className="relative w-12 h-16 border border-[var(--border)] rounded-md overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                />
              </div>
            )}
          </div>
          {i === 0 && (
            <span className="text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] mt-2.5 shrink-0">Main</span>
          )}
          {images.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="mt-2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="self-start text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5 mt-1"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        Add image
      </button>
    </div>
  );
}


function RetailerList({
  retailers,
  onChange,
  storeLibrary = [],
}: {
  retailers: RetailerForm[];
  onChange: (r: RetailerForm[]) => void;
  /** Stores (name + logo) from the admin library, used to pick a real store. */
  storeLibrary?: { name: string; logoUrl: string | null }[];
}) {
  const add = () =>
    onChange([...retailers, { name: "", url: "", price: "", availability: "in stock", isOfficial: false, rating: "", reviewCount: "" }]);
  const remove = (i: number) => onChange(retailers.filter((_, idx) => idx !== i));
  const set = (i: number, patch: Partial<RetailerForm>) =>
    onChange(retailers.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Resolve a typed store name to its library logo (case-insensitive), so the
  // admin sees which logo will appear on the storefront.
  const logoFor = (name: string): string | null =>
    storeLibrary.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())?.logoUrl ?? null;

  return (
    <div className="flex flex-col gap-3">
      {storeLibrary.length > 0 && (
        <datalist id="retailer-store-library">
          {storeLibrary.map((s) => (
            <option key={s.name} value={s.name} />
          ))}
        </datalist>
      )}
      {retailers.map((r, i) => (
        <div key={i} className="border border-[var(--border)] rounded-xl p-3 flex flex-col gap-2 relative">
          <button
            type="button"
            onClick={() => remove(i)}
            className="absolute top-2 right-2 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="grid grid-cols-2 gap-2 pr-5">
            <div>
              <label className={labelCls}>Store</label>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex items-center justify-center">
                  {logoFor(r.name) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoFor(r.name)!} alt={r.name} className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-[9px] font-semibold text-[var(--foreground-subtle)]">
                      {r.name.trim() ? r.name.slice(0, 2).toUpperCase() : "—"}
                    </span>
                  )}
                </span>
                <input
                  type="text"
                  list="retailer-store-library"
                  value={r.name}
                  onChange={(e) => set(i, { name: e.target.value })}
                  placeholder="Pick or type a store…"
                  className={`${inputCls} flex-1`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Price ($)</label>
              <input
                type="number"
                value={r.price}
                onChange={(e) => set(i, { price: e.target.value })}
                placeholder="99"
                min="0"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Store URL</label>
            <input
              type="url"
              value={r.url}
              onChange={(e) => set(i, { url: e.target.value })}
              placeholder="https://zara.com/product/…"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Availability</label>
              <select
                value={r.availability}
                onChange={(e) => set(i, { availability: e.target.value as RetailerForm["availability"] })}
                className={selectCls}
              >
                {AVAILABILITY_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Rating <span className="normal-case tracking-normal">1–5</span></label>
                <input type="number" value={r.rating} onChange={(e) => set(i, { rating: e.target.value })} placeholder="4.5" min="1" max="5" step="0.1" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Reviews</label>
                <input type="number" value={r.reviewCount} onChange={(e) => set(i, { reviewCount: e.target.value })} placeholder="1234" min="0" className={inputCls} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`official-${i}`}
              checked={r.isOfficial}
              onChange={(e) => set(i, { isOfficial: e.target.checked })}
              className="w-3.5 h-3.5 accent-[var(--foreground)]"
            />
            <label htmlFor={`official-${i}`} className="text-xs text-[var(--foreground-muted)] cursor-pointer">
              Official store
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1.5"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        Add retailer
      </button>
    </div>
  );
}

// ── Migration modal ────────────────────────────────────────────────────────────

const MIGRATION_SQL = `alter table public.products
  add column if not exists variant_group_id text    default null,
  add column if not exists color_hex        text    default null,
  add column if not exists is_group_primary boolean default false,
  add column if not exists crop_data        jsonb   default null;

create index if not exists products_variant_group_idx
  on public.products (variant_group_id)
  where variant_group_id is not null;`;

function MigrationModal({ onClose, onMigrated }: { onClose: () => void; onMigrated: () => void }) {
  const [verifying, setVerifying] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [verifyResult, setVerifyResult] = useState<"ok" | "fail" | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    const res = await fetch("/api/products/group");
    const data = await res.json();
    setVerifying(false);
    if (data.migrated) {
      setVerifyResult("ok");
      setTimeout(onMigrated, 1200);
    } else {
      setVerifyResult("fail");
    }
  };

  const handleAutoMigrate = async () => {
    setMigrating(true);
    const res = await fetch("/api/products/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "migrate" }),
    });
    const data = await res.json();
    setMigrating(false);
    if (data.migrated) {
      setVerifyResult("ok");
      setTimeout(onMigrated, 1200);
    } else {
      setVerifyResult("fail");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div
        className="border border-amber-400 rounded-2xl p-6 md:p-8 max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--background)" }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 mt-0.5 text-amber-500">
            <path d="M10 2L1 17h18L10 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M10 8v4M10 14.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <div>
            <h2 className="font-display text-lg font-light text-[var(--foreground)]">
              Database migration required
            </h2>
            <p className="text-xs text-[var(--foreground-muted)] mt-1">
              Three new columns must be added to the <code className="font-mono">products</code> table before variant grouping can work.
            </p>
          </div>
        </div>

        {/* Option 1: Auto */}
        <div className="border border-[var(--border)] rounded-xl p-4 mb-4">
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] mb-2">Option 1 — Try automatically</p>
          <p className="text-xs text-[var(--foreground-muted)] mb-3">
            Works if your Supabase project has the <code className="font-mono text-[11px]">run_sql</code> RPC function enabled.
          </p>
          <button
            onClick={handleAutoMigrate}
            disabled={migrating || verifyResult === "ok"}
            className="inline-flex items-center gap-2 bg-[var(--foreground)] text-[var(--background)] px-4 py-2 text-xs tracking-[0.12em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {migrating ? "Running migration…" : "Run migration automatically"}
          </button>
        </div>

        {/* Option 2: Manual */}
        <div className="border border-[var(--border)] rounded-xl p-4 mb-4">
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] mb-2">Option 2 — Run SQL manually</p>
          <p className="text-xs text-[var(--foreground-muted)] mb-2">
            Go to <strong>supabase.com → your project → SQL Editor</strong>, paste and run:
          </p>
          <pre
            className="bg-[var(--surface)] border border-[var(--border)] p-3 text-[11px] font-mono text-[var(--foreground)] overflow-x-auto whitespace-pre leading-relaxed select-all cursor-text"
          >
            {MIGRATION_SQL}
          </pre>
          <p className="text-[10px] text-[var(--foreground-subtle)] mt-2">
            After running the SQL, click <strong>Verify</strong> below to confirm it worked.
          </p>
        </div>

        {/* Verify result */}
        {verifyResult === "ok" && (
          <div className="border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300 mb-4">
            Migration verified! Closing…
          </div>
        )}
        {verifyResult === "fail" && (
          <div className="border border-red-400 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-xs text-red-700 dark:text-red-400 mb-4">
            Columns still not found. Run the SQL in Supabase SQL Editor, then wait a few seconds and verify again.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleVerify}
            disabled={verifying || verifyResult === "ok"}
            className="flex-1 border border-[var(--foreground)] text-[var(--foreground)] py-3 text-xs tracking-[0.14em] uppercase transition-opacity hover:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
          >
            {verifying ? "Checking…" : "Verify migration"}
          </button>
          <button
            onClick={onClose}
            className="border border-[var(--border)] rounded-lg px-5 py-3 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  // The tree the Categories page edits — the chips below are whatever it says.
  const categoryGroups = useCategoryTree();
  const subcatToValue = useMemo(() => subcategoryToValue(categoryGroups), [categoryGroups]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const [colorGroups, setColorGroups] = useState<ColorGroup[]>(DEFAULT_COLOR_GROUPS);
  // Brands fetched from /api/brands — starts with the static list as a fallback so the
  // datalist is never empty while the request is in flight.
  const [suggestedBrands, setSuggestedBrands] = useState<string[]>(SUGGESTED_BRANDS);
  // Store library (name + logo) from /api/brands, used by the retailer editor so
  // each "Where to buy" listing is a real store with its logo, not free text.
  const [storeLibrary, setStoreLibrary] = useState<{ name: string; logoUrl: string | null }[]>([]);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [addingBrand, setAddingBrand] = useState(false);
  const brandInputRef = useRef<HTMLInputElement>(null);
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [form, setForm] = useState<ProductFormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    new Set(["details", "colors", "color-groups", "style", "variants", "retailers"])
  );
  const toggleSection = (key: string) =>
    setCollapsed((c) => { const n = new Set(c); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab>("csv");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<Partial<Product>[]>([]);
  const [importing, setImporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [recategorizing, setRecategorizing] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [importError, setImportError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [filterGroup, setFilterGroup] = useState<string>("");
  const [filterSubcategory, setFilterSubcategory] = useState<string>("");
  const [filterBrand, setFilterBrand] = useState<string>("");
  const [filterColorGroup, setFilterColorGroup] = useState<string>("");
  const [filterStyle, setFilterStyle] = useState<string>("");
  const [filterGender, setFilterGender] = useState<string>("");
  /** Which field to show only the products *missing* — see MISSING_FILTERS. */
  const [filterMissing, setFilterMissing] = useState<string>("");
  const [filterNew, setFilterNew] = useState<boolean | null>(null);
  // Default to newest-first so the table mirrors the DB order (created_at desc).
  const [sortKey, setSortKey] = useState<SortColumn>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Crop editor ────────────────────────────────────────────────────────────
  const [cropProduct, setCropProduct] = useState<Product | null>(null);
  const [cropSaving, setCropSaving] = useState(false);

  const handleCropSave = async (cropData: CropData) => {
    if (!cropProduct) return;
    setCropSaving(true);
    if (dbConfigured) {
      const res = await fetch(`/api/products/${cropProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropData }),
      });
      if (!res.ok) {
        showToast("Не удалось сохранить кадрирование", "err");
        setCropSaving(false);
        return;
      }
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === cropProduct.id ? { ...p, cropData } : p))
    );
    showToast("Кадрирование сохранено.");
    setCropSaving(false);
    setCropProduct(null);
  };

  const handleCropClear = async (product: Product) => {
    if (!dbConfigured) return;
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cropData: null }),
    });
    if (!res.ok) { showToast("Ошибка сброса", "err"); return; }
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, cropData: undefined } : p))
    );
    showToast("Кадрирование сброшено.");
  };

  // ── Group variants modal ───────────────────────────────────────────────────
  const [groupModal, setGroupModal] = useState<GroupModalState>({ open: false, entries: [] });
  const [grouping, setGrouping] = useState(false);
  const [variantSearch, setVariantSearch] = useState("");
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Check if Supabase is configured (GET = read-only, no auto-seeding)
      const configRes = await fetch("/api/products/seed");
      setDbConfigured(configRes.status !== 501);

      // raw=true returns all products including non-primary variants
      const res = await fetch("/api/products?raw=true");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetch("/api/color-groups")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setColorGroups(d); })
      .catch(() => {});
    fetch("/api/brands")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          setSuggestedBrands(d.map((b: { name: string }) => b.name).sort());
          setStoreLibrary(
            d.map((b: { name: string; logoUrl?: string | null }) => ({
              name: b.name,
              logoUrl: b.logoUrl ?? null,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Close brand dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        brandDropdownRef.current &&
        !brandDropdownRef.current.contains(e.target as Node) &&
        !brandInputRef.current?.contains(e.target as Node)
      ) {
        setBrandDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function addBrandInline(name: string) {
    setAddingBrand(true);
    try {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        setSuggestedBrands((prev) =>
          [...prev, name.trim()].sort((a, b) => a.localeCompare(b))
        );
      }
    } finally {
      setAddingBrand(false);
    }
    setForm((f) => ({ ...f, brand: name.trim() }));
    setBrandDropdownOpen(false);
  }

  const filtered = useMemo(() => {
    let list = products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filterGroup) {
      const values = categoryGroups.find((g) => g.id === filterGroup)?.items.map((i) => i.value) ?? [];
      list = list.filter((p) => values.includes(p.category));
    }
    if (filterSubcategory) {
      // Same forgiving rule as the catalog: a piece that records no
      // subcategory still answers to its whole category.
      list = list.filter((p) => {
        if (p.category !== subcatToValue[filterSubcategory]) return false;
        const sub = resolveSubcategory(p.category, p.subcategory, categoryGroups);
        return !sub || sub === filterSubcategory;
      });
    }
    if (filterBrand) list = list.filter((p) => p.brand === filterBrand);
    if (filterColorGroup) {
      const id = Number(filterColorGroup);
      list = list.filter((p) => p.colorGroupIds?.includes(id));
    }
    if (filterStyle) list = list.filter((p) => p.styleKeywords?.includes(filterStyle as StyleKeyword));
    if (filterGender) list = list.filter((p) => p.gender === filterGender);
    if (filterMissing) {
      const missing = MISSING_FILTERS.find((m) => m.value === filterMissing);
      if (missing) list = list.filter(missing.test);
    }
    if (filterNew !== null) list = list.filter((p) => p.isNew === filterNew);
    if (sortKey) {
      list = [...list].sort((a, b) => {
        let cmp: number;
        if (sortKey === "priceMin") {
          cmp = (a.priceMin ?? 0) - (b.priceMin ?? 0);
        } else if (sortKey === "createdAt") {
          // ISO date strings compare lexicographically; missing dates sort oldest.
          cmp = String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
        } else {
          cmp = String(a[sortKey] ?? "").toLowerCase().localeCompare(String(b[sortKey] ?? "").toLowerCase());
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [products, searchQuery, filterGroup, filterSubcategory, filterBrand, filterColorGroup, filterStyle, filterGender, filterMissing, filterNew, sortKey, sortDir]);

  // The Audit page links a suspect straight here by name, so the list opens
  // already narrowed to the piece being fixed.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const search = new URLSearchParams(window.location.search).get("search");
    if (search) setSearchQuery(search);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Brands actually present in the catalogue, so the list can't offer a dead end. */
  const brandsInCatalogue = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  // ── Modal ──────────────────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingProduct(null);
    setIsDuplicating(false);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setIsDuplicating(false);
    setEditingProduct(product);
    // Find other members of the same variant group
    const linkedIds = product.variantGroupId
      ? products
          .filter((p) => p.variantGroupId === product.variantGroupId && p.id !== product.id)
          .map((p) => p.id)
      : [];
    setForm({
      name: product.name,
      brand: product.brand,
      category: product.category,
      subcategory: resolveSubcategory(product.category, product.subcategory, categoryGroups) ?? "",
      gender: (product.gender ?? "") as Gender | "",
      description: product.description ?? "",
      priceMin: String(product.priceMin),
      priceMax: String(product.priceMax),
      images: product.images?.length ? product.images : [product.imageUrl ?? ""],
      colorsRaw: product.colors?.join(", ") ?? "",
      sizes: product.sizes?.join(", ") ?? "",
      material: product.material ?? "",
      styleKeywords: (product.styleKeywords as StyleKeyword[]) ?? ["minimal"],
      retailers: (product.retailers ?? []).map((r) => ({
        name: r.name,
        url: r.url,
        price: String(r.price),
        availability: r.availability,
        isOfficial: r.isOfficial,
        rating: r.rating != null ? String(r.rating) : "",
        reviewCount: r.reviewCount != null ? String(r.reviewCount) : "",
      })),
      isNew: product.isNew,
      variantColorHex: product.colorHex ?? "#888888",
      linkedProductIds: linkedIds,
      colorGroupIds: product.colorGroupIds ?? [],
    });
    setVariantSearch("");
    setShowModal(true);
  };

  const openDuplicateModal = (product: Product) => {
    setEditingProduct(null);
    setIsDuplicating(true);
    setForm({
      name: `${product.name} (Copy)`,
      brand: product.brand,
      category: product.category,
      subcategory: resolveSubcategory(product.category, product.subcategory, categoryGroups) ?? "",
      gender: (product.gender ?? "") as Gender | "",
      description: product.description ?? "",
      priceMin: String(product.priceMin),
      priceMax: String(product.priceMax),
      images: product.images?.length ? product.images : [product.imageUrl ?? ""],
      colorsRaw: product.colors?.join(", ") ?? "",
      sizes: product.sizes?.join(", ") ?? "",
      material: product.material ?? "",
      styleKeywords: (product.styleKeywords as StyleKeyword[]) ?? ["minimal"],
      retailers: (product.retailers ?? []).map((r) => ({
        name: r.name,
        url: r.url,
        price: String(r.price),
        availability: r.availability,
        isOfficial: r.isOfficial,
        rating: r.rating != null ? String(r.rating) : "",
        reviewCount: r.reviewCount != null ? String(r.reviewCount) : "",
      })),
      isNew: product.isNew,
      variantColorHex: product.colorHex ?? "#888888",
      linkedProductIds: [],
      colorGroupIds: product.colorGroupIds ?? [],
    });
    setVariantSearch("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setIsDuplicating(false);
    setForm(defaultForm);
    setVariantSearch("");
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const validImages = form.images.filter((u) => u.trim());
    const colors = deriveColors(form.colorsRaw);

    // NOTE: colorHex, variantGroupId, isGroupPrimary are NOT sent here.
    // They are set exclusively via /api/products/group after the product is saved.
    // This avoids errors when the migration columns haven't been added yet.
    const payload: Partial<Product> = {
      name: form.name.trim(),
      brand: form.brand as Product["brand"],
      category: form.category,
      // Always sent, so clearing it in the form clears it on the row too.
      subcategory: form.subcategory,
      gender: form.gender ? (form.gender as Gender) : undefined,
      description: form.description.trim(),
      priceMin: parseFloat(form.priceMin) || 0,
      priceMax: parseFloat(form.priceMax) || parseFloat(form.priceMin) || 0,
      imageUrl: validImages[0] || "https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=800&q=90",
      images: validImages.length ? validImages : ["https://images.unsplash.com/photo-1551232864-3f0890e580d9?w=800&q=90"],
      colors,
      sizes: form.sizes.split(",").map((s) => s.trim()).filter(Boolean),
      material: form.material.trim(),
      styleKeywords: form.styleKeywords,
      retailers: form.retailers.map((r) => ({
        name: r.name,
        url: r.url,
        price: parseFloat(r.price) || 0,
        currency: "USD",
        availability: r.availability,
        isOfficial: r.isOfficial,
        rating: r.rating ? parseFloat(r.rating) : undefined,
        reviewCount: r.reviewCount ? parseInt(r.reviewCount, 10) : undefined,
      })) as Retailer[],
      isNew: form.isNew,
      isSaved: false,
      currency: "USD",
      colorGroupIds: form.colorGroupIds,
    };

    let savedId: string | null = null;

    if (dbConfigured) {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
      const method = editingProduct ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || "Failed to save", "err");
        setSaving(false);
        return;
      }
      const saved = await res.json();
      savedId = saved.id;
      if (editingProduct) {
        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? saved : p)));
      } else {
        setProducts((prev) => [saved, ...prev]);
      }
      // The API drops columns the database does not have rather than failing
      // the save outright — say so, so a missing migration is never silent.
      if (saved.warning) showToast(saved.warning, "err");
      else showToast(editingProduct ? "Product updated." : "Product added.");

      // ── Link color variants if requested ─────────────────────────────────
      if (savedId && form.linkedProductIds.length > 0) {
        const allIds = [savedId, ...form.linkedProductIds];
        const colorHexMap: Record<string, string> = { [savedId]: form.variantColorHex };
        form.linkedProductIds.forEach((id) => {
          const p = products.find((x) => x.id === id);
          colorHexMap[id] = p?.colorHex ?? "#888888";
        });
        // Reuse an existing group if all linked products share one
        const existingGroups = new Set(
          form.linkedProductIds
            .map((id) => products.find((x) => x.id === id)?.variantGroupId)
            .filter(Boolean)
        );
        const groupRes = await fetch("/api/products/group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: allIds,
            primaryId: savedId,
            colorHexMap,
            groupId: existingGroups.size === 1 ? [...existingGroups][0] : undefined,
          }),
        });
        if (!groupRes.ok) {
          const err = await groupRes.json();
          if (err.needsMigration) {
            setShowMigrationModal(true);
          } else {
            showToast(err.error || "Saved but variant linking failed", "err");
          }
        } else {
          showToast("Product saved and variants linked.");
        }
        await fetchProducts();
      }
    } else {
      if (editingProduct) {
        setProducts((prev) =>
          prev.map((p) => p.id === editingProduct.id ? { ...p, ...payload } : p)
        );
      } else {
        const newProduct: Product = {
          ...(payload as Product),
          id: `p-${Date.now()}`,
        };
        setProducts((prev) => [newProduct, ...prev]);
      }
      showToast("Saved in-memory. Configure Supabase to persist.");
    }
    setSaving(false);
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    if (dbConfigured) {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) { showToast("Failed to delete", "err"); return; }
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
    showToast("Deleted.");
  };

  // ── Import ─────────────────────────────────────────────────────────────────

  const parseImport = () => {
    setImportError("");
    try {
      if (importTab === "json") {
        const parsed = JSON.parse(importText);
        setImportPreview(Array.isArray(parsed) ? parsed : [parsed]);
      } else {
        const parsed = parseCSV(importText);
        if (parsed.length === 0) throw new Error("No valid rows found");
        setImportPreview(parsed);
      }
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Parse error");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setImportText(ev.target?.result as string); setImportPreview([]); };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!importPreview.length) return;
    setImporting(true);
    if (dbConfigured) {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importPreview),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Import failed", "err"); setImporting(false); return; }
      showToast(`Imported ${json.inserted?.length ?? 0} products.`);
      await fetchProducts();
    } else {
      const newProds: Product[] = importPreview.map((p, i) => ({
        id: `import-${Date.now()}-${i}`,
        name: p.name ?? "",
        brand: (p.brand as Product["brand"]) ?? "Zara" as Product["brand"],
        category: (p.category as Category) ?? "tops",
        // Validated against the category, so a stray label in pasted JSON
        // doesn't produce a subcategory the filters can never match.
        subcategory: resolveSubcategory((p.category as Category) ?? "tops", p.subcategory, categoryGroups),
        description: p.description ?? "",
        imageUrl: p.imageUrl ?? "",
        images: p.images ?? [],
        colors: p.colors ?? [],
        sizes: p.sizes ?? [],
        material: p.material ?? "",
        retailers: [],
        priceMin: p.priceMin ?? 0,
        priceMax: p.priceMax ?? 0,
        currency: "USD",
        isNew: p.isNew ?? false,
        isSaved: false,
        styleKeywords: (p.styleKeywords ?? ["minimal"]) as Product["styleKeywords"],
      }));
      setProducts((prev) => [...newProds, ...prev]);
      showToast(`Imported ${newProds.length} products (in-memory).`);
    }
    setImporting(false);
    setShowImport(false);
    setImportText("");
    setImportPreview([]);
  };

  const handleSeed = async () => {
    setSeeding(true);
    const res = await fetch("/api/products/seed", { method: "POST" });
    const json = await res.json();
    if (!res.ok) { showToast(json.error || "Seed failed", "err"); setSeeding(false); return; }
    showToast(json.message);
    await fetchProducts();
    setSeeding(false);
  };

  // Re-run the category classifier over EVERY product already in the DB (the
  // import fix only affects new imports). Dry-run first, show what would change,
  // and only write after the admin confirms. scope=all re-evaluates the whole
  // catalog, not just the accessories bucket.
  /* ── Bulk edit: one set of changes across a selection ─────────────────── */

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  /** Every field starts blank, and a blank field is left alone. */
  const [bulk, setBulk] = useState({
    brand: "",
    gender: "",
    subcategory: "",
    styleKeywords: [] as StyleKeyword[],
    styleMode: "add" as "add" | "replace",
    colorGroupIds: [] as number[],
    colorMode: "add" as "add" | "replace",
    namePrefix: "",
    nameSuffix: "",
    nameFind: "",
    nameReplace: "",
  });

  const resetBulk = () => setBulk({
    brand: "", gender: "", subcategory: "",
    styleKeywords: [], styleMode: "add",
    colorGroupIds: [], colorMode: "add",
    namePrefix: "", nameSuffix: "", nameFind: "", nameReplace: "",
  });

  const bulkChangeCount =
    (bulk.brand.trim() ? 1 : 0) +
    (bulk.gender ? 1 : 0) +
    (bulk.subcategory ? 1 : 0) +
    (bulk.styleKeywords.length ? 1 : 0) +
    (bulk.colorGroupIds.length ? 1 : 0) +
    (bulk.namePrefix || bulk.nameSuffix || bulk.nameFind ? 1 : 0);

  const applyBulkEdit = async () => {
    const ids = [...selectedIds];
    if (!ids.length || !bulkChangeCount) return;

    const set: Record<string, unknown> = {};
    const add: Record<string, unknown> = {};
    if (bulk.brand.trim()) set.brand = bulk.brand.trim();
    if (bulk.gender) set.gender = bulk.gender;
    if (bulk.subcategory) set.subcategory = bulk.subcategory;
    if (bulk.styleKeywords.length) {
      (bulk.styleMode === "replace" ? set : add).styleKeywords = bulk.styleKeywords;
    }
    if (bulk.colorGroupIds.length) {
      (bulk.colorMode === "replace" ? set : add).colorGroupIds = bulk.colorGroupIds;
    }

    const summary = [
      bulk.brand.trim() && `brand → ${bulk.brand.trim()}`,
      bulk.gender && `gender → ${bulk.gender}`,
      bulk.subcategory && `subcategory → ${bulk.subcategory} (and its category)`,
      bulk.styleKeywords.length && `${bulk.styleMode === "replace" ? "replace" : "add"} styles: ${bulk.styleKeywords.join(", ")}`,
      bulk.colorGroupIds.length && `${bulk.colorMode === "replace" ? "replace" : "add"} ${bulk.colorGroupIds.length} colour filter(s)`,
      bulk.nameFind && `rename: "${bulk.nameFind}" → "${bulk.nameReplace}"`,
      bulk.namePrefix && `prefix "${bulk.namePrefix}"`,
      bulk.nameSuffix && `suffix "${bulk.nameSuffix}"`,
    ].filter(Boolean).join("\n  ");

    if (!confirm(`Apply to ${ids.length} product${ids.length === 1 ? "" : "s"}?\n\n  ${summary}\n\nFields left blank are not touched.`)) return;

    setBulkSaving(true);
    try {
      const res = await fetch("/api/products/bulk-edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          set,
          add,
          name: {
            prefix: bulk.namePrefix,
            suffix: bulk.nameSuffix,
            find: bulk.nameFind,
            replace: bulk.nameReplace,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Bulk edit failed.", "err"); return; }
      const failed = (json.failures ?? []).length;
      showToast(
        failed
          ? `Updated ${json.updated} of ${json.requested} — ${failed} failed`
          : `Updated ${json.updated} product${json.updated === 1 ? "" : "s"}`,
        failed ? "err" : "ok",
      );
      setBulkOpen(false);
      resetBulk();
      setSelectedIds(new Set());
      await fetchProducts();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bulk edit failed.", "err");
    } finally {
      setBulkSaving(false);
    }
  };

  /* ── Autofill: what the catalogue can work out about a draft ──────────── */

  interface FieldSuggestion {
    field: "category" | "subcategory" | "gender" | "colorGroups";
    value: string | string[];
    confidence: "high" | "low";
    why: string;
    replaces?: string;
    alsoSetsCategory?: string;
  }

  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<FieldSuggestion[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const runSuggest = async () => {
    if (!form.name.trim()) { showToast("Give it a name first — that is what the suggestions read.", "err"); return; }
    setSuggesting(true);
    try {
      const res = await fetch("/api/admin/suggest-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          brand: form.brand,
          colors: form.colorsRaw.split(",").map((c) => c.trim()).filter(Boolean),
          category: form.category,
          subcategory: form.subcategory,
          gender: form.gender,
          colorGroups: form.colorGroupIds
            .map((id) => colorGroups.find((g) => g.id === id)?.name)
            .filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Could not suggest anything.", "err"); return; }
      const found = (json.suggestions ?? []) as FieldSuggestion[];
      setSuggestions(found);
      // Only the confident ones start ticked. A low-confidence field left
      // empty is obviously unfinished; one filled in wrongly is not.
      setChosen(new Set(found.filter((s) => s.confidence === "high").map((s) => s.field)));
      if (!found.length) showToast("Nothing to suggest — either it is already filled in or the name says too little.");
    } catch {
      showToast("Could not reach the server.", "err");
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestions = () => {
    const taking = (suggestions ?? []).filter((s) => chosen.has(s.field));
    if (!taking.length) return;
    setForm((f) => {
      const next = { ...f };
      for (const s of taking) {
        if (s.field === "subcategory") {
          next.subcategory = String(s.value);
          // The tree says which category the label belongs to, so the pair
          // cannot be left contradicting itself.
          if (s.alsoSetsCategory) next.category = s.alsoSetsCategory as Category;
        } else if (s.field === "category") {
          next.category = String(s.value) as Category;
        } else if (s.field === "gender") {
          next.gender = String(s.value) as Gender;
        } else if (s.field === "colorGroups") {
          const ids = (s.value as string[])
            .map((name) => colorGroups.find((g) => g.name.toLowerCase() === name.toLowerCase())?.id)
            .filter((id): id is number => typeof id === "number");
          next.colorGroupIds = [...new Set([...f.colorGroupIds, ...ids])];
        }
      }
      return next;
    });
    showToast(`Filled ${taking.length} field${taking.length === 1 ? "" : "s"} — nothing saved yet.`);
    setSuggestions(null);
    setChosen(new Set());
  };

  const handleRecategorize = async () => {
    setRecategorizing(true);
    try {
      const dryRes = await fetch("/api/admin/recategorize?scope=all", { cache: "no-store" });
      const dry = await dryRes.json();
      if (!dryRes.ok) { showToast(dry.error || "Recategorize failed", "err"); return; }

      // Products the classifier left alone, and why. Worth stating up front:
      // the whole worry about this button is that it overwrites hand-filed work,
      // and the answer is that it refuses to look at it.
      const guarded = (dry.skippedBreakdown ?? []) as { reason: string; explanation: string; count: number }[];
      const guardNote = guarded
        .filter((g) => g.count > 0)
        .map((g) => `  ${g.count} left untouched — ${g.explanation}`)
        .join("\n");

      if (!dry.wouldChange) {
        showToast(
          dry.protected
            ? `Nothing to change · ${dry.protected} product${dry.protected === 1 ? "" : "s"} protected`
            : "Nothing to recategorize — every product looks correct",
        );
        if (guardNote) window.alert(`No changes to make.\n\n${guardNote}`);
        return;
      }

      const summary = Object.entries(dry.breakdown as Record<string, number>)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `  ${k}: ${n}`)
        .join("\n");
      const ok = window.confirm(
        `Recategorize ${dry.wouldChange} of ${dry.scanned} products?\n\n${summary}\n\n${guardNote}\n\n` +
        `Only products with no subcategory can be changed. This can be undone.`,
      );
      if (!ok) return;

      const applyRes = await fetch("/api/admin/recategorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, scope: "all" }),
      });
      const applied = await applyRes.json();
      if (!applyRes.ok) { showToast(applied.error || "Apply failed", "err"); return; }
      showToast(
        applied.undoable
          ? `Recategorized ${applied.applied} · use Undo to revert`
          : `Recategorized ${applied.applied} — NOT recorded, so it cannot be undone`,
        applied.undoable ? "ok" : "err",
      );
      await fetchProducts();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Recategorize failed", "err");
    } finally {
      setRecategorizing(false);
    }
  };

  /** Puts back whatever the last "Fix categories" run changed. */
  const handleUndoRecategorize = async () => {
    if (!confirm("Undo the last category fix?\n\nProducts edited since that run are left as they are.")) return;
    setRecategorizing(true);
    try {
      const res = await fetch("/api/admin/recategorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Nothing to undo", "err"); return; }
      showToast(
        json.movedSince
          ? `Restored ${json.restored} · ${json.movedSince} changed since and left alone`
          : `Restored ${json.restored} product${json.restored === 1 ? "" : "s"}`,
      );
      await fetchProducts();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Undo failed", "err");
    } finally {
      setRecategorizing(false);
    }
  };

  /**
   * Measures the backdrop each product photo was shot on, so cards can pad with
   * that instead of with white.
   *
   * Runs in batches because it downloads images: one pass over the whole
   * catalogue would outlast any request. Clicking again picks up where it left
   * off — nothing is measured twice.
   *
   * The dry run deliberately covers a sample rather than everything. It exists
   * to answer "how many photos actually have a backdrop", which is a rate, and
   * measuring a rate over forty photos costs forty downloads instead of ten
   * thousand.
   */
  const handleSampleBackdrops = async () => {
    setSampling(true);
    try {
      const chosenIds = selectedIds.size ? [...selectedIds] : [];

      const post = (body: Record<string, unknown>) =>
        fetch("/api/admin/product-bg-color", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

      if (!chosenIds.length) {
        const progressRes = await fetch("/api/admin/product-bg-color", { cache: "no-store" });
        const p = await progressRes.json();
        if (!progressRes.ok) { showToast(p.error || "Could not read progress", "err"); return; }
        if (p.progress.total && !p.progress.unmeasured) {
          showToast(
            `All ${p.progress.total} measured · ${p.progress.measured} have a backdrop, ` +
            `${p.progress.declined} have none`,
          );
          return;
        }
      }

      const dryRes = await post({ limit: BACKDROP_SAMPLE, ids: chosenIds });
      const dry = await dryRes.json();
      if (!dryRes.ok) { showToast(dry.error || "Sampling failed", "err"); return; }

      if (!dry.scanned) { showToast("Nothing left to measure"); return; }

      const examples = (dry.measuredSample as { name: string; color: string }[])
        .slice(0, 6)
        .map((m) => `  ${m.color}  ${m.name}`)
        .join("\n");
      const whyNot = (dry.declinedSample as { reason: string }[])
        .reduce((acc: Record<string, number>, d) => {
          // Strip the measured numbers out of the reason so the tally groups.
          const kind = d.reason.replace(/\s*\([^)]*\)/, "");
          acc[kind] = (acc[kind] ?? 0) + 1;
          return acc;
        }, {});
      const whyNotNote = Object.entries(whyNot)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, n]) => `  ${n} — ${reason}`)
        .join("\n");

      const remaining = (dry.progress?.unmeasured ?? dry.scanned) as number;
      const ok = window.confirm(
        `Measured ${dry.scanned} photo${dry.scanned === 1 ? "" : "s"} without saving:\n\n` +
        `  ${dry.measured} have a single backdrop\n` +
        `  ${dry.declined} have none — those keep the white box\n` +
        (dry.failed ? `  ${dry.failed} could not be downloaded — will be retried later\n` : "") +
        (examples ? `\n${examples}\n` : "") +
        (whyNotNote ? `\nWhy the rest were declined:\n${whyNotNote}\n` : "") +
        `\n${chosenIds.length
          ? `Save these ${dry.scanned} now?`
          : `Save, and keep going until all ${remaining} unmeasured products are done?`}\n\n` +
        `This can be undone.`,
      );
      if (!ok) return;

      // One click works through the catalogue rather than one batch of it. The
      // loop is bounded two ways: a round cap, and a stall check — if a round
      // measures nothing and declines nothing, everything left is failing to
      // download and calling again would only repeat that.
      let rounds = 0;
      let totalMeasured = 0;
      let totalDeclined = 0;
      let totalFailed = 0;
      let thumbnails = 0;
      let notRecorded = false;
      let left: number | undefined;

      while (rounds < BACKDROP_MAX_ROUNDS) {
        rounds++;
        const res = await post({
          apply: true,
          limit: chosenIds.length ? BACKDROP_SAMPLE : BACKDROP_BATCH,
          ids: chosenIds,
        });
        const round = await res.json();
        if (!res.ok) {
          showToast(round.error || "Apply failed", "err");
          break;
        }

        totalMeasured += round.measured ?? 0;
        totalDeclined += round.declined ?? 0;
        totalFailed = round.failed ?? 0;
        thumbnails += round.viaThumbnail ?? 0;
        if (round.undoable === false) notRecorded = true;
        // Null when the progress count failed after a successful write — say
        // nothing about what is left rather than guessing at it.
        left = round.progress?.unmeasured as number | undefined;

        const moved = (round.measured ?? 0) + (round.declined ?? 0);
        if (chosenIds.length || left === undefined || left === 0 || moved === 0) break;

        showToast(`${totalMeasured} measured · ${left} left…`);
      }

      showToast(
        `${totalMeasured} measured · ${totalDeclined} have no backdrop` +
        (totalFailed ? ` · ${totalFailed} to retry` : "") +
        (left === undefined ? "" : left ? ` · ${left} left, click again` : " · all done") +
        // Worth saying: without renditions every photo came at full size, which
        // is the difference between a minute and an hour on a large catalogue.
        (totalMeasured && !thumbnails ? " — full-size photos, no Storage renditions" : "") +
        (notRecorded ? " — NOT recorded, cannot be undone" : ""),
        notRecorded ? "err" : "ok",
      );
      await fetchProducts();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sampling failed", "err");
    } finally {
      setSampling(false);
    }
  };

  /** Clears whatever the last backdrop run wrote. */
  const handleUndoBackdrops = async () => {
    if (!confirm("Undo the last photo-backdrop run?\n\nProducts changed since that run are left as they are.")) return;
    setSampling(true);
    try {
      const res = await fetch("/api/admin/product-bg-color", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Nothing to undo", "err"); return; }
      showToast(
        json.changedSince
          ? `Cleared ${json.restored} · ${json.changedSince} changed since and left alone`
          : `Cleared ${json.restored} product${json.restored === 1 ? "" : "s"}`,
      );
      await fetchProducts();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Undo failed", "err");
    } finally {
      setSampling(false);
    }
  };

  const toggleKeyword = (kw: StyleKeyword) => {
    setForm((f) => ({
      ...f,
      styleKeywords: f.styleKeywords.includes(kw)
        ? f.styleKeywords.filter((k) => k !== kw)
        : [...f.styleKeywords, kw],
    }));
  };

  // ── Sort / select helpers ───────────────────────────────────────────────────

  const toggleSort = (key: SortColumn) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "createdAt" ? "desc" : "asc"); }
  };

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  // Keep the Sort dropdown in sync with column-header clicks. If a header produced a
  // (key, dir) combo that isn't a named preset (e.g. Category ↓), surface it as an option
  // so the <select> always reflects the active sort instead of falling back to the first item.
  const currentSortValue = `${sortKey}:${sortDir}`;
  const isDefaultSort = currentSortValue === "createdAt:desc";
  const sortOptions = SORT_OPTIONS.some((o) => o.value === currentSortValue)
    ? SORT_OPTIONS
    : [...SORT_OPTIONS, { value: currentSortValue, label: `${sortKey} (${sortDir})` }];

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));

  const openGroupModal = () => {
    const selected = filtered.filter((p) => selectedIds.has(p.id));
    if (selected.length < 2) return;
    // Detect if all selected are already in the same group
    const groupIds = [...new Set(selected.map((p) => p.variantGroupId).filter(Boolean))];
    const existingGroupId = groupIds.length === 1 ? (groupIds[0] as string) : undefined;
    setGroupModal({
      open: true,
      existingGroupId,
      entries: selected.map((p, i) => ({
        id: p.id,
        colorHex: p.colorHex ?? "#888888",
        isPrimary: existingGroupId ? !!p.isGroupPrimary : i === 0,
      })),
    });
  };

  const handleGroupSave = async () => {
    const { entries, existingGroupId } = groupModal;
    const primaryEntry = entries.find((e) => e.isPrimary) ?? entries[0];
    setGrouping(true);
    const colorHexMap: Record<string, string> = {};
    entries.forEach((e) => { colorHexMap[e.id] = e.colorHex; });
    const res = await fetch("/api/products/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: entries.map((e) => e.id),
        primaryId: primaryEntry.id,
        colorHexMap,
        groupId: existingGroupId,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      setGrouping(false);
      if (err.needsMigration) {
        setGroupModal({ open: false, entries: [] });
        setShowMigrationModal(true);
      } else {
        showToast(err.error || "Failed to group products", "err");
      }
      return;
    }
    showToast(`${entries.length} products grouped as variants.`);
    setGroupModal({ open: false, entries: [] });
    setSelectedIds(new Set());
    setGrouping(false);
    await fetchProducts();
  };

  const handleUngroup = async (groupId: string) => {
    if (!confirm("Unlink all variants in this group?")) return;
    const res = await fetch("/api/products/group", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    if (!res.ok) { showToast("Failed to unlink", "err"); return; }
    showToast("Variants unlinked.");
    await fetchProducts();
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} selected product${count > 1 ? "s" : ""}?`)) return;
    const ids = [...selectedIds];
    if (dbConfigured) {
      await Promise.all(ids.map((id) => fetch(`/api/products/${id}`, { method: "DELETE" })));
    }
    setProducts((prev) => prev.filter((p) => !ids.includes(p.id)));
    setSelectedIds(new Set());
    showToast(`Deleted ${count} product${count > 1 ? "s" : ""}.`);
  };

  // Sort arrow helper
  const SortIcon = ({ col }: { col: SortColumn }) => (
    <span className="inline-flex flex-col ml-1 gap-[1px] opacity-50 group-hover:opacity-100">
      <span className={`block w-0 h-0 border-x-[3px] border-x-transparent border-b-[4px] ${sortKey === col && sortDir === "asc" ? "border-b-[var(--foreground)] opacity-100" : "border-b-[var(--foreground-muted)]"}`} />
      <span className={`block w-0 h-0 border-x-[3px] border-x-transparent border-t-[4px] ${sortKey === col && sortDir === "desc" ? "border-t-[var(--foreground)] opacity-100" : "border-t-[var(--foreground-muted)]"}`} />
    </span>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* DB status banner */}
      {dbConfigured === false && (
        <div className="mb-4 border border-amber-300 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
          <strong>Database not configured.</strong> Products are in-memory only.
          Add <code className="font-mono">SUPABASE_URL</code> and{" "}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in Vercel env vars to persist.
        </div>
      )}
      {dbConfigured === true && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowMigrationModal(true)}
            className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors underline"
          >
            View variant migration SQL
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Products</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
            {products.length} total &middot; {filtered.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRecategorize}
            disabled={recategorizing || !dbConfigured}
            title={dbConfigured ? "Re-classify products that have no subcategory. Anything filed by hand is left alone." : "Requires Supabase"}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg px-3 py-2 text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {recategorizing ? "Sorting…" : "Fix categories"}
          </button>
          {/* Always available, not just after a run in this tab: the run to
              regret is usually the one from before the page was reloaded. */}
          <button
            onClick={handleUndoRecategorize}
            disabled={recategorizing || !dbConfigured}
            title={dbConfigured ? "Put back what the last category fix changed" : "Requires Supabase"}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg px-3 py-2 text-xs tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Undo fix
          </button>
          {/* Reads the colour each photo was shot on, so cards stop framing
              off-white photos in a white box. Works on the selection when there
              is one, otherwise on the next batch of never-measured products. */}
          <button
            onClick={handleSampleBackdrops}
            disabled={sampling || !dbConfigured}
            title={
              dbConfigured
                ? selectedIds.size
                  ? `Re-measure the photo backdrop of ${selectedIds.size} selected`
                  : "Measure photo backdrops so cards pad with the photo's own colour"
                : "Requires Supabase"
            }
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg px-3 py-2 text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sampling
              ? "Measuring…"
              : selectedIds.size
                ? `Backdrops (${selectedIds.size})`
                : "Photo backdrops"}
          </button>
          <button
            onClick={handleUndoBackdrops}
            disabled={sampling || !dbConfigured}
            title={dbConfigured ? "Clear what the last backdrop run wrote" : "Requires Supabase"}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg px-3 py-2 text-xs tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Undo backdrops
          </button>
          <button
            onClick={handleSeed}
            disabled={seeding || !dbConfigured}
            title={dbConfigured ? "Seed default catalog" : "Requires Supabase"}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg px-3 py-2 text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {seeding ? "Seeding…" : "Seed catalog"}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg px-3 py-2 text-xs tracking-[0.1em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v7M3 5l3 3 3-3M1 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Import
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-[var(--foreground)] text-[var(--background)] px-4 py-2 text-xs tracking-[0.12em] uppercase transition-opacity hover:opacity-80 rounded-lg"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Add Product
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="mb-5 flex flex-col gap-3">
        <input
          type="search"
          placeholder="Search by name, brand or category…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${inputCls} max-w-sm`}
        />

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mr-1">Filter:</span>

          {/* Group chips, then the active group's subcategories — the same two
              levels the edit form and the catalog filters use. */}
          {categoryGroups.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setFilterGroup((prev) => (prev === g.id ? "" : g.id));
                setFilterSubcategory("");
              }}
              className={`px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase border rounded-full transition-colors ${
                filterGroup === g.id
                  ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {g.label}
            </button>
          ))}
          {filterGroup && (
            <>
              <span className="text-[var(--foreground-subtle)] mx-1">·</span>
              {(categoryGroups.find((g) => g.id === filterGroup)?.items ?? []).map((item) => (
                <button
                  key={item.label}
                  onClick={() => setFilterSubcategory((prev) => (prev === item.label ? "" : item.label))}
                  className={`px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase border rounded-full transition-colors ${
                    filterSubcategory === item.label
                      ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </>
          )}

          {/* Divider */}
          <span className="w-px h-4 bg-[var(--border)]" />

          {/* The rest of a product's fields, as dropdowns — too many values for
              chips, and each one narrows the list independently of the others. */}
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className={filterSelectCls}
            title="Brand"
          >
            <option value="">All brands</option>
            {brandsInCatalogue.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={filterColorGroup}
            onChange={(e) => setFilterColorGroup(e.target.value)}
            className={filterSelectCls}
            title="Colour filter group"
          >
            <option value="">All colours</option>
            {colorGroups.map((g) => (
              <option key={g.id} value={String(g.id)}>{g.name}</option>
            ))}
          </select>

          <select
            value={filterStyle}
            onChange={(e) => setFilterStyle(e.target.value)}
            className={filterSelectCls}
            title="Style keyword"
          >
            <option value="">All styles</option>
            {STYLE_KEYWORDS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={filterGender}
            onChange={(e) => setFilterGender(e.target.value)}
            className={filterSelectCls}
            title="Gender"
          >
            <option value="">All genders</option>
            <option value="women">Women</option>
            <option value="men">Men</option>
            <option value="unisex">Unisex</option>
          </select>

          {/* Divider */}
          <span className="w-px h-4 bg-[var(--border)]" />

          {/* The gaps. Filtering by what a product HAS cannot find what it is
              missing, which is most of the work when tidying a catalogue. */}
          <select
            value={filterMissing}
            onChange={(e) => setFilterMissing(e.target.value)}
            className={`${filterSelectCls} ${filterMissing ? "border-amber-500/60 text-amber-600" : ""}`}
            title="Show only products missing a field"
          >
            <option value="">Missing: anything</option>
            {MISSING_FILTERS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {/* Divider */}
          <span className="w-px h-4 bg-[var(--border)]" />

          {/* New chip */}
          <button
            onClick={() => setFilterNew((prev) => (prev === true ? null : true))}
            className={`px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase border rounded-full transition-colors ${
              filterNew === true
                ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            New only
          </button>

          {/* Divider */}
          <span className="w-px h-4 bg-[var(--border)]" />

          {/* Sort dropdown */}
          <label className="inline-flex items-center gap-1.5">
            <span className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">Sort:</span>
            <select
              value={currentSortValue}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":") as [SortColumn, "asc" | "desc"];
                setSortKey(key);
                setSortDir(dir);
              }}
              className="rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 outline-none focus:border-[var(--foreground)] transition-colors cursor-pointer"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          {/* Clear filters */}
          {(filterGroup || filterSubcategory || filterBrand || filterColorGroup || filterStyle || filterGender || filterMissing || filterNew !== null || !isDefaultSort) && (
            <button
              onClick={() => {
                setFilterGroup(""); setFilterSubcategory("");
                setFilterBrand(""); setFilterColorGroup(""); setFilterStyle(""); setFilterGender("");
                setFilterMissing(""); setFilterNew(null);
                setSortKey("createdAt"); setSortDir("desc");
              }}
              className="ml-1 text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] underline transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bulk edit modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setBulkOpen(false)}>
          <div
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--border)] shadow-xl"
            style={{ background: "var(--background)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                  Edit {selectedIds.size} product{selectedIds.size === 1 ? "" : "s"}
                </h2>
                <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
                  Anything left blank is not touched.
                </p>
              </div>
              <button onClick={() => setBulkOpen(false)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              {/* Brand + gender */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Brand</label>
                  <input
                    list="bulk-brands"
                    value={bulk.brand}
                    onChange={(e) => setBulk((b) => ({ ...b, brand: e.target.value }))}
                    placeholder="Leave blank to keep"
                    className={inputCls}
                  />
                  <datalist id="bulk-brands">
                    {brandsInCatalogue.map((b) => <option key={b} value={b} />)}
                  </datalist>
                </div>
                <div>
                  <label className={labelCls}>Gender</label>
                  <select value={bulk.gender} onChange={(e) => setBulk((b) => ({ ...b, gender: e.target.value }))} className={selectCls}>
                    <option value="">Keep as is</option>
                    <option value="women">Women</option>
                    <option value="men">Men</option>
                    <option value="unisex">Unisex</option>
                  </select>
                </div>
              </div>

              {/* Subcategory — sets the category with it */}
              <div>
                <label className={labelCls}>Subcategory</label>
                <select
                  value={bulk.subcategory}
                  onChange={(e) => setBulk((b) => ({ ...b, subcategory: e.target.value }))}
                  className={selectCls}
                >
                  <option value="">Keep as is</option>
                  {categoryGroups.map((g) => (
                    <optgroup key={g.id} label={g.label}>
                      {g.items.map((i) => <option key={i.label} value={i.label}>{i.label}</option>)}
                    </optgroup>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">
                  Sets the category to match, since the tree says where the label belongs.
                </p>
              </div>

              {/* Style keywords */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls}>Style keywords</label>
                  <div className="flex gap-1">
                    {(["add", "replace"] as const).map((mode) => (
                      <button key={mode} onClick={() => setBulk((b) => ({ ...b, styleMode: mode }))}
                        className={`px-2 py-0.5 text-[9px] tracking-[0.1em] uppercase border transition-colors ${bulk.styleMode === mode ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] text-[var(--foreground-muted)]"}`}
                      >{mode}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_KEYWORDS.map((k) => {
                    const on = bulk.styleKeywords.includes(k);
                    return (
                      <button key={k} onClick={() => setBulk((b) => ({
                        ...b,
                        styleKeywords: on ? b.styleKeywords.filter((x) => x !== k) : [...b.styleKeywords, k],
                      }))}
                        className={`px-2.5 py-1 text-[11px] border transition-colors ${on ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)]"}`}
                      >{k}</button>
                    );
                  })}
                </div>
              </div>

              {/* Colour filters */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls}>Colour filters</label>
                  <div className="flex gap-1">
                    {(["add", "replace"] as const).map((mode) => (
                      <button key={mode} onClick={() => setBulk((b) => ({ ...b, colorMode: mode }))}
                        className={`px-2 py-0.5 text-[9px] tracking-[0.1em] uppercase border transition-colors ${bulk.colorMode === mode ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] text-[var(--foreground-muted)]"}`}
                      >{mode}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {colorGroups.map((g) => {
                    const on = bulk.colorGroupIds.includes(g.id);
                    return (
                      <button key={g.id} onClick={() => setBulk((b) => ({
                        ...b,
                        colorGroupIds: on ? b.colorGroupIds.filter((x) => x !== g.id) : [...b.colorGroupIds, g.id],
                      }))}
                        className={`px-2.5 py-1 text-[11px] border transition-colors ${on ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)]"}`}
                      >{g.name}</button>
                    );
                  })}
                </div>
              </div>

              {/* Names */}
              <div>
                <label className={labelCls}>Names</label>
                <div className="grid grid-cols-2 gap-2">
                  <input value={bulk.nameFind} onChange={(e) => setBulk((b) => ({ ...b, nameFind: e.target.value }))} placeholder="Find…" className={inputCls} />
                  <input value={bulk.nameReplace} onChange={(e) => setBulk((b) => ({ ...b, nameReplace: e.target.value }))} placeholder="Replace with…" className={inputCls} />
                  <input value={bulk.namePrefix} onChange={(e) => setBulk((b) => ({ ...b, namePrefix: e.target.value }))} placeholder="Add before…" className={inputCls} />
                  <input value={bulk.nameSuffix} onChange={(e) => setBulk((b) => ({ ...b, nameSuffix: e.target.value }))} placeholder="Add after…" className={inputCls} />
                </div>
                <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">
                  There is no &ldquo;set the same name&rdquo;: identical names across a selection destroy the ones they replace.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--border)]">
              <span className="text-[11px] text-[var(--foreground-muted)]">
                {bulkChangeCount ? `${bulkChangeCount} field${bulkChangeCount === 1 ? "" : "s"} will change` : "Nothing to change yet"}
              </span>
              <div className="flex items-center gap-3">
                <button onClick={() => { setBulkOpen(false); resetBulk(); }} className="text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                  Cancel
                </button>
                <button
                  onClick={applyBulkEdit}
                  disabled={bulkSaving || !bulkChangeCount}
                  className="bg-[var(--foreground)] text-[var(--background)] px-5 py-2 text-xs tracking-[0.12em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
                >
                  {bulkSaving ? "Applying…" : `Apply to ${selectedIds.size}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="mb-3 flex items-center gap-3 border border-[var(--border)] rounded-xl px-4 py-2.5 bg-[var(--surface)]">
          <span className="text-xs text-[var(--foreground)]">
            {selectedIds.size} selected
          </span>
          {selectedIds.size >= 2 && (
            <button
              onClick={openGroupModal}
              className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-3 py-1.5 hover:bg-[var(--surface)] transition-colors rounded-lg"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="3" cy="6" r="2" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="9" cy="6" r="2" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M5 6h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Group variants
            </button>
          )}
          <button
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-3 py-1.5 hover:bg-[var(--surface)] transition-colors rounded-lg"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8.5 1.5l2 2-6 6-2.5.5.5-2.5 6-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            Edit {selectedIds.size}
          </button>
          <button
            onClick={handleBulkDelete}
            className="inline-flex items-center gap-1.5 text-xs tracking-[0.1em] uppercase border border-red-400 text-red-500 dark:text-red-400 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors rounded-lg"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 3h10M4 3V2h4v1M5 5.5v3M7 5.5v3M2 3l.7 7.3A1 1 0 003.7 11h4.6a1 1 0 001-.7L10 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Delete {selectedIds.size}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors ml-auto"
          >
            Deselect all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-x-auto" style={{ background: "var(--background)" }}>
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]" style={{ background: "var(--surface)" }}>
                {/* Checkbox */}
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 accent-[var(--foreground)] cursor-pointer"
                    title="Select all"
                  />
                </th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal w-16">Image</th>
                <th className="text-left px-2 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">
                  <button onClick={() => toggleSort("name")} className="group inline-flex items-center gap-0.5 hover:text-[var(--foreground)] transition-colors">
                    Name <SortIcon col="name" />
                  </button>
                </th>
                <th className="text-left px-2 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden md:table-cell">
                  <button onClick={() => toggleSort("brand")} className="group inline-flex items-center gap-0.5 hover:text-[var(--foreground)] transition-colors">
                    Brand <SortIcon col="brand" />
                  </button>
                </th>
                <th className="text-left px-2 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden lg:table-cell">
                  <button onClick={() => toggleSort("category")} className="group inline-flex items-center gap-0.5 hover:text-[var(--foreground)] transition-colors">
                    Category <SortIcon col="category" />
                  </button>
                </th>
                <th className="text-left px-2 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">
                  <button onClick={() => toggleSort("priceMin")} className="group inline-flex items-center gap-0.5 hover:text-[var(--foreground)] transition-colors">
                    Price <SortIcon col="priceMin" />
                  </button>
                </th>
                <th className="text-left px-2 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden sm:table-cell">New</th>
                <th className="text-left px-2 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden lg:table-cell">
                  <button onClick={() => toggleSort("createdAt")} className="group inline-flex items-center gap-0.5 hover:text-[var(--foreground)] transition-colors">
                    Added <SortIcon col="createdAt" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">
                    No products found.
                  </td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr
                    key={product.id}
                    className={`border-b border-[var(--border)] last:border-b-0 transition-colors ${
                      selectedIds.has(product.id) ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="w-3.5 h-3.5 accent-[var(--foreground)] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative w-10 h-[52px] overflow-hidden">
                        {product.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[var(--surface)]" />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm text-[var(--foreground)]">{product.name}</span>
                        {product.variantGroupId && (
                          <span
                            className="inline-flex items-center gap-1 text-[8px] tracking-[0.12em] uppercase border px-1.5 py-0.5 leading-none"
                            style={{
                              borderColor: product.colorHex ?? "var(--border)",
                              color: product.colorHex ?? "var(--foreground-muted)",
                            }}
                          >
                            {product.isGroupPrimary ? "Primary" : "Variant"}
                            {product.colorHex && (
                              <span
                                className="inline-block w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: product.colorHex }}
                              />
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 hidden md:table-cell">
                      <span className="text-sm text-[var(--foreground-muted)]">{product.brand}</span>
                    </td>
                    <td className="px-2 py-3 hidden lg:table-cell">
                      <span className="text-xs tracking-[0.08em] uppercase text-[var(--foreground-subtle)]">{categoryPath(product.category, product.subcategory, categoryGroups)}</span>
                    </td>
                    <td className="px-2 py-3">
                      <span className="text-sm text-[var(--foreground)]">
                        {fmtPrice(product.priceMin)}{product.priceMax !== product.priceMin ? `–${fmtPrice(product.priceMax)}` : ""}
                      </span>
                    </td>
                    <td className="px-2 py-3 hidden sm:table-cell">
                      {product.isNew ? (
                        <span className="text-[9px] tracking-[0.14em] uppercase border border-[var(--foreground)] text-[var(--foreground)] px-1.5 py-0.5">New</span>
                      ) : (
                        <span className="text-[var(--foreground-subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3 hidden lg:table-cell">
                      <span className="text-xs text-[var(--foreground-subtle)] whitespace-nowrap">{fmtDate(product.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {product.variantGroupId && dbConfigured && (
                          <button
                            onClick={() => handleUngroup(product.variantGroupId!)}
                            title="Unlink from variant group"
                            className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors p-1"
                            aria-label="Unlink variants"
                          >
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                              <path d="M5 4H3a3 3 0 000 6h2M9 4h2a3 3 0 010 6H9M2 7h10M5 2l2 2-2 2M9 2l-2 2 2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}
                        {/* Crop button */}
                        <button
                          onClick={() => setCropProduct(product)}
                          title={product.cropData ? "Изменить кадрирование" : "Настроить кадрирование"}
                          className={`transition-colors p-1 ${
                            product.cropData
                              ? "text-[var(--foreground)] opacity-90"
                              : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                          }`}
                          aria-label="Crop image"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M3 1v9a1 1 0 001 1h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                            <path d="M1 3h9a1 1 0 011 1v9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                            {product.cropData && <circle cx="7" cy="7" r="1.5" fill="currentColor"/>}
                          </svg>
                        </button>
                        <button onClick={() => openEditModal(product)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1" aria-label="Edit">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button onClick={() => openDuplicateModal(product)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1" aria-label="Duplicate" title="Duplicate product">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <rect x="1.5" y="4.5" width="7" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
                            <path d="M5 4.5V3a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1" aria-label="Delete">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="border border-[var(--border)] rounded-2xl max-w-5xl w-full mx-4 max-h-[94vh] flex flex-col overflow-hidden"
            style={{ background: "var(--background)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                  {editingProduct ? "Edit Product" : isDuplicating ? "Duplicate Product" : "Add Product"}
                </h2>
                <button
                  onClick={runSuggest}
                  disabled={suggesting || !dbConfigured}
                  title="Work out category, subcategory, gender and colour filters from the name, using how the rest of the catalogue is filed"
                  className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {suggesting ? "Reading…" : "Suggest fields"}
                </button>
              </div>
              <button onClick={closeModal} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Suggestions — spans the modal, above both columns, because the
                fields they land in live in different ones. */}
            {suggestions && suggestions.length > 0 && (
              <div className="shrink-0 border-b border-[var(--border)] px-6 py-3 bg-[var(--surface)]">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">
                    From how the catalogue is filed
                  </p>
                  <div className="flex items-center gap-3">
                    <button onClick={applySuggestions} disabled={!chosen.size}
                      className="border border-[var(--foreground)] text-[var(--foreground)] px-3 py-1.5 text-[10px] tracking-[0.12em] uppercase hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors disabled:opacity-40">
                      Fill {chosen.size || ""} selected
                    </button>
                    <button onClick={() => { setSuggestions(null); setChosen(new Set()); }}
                      className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors">
                      Dismiss
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {suggestions.map((s) => {
                    const shown = Array.isArray(s.value) ? s.value.join(", ") : s.value;
                    return (
                      <label key={s.field} className="flex items-start gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={chosen.has(s.field)}
                          onChange={() => setChosen((prev) => {
                            const next = new Set(prev);
                            next.has(s.field) ? next.delete(s.field) : next.add(s.field);
                            return next;
                          })}
                          className="mt-0.5 accent-[var(--foreground)]"
                        />
                        <span className="text-[11px] leading-relaxed">
                          <span className="tracking-[0.1em] uppercase text-[var(--foreground-subtle)]">{s.field}</span>{" "}
                          <span className="font-mono text-[var(--foreground)]">{shown}</span>
                          {s.replaces && <span className="text-amber-600"> — replaces {s.replaces}</span>}
                          {s.alsoSetsCategory && <span className="text-[var(--foreground-muted)]"> · also sets category to {s.alsoSetsCategory}</span>}
                          {s.confidence === "low" && <span className="text-amber-600"> · unsure</span>}
                          <span className="block text-[10px] text-[var(--foreground-subtle)]">{s.why}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-[var(--foreground-subtle)]">
                  Unsure ones start unticked. Filling a field changes nothing until you save.
                </p>
              </div>
            )}

            {/* Body — two-column */}
            <div className="grid grid-cols-[220px_1fr] flex-1 min-h-0 divide-x divide-[var(--border)]">

              {/* ── Left: Images ── */}
              <div className="flex flex-col gap-3 px-4 py-4 overflow-y-auto">
                <p className="text-[9px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">Images</p>
                <p className="text-[9px] text-[var(--foreground-subtle)] leading-relaxed">First = main. Paste URL → auto-uploaded to storage.</p>
                <ImageList
                  images={form.images}
                  onChange={(imgs) => setForm((f) => ({ ...f, images: imgs }))}
                />
              </div>

              {/* ── Right: Sections ── */}
              <div className="flex flex-col divide-y divide-[var(--border)] overflow-y-auto">

                {/* Chevron helper */}
                {(() => {
                  const Chevron = ({ open }: { open: boolean }) => (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
                      <path d="M2 4.5L6 7.5L10 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  );
                  const SecHead = ({ id, label, hint }: { id: string; label: string; hint?: string }) => (
                    <button
                      type="button"
                      onClick={() => toggleSection(id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--surface)] transition-colors text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-[9px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">{label}</span>
                        {hint && <span className="text-[9px] text-[var(--foreground-subtle)] normal-case tracking-normal font-normal">{hint}</span>}
                      </span>
                      <span className="text-[var(--foreground-subtle)]"><Chevron open={!collapsed.has(id)} /></span>
                    </button>
                  );

                  return (
                    <>
                      {/* ── Basic info (always open) ── */}
                      <div className="px-4 py-4 flex flex-col gap-3">
                        <p className="text-[9px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">Basic info</p>
                        <div>
                          <label className={labelCls}>Name *</label>
                          <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            placeholder="Product name"
                            className={inputCls}
                          />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <label className={labelCls}>Brand</label>
                        <input
                          ref={brandInputRef}
                          type="text"
                          value={form.brand}
                          onChange={(e) => { setForm((f) => ({ ...f, brand: e.target.value })); setBrandDropdownOpen(true); }}
                          onFocus={() => setBrandDropdownOpen(true)}
                          placeholder="Type or pick brand…"
                          className={inputCls}
                          autoComplete="off"
                        />
                        {brandDropdownOpen && (
                          <div ref={brandDropdownRef} className="absolute z-50 top-full left-0 right-0 mt-0.5 border border-[var(--border)] rounded-xl bg-[var(--background)] max-h-48 overflow-y-auto shadow-lg">
                            {(() => {
                              const q = form.brand.toLowerCase().trim();
                              const filtered = suggestedBrands.filter((b) => b.toLowerCase().includes(q));
                              const exactMatch = suggestedBrands.some((b) => b.toLowerCase() === q);
                              return (
                                <>
                                  {filtered.map((b) => (
                                    <button key={b} type="button" onMouseDown={(e) => { e.preventDefault(); setForm((f) => ({ ...f, brand: b })); setBrandDropdownOpen(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--surface)] transition-colors ${form.brand === b ? "text-[var(--foreground)] font-medium" : "text-[var(--foreground-muted)]"}`}>{b}</button>
                                  ))}
                                  {form.brand.trim() && !exactMatch && (
                                    <button type="button" disabled={addingBrand} onMouseDown={(e) => { e.preventDefault(); addBrandInline(form.brand.trim()); }} className="w-full text-left px-3 py-2 text-xs text-[var(--foreground)] border-t border-[var(--border)] hover:bg-[var(--surface)] flex items-center gap-2 transition-colors">
                                      {addingBrand ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <span className="text-base leading-none">+</span>}
                                      Add &ldquo;{form.brand.trim()}&rdquo; as new brand
                                    </button>
                                  )}
                                  {filtered.length === 0 && !form.brand.trim() && <p className="px-3 py-2 text-xs text-[var(--foreground-subtle)]">Start typing…</p>}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Gender</label>
                        <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Gender | "" }))} className={selectCls}>
                          <option value="">Unspecified</option>
                          <option value="women">Women</option>
                          <option value="men">Men</option>
                          <option value="unisex">Unisex</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* ── Category ── */}
                  <div>
                    <SecHead id="category" label="Category" hint={`— ${categoryPath(form.category, form.subcategory, categoryGroups)}`} />
                    {!collapsed.has("category") && (
                      <div className="px-4 pb-4 flex flex-col gap-2">
                        {(() => {
                          // One tree, the same one the catalog filters and the
                          // breadcrumbs read. Picking a subcategory sets the stored
                          // category too, so the two can never disagree.
                          // Resolved from the subcategory, not the category —
                          // a group added alongside an existing one can share
                          // its category value, and only the label says which
                          // of the two a piece is in.
                          const activeGroup = groupForProduct(form.category, form.subcategory, categoryGroups);
                          const pick = (label: string) =>
                            setForm((f) => ({
                              ...f,
                              category: subcatToValue[label] as Category,
                              subcategory: label,
                            }));
                          return (
                            <>
                              <div className="grid grid-cols-3 gap-1">
                                {categoryGroups.map((g) => {
                                  // Picking a group means picking its first
                                  // subcategory, so an empty one has nothing to
                                  // select until it gets one.
                                  const first = g.items[0];
                                  return (
                                    <button key={g.id} type="button"
                                      disabled={!first}
                                      title={first ? undefined : `${g.label} has no subcategories yet — add one under Categories.`}
                                      onClick={() => first && pick(first.label)}
                                      className={`py-1.5 text-[10px] border transition-colors text-center leading-tight disabled:opacity-40 disabled:cursor-not-allowed ${activeGroup?.id === g.id ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
                                    >{g.label}</button>
                                  );
                                })}
                              </div>

                              {activeGroup ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {activeGroup.items.map((item) => (
                                    <button key={item.label} type="button"
                                      onClick={() => pick(item.label)}
                                      className={`px-2.5 py-1.5 text-[11px] border transition-colors ${form.subcategory === item.label ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
                                    >{item.label}</button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-[var(--foreground-subtle)]">
                                  Stored as <code className="font-mono">{form.category}</code>, which is not in the catalog&apos;s
                                  filter tree — pick a group above to make this piece filterable.
                                </p>
                              )}

                              {activeGroup && !form.subcategory && (
                                <p className="text-[9px] text-[var(--foreground-subtle)]">
                                  No subcategory yet — this piece answers to every {activeGroup.label} filter until you pick one.
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* ── Sizes ── */}
                  <div>
                    <SecHead id="sizes" label="Sizes" hint={form.sizes ? `— ${form.sizes}` : undefined} />
                    {!collapsed.has("sizes") && (
                      <div className="px-4 pb-4 flex flex-col gap-2">
                        {(() => {
                          // The subcategory's own chart wins: Belts and
                          // Watches are both `accessories`, and only one of
                          // them has sizes. The category's chart stays as the
                          // fallback for pieces with no subcategory yet.
                          const sub = categoryGroups
                            .flatMap((g) => g.items)
                            .find((i) => i.label === form.subcategory);
                          const preset = sub?.sizes?.length
                            ? sub.sizes
                            : SIZE_PRESETS[form.category]?.sizes ?? [];
                          const selected = form.sizes.split(",").map((s) => s.trim()).filter(Boolean);
                          const toggle = (size: string) => {
                            const next = selected.includes(size) ? selected.filter((s) => s !== size) : [...selected, size];
                            const sorted = [...next].sort((a, b) => {
                              const ai = preset.indexOf(a), bi = preset.indexOf(b);
                              if (ai === -1 && bi === -1) return 0;
                              if (ai === -1) return 1;
                              if (bi === -1) return -1;
                              return ai - bi;
                            });
                            setForm((f) => ({ ...f, sizes: sorted.join(", ") }));
                          };
                          return (
                            <>
                              {preset.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {preset.map((size) => {
                                    const active = selected.includes(size);
                                    return (
                                      <button key={size} type="button" onClick={() => toggle(size)}
                                        className={`min-w-[34px] px-2 py-1.5 text-[11px] border transition-colors text-center ${active ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
                                      >{size}</button>
                                    );
                                  })}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <input type="text" value={form.sizes} onChange={(e) => setForm((f) => ({ ...f, sizes: e.target.value }))} placeholder="XS, S, M, L, XL" className={`${inputCls} flex-1`} />
                                {selected.length > 0 && (
                                  <button type="button" onClick={() => setForm((f) => ({ ...f, sizes: "" }))} className="text-[9px] tracking-wide text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors shrink-0">Clear</button>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* ── Pricing ── */}
                  <div>
                    <SecHead id="pricing" label="Pricing" />
                    {!collapsed.has("pricing") && (
                      <div className="px-4 pb-4 flex flex-col gap-3">
                        {(() => {
                          const retailerPrices = form.retailers.map((r) => parseFloat(r.price)).filter((p) => p > 0);
                          const isAutoCalc = retailerPrices.length > 0;
                          return (
                            <>
                              {isAutoCalc && (
                                <p className="text-[10px] text-[var(--foreground-muted)] tracking-[0.08em]">
                                  Auto-calculated from {retailerPrices.length} retailer{retailerPrices.length > 1 ? "s" : ""}
                                </p>
                              )}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className={labelCls}>Price Min ($)</label>
                                  <input
                                    type="number"
                                    value={form.priceMin}
                                    onChange={(e) => setForm((f) => ({ ...f, priceMin: e.target.value }))}
                                    placeholder="0"
                                    min="0"
                                    readOnly={isAutoCalc}
                                    className={`${inputCls} ${isAutoCalc ? "opacity-60 cursor-default" : ""}`}
                                  />
                                </div>
                                <div>
                                  <label className={labelCls}>Price Max ($)</label>
                                  <input
                                    type="number"
                                    value={form.priceMax}
                                    onChange={(e) => setForm((f) => ({ ...f, priceMax: e.target.value }))}
                                    placeholder="0"
                                    min="0"
                                    readOnly={isAutoCalc}
                                    className={`${inputCls} ${isAutoCalc ? "opacity-60 cursor-default" : ""}`}
                                  />
                                </div>
                              </div>
                            </>
                          );
                        })()}
                        <div className="flex items-center gap-3">
                          <input type="checkbox" id="isNew" checked={form.isNew} onChange={(e) => setForm((f) => ({ ...f, isNew: e.target.checked }))} className="w-3.5 h-3.5 accent-[var(--foreground)]" />
                          <label htmlFor="isNew" className="text-xs text-[var(--foreground-muted)] tracking-wide cursor-pointer">
                            New arrival <span className="text-[var(--foreground-subtle)]">(badge auto-hides after 7 days)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Details (collapsible) ── */}
                  <div>
                    <SecHead id="details" label="Details" />
                    {!collapsed.has("details") && (
                      <div className="px-4 pb-4 flex flex-col gap-3">
                        <div>
                          <label className={labelCls}>Description</label>
                          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short product description…" rows={3} className={`${inputCls} resize-none`} />
                        </div>
                        <div>
                          <label className={labelCls}>Material</label>
                          <input type="text" value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} placeholder="100% Wool" className={inputCls} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Colors (collapsible) ── */}
                  <div>
                    <SecHead id="colors" label="Colors" hint={form.colorsRaw ? `— ${form.colorsRaw}` : undefined} />
                    {!collapsed.has("colors") && (
                      <div className="px-4 pb-4">
                        <input type="text" value={form.colorsRaw} onChange={(e) => setForm((f) => ({ ...f, colorsRaw: e.target.value }))} placeholder="Black, White, Camel" className={inputCls} />
                      </div>
                    )}
                  </div>

                  {/* ── Color filter groups (collapsible, compact grid) ── */}
                  <div>
                    <SecHead id="color-groups" label="Color filters" hint={form.colorGroupIds.length ? `— ${form.colorGroupIds.length} selected` : undefined} />
                    {!collapsed.has("color-groups") && (
                      <div className="px-4 pb-4">
                        <div className="grid grid-cols-2 gap-1 mt-1">
                          {colorGroups.map((cg) => {
                            const active = form.colorGroupIds.includes(cg.id);
                            return (
                              <button
                                key={cg.id}
                                type="button"
                                onClick={() => setForm((f) => ({
                                  ...f,
                                  colorGroupIds: active ? f.colorGroupIds.filter((id) => id !== cg.id) : [...f.colorGroupIds, cg.id],
                                }))}
                                className={`flex items-center gap-2 px-2.5 py-2 border text-[11px] tracking-[0.06em] uppercase transition-colors text-left ${active ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
                              >
                                <span className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                                  style={{ background: cg.hexCode === "#multicolor" ? "conic-gradient(red,orange,yellow,green,blue,violet,red)" : cg.hexCode }} />
                                {cg.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Style keywords (collapsible) ── */}
                  <div>
                    <SecHead id="style" label="Style keywords" />
                    {!collapsed.has("style") && (
                      <div className="px-4 pb-4">
                        <div className="flex flex-wrap gap-1.5">
                          {STYLE_KEYWORDS.map((kw) => (
                            <button key={kw} type="button" onClick={() => toggleKeyword(kw)}
                              className={`px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase border transition-colors ${form.styleKeywords.includes(kw) ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"}`}
                            >{kw}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Color variants (collapsible) ── */}
                  <div>
                    <SecHead id="variants" label="Color variants" hint={form.linkedProductIds.length ? `— ${form.linkedProductIds.length} linked` : undefined} />
                    {!collapsed.has("variants") && (
                      <div className="px-4 pb-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <input type="color" value={form.variantColorHex} onChange={(e) => setForm((f) => ({ ...f, variantColorHex: e.target.value }))} className="w-8 h-8 border border-[var(--border)] cursor-pointer bg-transparent p-0.5 shrink-0" title="Swatch color for this product" />
                          <input type="text" value={form.variantColorHex} onChange={(e) => setForm((f) => ({ ...f, variantColorHex: e.target.value }))} placeholder="#888888" maxLength={7} className={`${inputCls} font-mono max-w-[110px] py-1.5`} />
                          <span className="text-[10px] text-[var(--foreground-subtle)]">← swatch for this product</span>
                        </div>
                        {form.linkedProductIds.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {form.linkedProductIds.map((lid) => {
                              const lp = products.find((x) => x.id === lid);
                              if (!lp) return null;
                              return (
                                <div key={lid} className="flex items-center gap-2 border border-[var(--border)] px-2 py-1.5">
                                  {lp.imageUrl && <img src={lp.imageUrl} alt={lp.name} className="w-7 h-9 object-cover shrink-0" />}
                                  <div className="w-3 h-3 rounded-full shrink-0 border border-[var(--border)]" style={{ backgroundColor: lp.colorHex ?? "#888888" }} />
                                  <span className="text-xs text-[var(--foreground)] flex-1 truncate">{lp.name}</span>
                                  <span className="text-[10px] text-[var(--foreground-subtle)] shrink-0">{fmtPrice(lp.priceMin)}</span>
                                  <button type="button" onClick={() => setForm((f) => ({ ...f, linkedProductIds: f.linkedProductIds.filter((x) => x !== lid) }))} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors shrink-0 ml-1" aria-label="Remove">
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="relative">
                          <input type="text" value={variantSearch} onChange={(e) => setVariantSearch(e.target.value)} placeholder="Search product to link…" className={`${inputCls} py-1.5`} />
                          {variantSearch.trim().length >= 1 && (() => {
                            const q = variantSearch.toLowerCase();
                            const matches = products.filter((p) => p.id !== (editingProduct?.id ?? "") && !form.linkedProductIds.includes(p.id) && (p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))).slice(0, 6);
                            if (matches.length === 0) return null;
                            return (
                              <div className="absolute z-20 left-0 right-0 top-full border border-[var(--border)] rounded-xl shadow-lg mt-0.5 max-h-48 overflow-y-auto" style={{ background: "var(--background)" }}>
                                {matches.map((mp) => (
                                  <button key={mp.id} type="button" onClick={() => { setForm((f) => ({ ...f, linkedProductIds: [...f.linkedProductIds, mp.id] })); setVariantSearch(""); }} className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[var(--surface)] transition-colors border-b border-[var(--border)] last:border-0">
                                    {mp.imageUrl && <img src={mp.imageUrl} alt={mp.name} className="w-6 h-8 object-cover shrink-0" />}
                                    {mp.colorHex && <span className="w-3 h-3 rounded-full shrink-0 border border-[var(--border)]" style={{ backgroundColor: mp.colorHex }} />}
                                    <span className="text-xs text-[var(--foreground)] flex-1 truncate">{mp.name}</span>
                                    <span className="text-[10px] text-[var(--foreground-muted)] shrink-0">{mp.brand}</span>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        {form.linkedProductIds.length > 0 && (
                          <p className="text-[10px] text-[var(--foreground-subtle)]">This product will be set as the <strong>primary</strong> (catalog representative) for the group.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Retailers (collapsible) ── */}
                  <div>
                    <SecHead id="retailers" label="Where to buy" hint={form.retailers.length ? `— ${form.retailers.length} store${form.retailers.length > 1 ? "s" : ""}` : undefined} />
                    {!collapsed.has("retailers") && (
                      <div className="px-4 pb-4">
                        <RetailerList
                          retailers={form.retailers}
                          storeLibrary={storeLibrary}
                          onChange={(r) => {
                            const prices = r.map((x) => parseFloat(x.price)).filter((x) => x > 0);
                            setForm((f) => ({
                              ...f,
                              retailers: r,
                              priceMin: prices.length > 0 ? String(Math.min(...prices)) : f.priceMin,
                              priceMax: prices.length > 0 ? String(Math.max(...prices)) : f.priceMax,
                            }));
                          }}
                        />
                      </div>
                    )}
                  </div>

                </>
              );
            })()}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-6 py-4 border-t border-[var(--border)] shrink-0">
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-3 text-xs tracking-[0.14em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
              >
                {saving ? "Saving…" : editingProduct ? "Save Changes" : "Add Product"}
              </button>
              <button
                onClick={closeModal}
                className="border border-[var(--border)] rounded-lg px-5 py-3 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Crop Editor Modal ── */}
      {cropProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            className="border border-[var(--border)] rounded-2xl p-6 md:p-8 max-w-xl w-full mx-4 max-h-[95vh] overflow-y-auto"
            style={{ background: "var(--background)" }}
          >
            {/* Заголовок с кнопкой сброса */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">Кадрирование изображения</h2>
              <div className="flex items-center gap-3">
                {cropProduct.cropData && dbConfigured && (
                  <button
                    onClick={() => { handleCropClear(cropProduct); setCropProduct(null); }}
                    className="text-[10px] tracking-[0.1em] uppercase text-red-500 hover:text-red-700 underline transition-colors"
                  >
                    Удалить кадрирование
                  </button>
                )}
                <button
                  onClick={() => setCropProduct(null)}
                  className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {!dbConfigured && (
              <div className="mb-4 border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                Supabase не подключён — кадрирование сохранится только в памяти до перезагрузки.
              </div>
            )}

            <ImageCropEditor
              imageUrl={cropProduct.imageUrl}
              productName={cropProduct.name}
              initialCrop={cropProduct.cropData}
              onSave={handleCropSave}
              onCancel={() => setCropProduct(null)}
              saving={cropSaving}
            />
          </div>
        </div>
      )}

      {/* ── Group Variants Modal ── */}
      {groupModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="border border-[var(--border)] rounded-2xl p-6 md:p-8 max-w-lg w-full mx-4 max-h-[92vh] overflow-y-auto"
            style={{ background: "var(--background)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                  {groupModal.existingGroupId ? "Edit variant group" : "Group as color variants"}
                </h2>
                <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                  Set a swatch color for each product and choose which is the catalog representative.
                </p>
              </div>
              <button
                onClick={() => setGroupModal({ open: false, entries: [] })}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {groupModal.entries.map((entry) => {
                const p = products.find((x) => x.id === entry.id);
                if (!p) return null;
                return (
                  <div
                    key={entry.id}
                    className={`border rounded-xl p-3 flex items-center gap-3 transition-colors ${
                      entry.isPrimary ? "border-[var(--foreground)]" : "border-[var(--border)]"
                    }`}
                  >
                    {/* Thumb */}
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="w-10 h-[52px] object-cover shrink-0" />
                    )}

                    {/* Name + swatch */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--foreground)] truncate">{p.name}</p>
                      <p className="text-[10px] text-[var(--foreground-muted)] truncate">{p.brand} · {fmtPrice(p.priceMin)}</p>

                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="color"
                          value={entry.colorHex}
                          onChange={(e) =>
                            setGroupModal((prev) => ({
                              ...prev,
                              entries: prev.entries.map((en) =>
                                en.id === entry.id ? { ...en, colorHex: e.target.value } : en
                              ),
                            }))
                          }
                          className="w-7 h-7 border border-[var(--border)] cursor-pointer bg-transparent p-0.5 shrink-0"
                          title="Swatch color"
                        />
                        <input
                          type="text"
                          value={entry.colorHex}
                          onChange={(e) =>
                            setGroupModal((prev) => ({
                              ...prev,
                              entries: prev.entries.map((en) =>
                                en.id === entry.id ? { ...en, colorHex: e.target.value } : en
                              ),
                            }))
                          }
                          maxLength={7}
                          placeholder="#888888"
                          className={`${inputCls} font-mono max-w-[100px] py-1`}
                        />
                      </div>
                    </div>

                    {/* Primary toggle */}
                    <div className="shrink-0 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setGroupModal((prev) => ({
                            ...prev,
                            entries: prev.entries.map((en) => ({
                              ...en,
                              isPrimary: en.id === entry.id,
                            })),
                          }))
                        }
                        className={`text-[9px] tracking-[0.14em] uppercase px-2 py-1 border rounded-md transition-colors ${
                          entry.isPrimary
                            ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                            : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        {entry.isPrimary ? "Primary" : "Set primary"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-[var(--foreground-subtle)] mt-4">
              The <strong>primary</strong> product is shown in the catalog. Others are accessible via the colour palette on the card.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleGroupSave}
                disabled={grouping || !dbConfigured}
                className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-3 text-xs tracking-[0.14em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
              >
                {grouping ? "Saving…" : groupModal.existingGroupId ? "Update group" : "Create group"}
              </button>
              <button
                onClick={() => setGroupModal({ open: false, entries: [] })}
                className="border border-[var(--border)] rounded-lg px-5 py-3 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="border border-[var(--border)] rounded-2xl p-8 max-w-2xl w-full mx-4 max-h-[92vh] overflow-y-auto"
            style={{ background: "var(--background)" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">Import Products</h2>
              <button
                onClick={() => { setShowImport(false); setImportText(""); setImportPreview([]); setImportError(""); }}
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex border-b border-[var(--border)] mb-5">
              {(["csv", "json"] as ImportTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setImportTab(tab); setImportPreview([]); setImportError(""); }}
                  className={`px-4 py-2 text-xs tracking-[0.12em] uppercase border-b-2 transition-colors ${
                    importTab === tab
                      ? "border-[var(--foreground)] text-[var(--foreground)]"
                      : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            {importTab === "csv" && (
              <div className="mb-4">
                <p className="text-xs text-[var(--foreground-muted)] mb-3">
                  Columns: <code className="font-mono text-[10px]">name, brand, category, priceMin, priceMax, imageUrl, isNew, colors (|), sizes (|), description, material, styleKeywords (|)</code>
                </p>
                <div className="mb-3">
                  <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
                  >
                    Upload CSV file
                  </button>
                </div>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportPreview([]); }}
                  placeholder={"name,brand,category,priceMin,priceMax,imageUrl,isNew\nCool Jacket,Zara,outerwear,79,99,https://...,true"}
                  rows={8}
                  className={`${inputCls} font-mono text-xs resize-none`}
                />
              </div>
            )}

            {importTab === "json" && (
              <div className="mb-4">
                <p className="text-xs text-[var(--foreground-muted)] mb-3">Paste a JSON array of product objects.</p>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportPreview([]); }}
                  placeholder={'[\n  { "name": "Cool Jacket", "brand": "Zara", "category": "outerwear", "priceMin": 79, "priceMax": 99 }\n]'}
                  rows={10}
                  className={`${inputCls} font-mono text-xs resize-none`}
                />
              </div>
            )}

            {importError && <p className="text-xs text-red-500 mb-3">{importError}</p>}

            {importPreview.length > 0 && (
              <div className="mb-4 border border-[var(--border)] rounded-xl max-h-44 overflow-y-auto">
                <p className="px-3 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--foreground-muted)] border-b border-[var(--border)]">
                  {importPreview.length} products to import
                </p>
                {importPreview.map((p, i) => (
                  <div key={i} className="px-3 py-2 text-xs text-[var(--foreground)] border-b border-[var(--border)] last:border-b-0 flex items-center justify-between gap-4">
                    <span className="font-medium truncate">{p.name || "—"}</span>
                    <span className="text-[var(--foreground-muted)] shrink-0">{p.brand} · {p.category} · {fmtPrice(p.priceMin ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={parseImport}
                className="border border-[var(--border)] rounded-lg px-4 py-2.5 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
              >
                Preview
              </button>
              <button
                onClick={handleImport}
                disabled={!importPreview.length || importing}
                className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-2.5 text-xs tracking-[0.14em] uppercase transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg"
              >
                {importing ? "Importing…" : `Import ${importPreview.length ? importPreview.length + " " : ""}Products`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Migration Required Modal ── */}
      {showMigrationModal && (
        <MigrationModal
          onClose={() => setShowMigrationModal(false)}
          onMigrated={() => { setShowMigrationModal(false); showToast("Migration applied! Try grouping again."); fetchProducts(); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-5 py-3 text-sm border rounded-xl ${
            toast.type === "ok"
              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
              : "border-red-400 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
