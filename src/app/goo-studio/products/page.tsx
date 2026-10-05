"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import type { ColorGroup, Product, Category, StyleKeyword, Retailer, Gender, CropData } from "@/lib/types";
import { STYLE_KEYWORD_LIST as STYLE_KEYWORDS, styleLabel } from "@/lib/style-keywords";
import { subcategoryToValue, groupForProduct, resolveSubcategory, type CategoryGroup } from "@/lib/categories";
import { useCategoryTree } from "@/lib/hooks/useCategoryTree";
import { ImageCropEditor } from "@/components/admin/ImageCropEditor";
import { useDownloadCards } from "@/components/admin/DownloadCardsButton";
import { DataTable, EmptyState, Thumb, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/admin/Badge";
import { PageHeader, PLUS } from "@/components/admin/PageHeader";
import { ActiveFilters, FilterBar, FilterChips, FilterMenu, SearchField, type ActiveFilter } from "@/components/admin/FilterBar";
import { BulkBar } from "@/components/admin/BulkBar";
import { RowMenu, type MenuItem } from "@/components/admin/Menu";
import { CURRENCIES, useCurrency } from "@/lib/context/currency-context";
import { storeFaviconUrl } from "@/lib/stores";
import { bareHost, pastedUrl } from "@/lib/url";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { btn, BTN_ICON, BTN_ICON_SM, FIELD_LABEL, INPUT, SELECT } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT, type Key } from "@/app/goo-studio/_i18n";
import { Modal } from "@/components/admin/Modal";

// Sort options shown in the admin toolbar dropdown. Each maps to a (key, direction) pair
// that drives the same sortKey/sortDir state used by the clickable column headers.
type SortColumn = "name" | "brand" | "category" | "priceMin" | "createdAt";
const SORT_OPTIONS: { value: string; label: Key }[] = [
  { value: "createdAt:desc", label: "products.sort.newest" },
  { value: "createdAt:asc", label: "products.sort.oldest" },
  { value: "name:asc", label: "products.sort.nameAsc" },
  { value: "name:desc", label: "products.sort.nameDesc" },
  { value: "brand:asc", label: "products.sort.brandAsc" },
  { value: "priceMin:asc", label: "products.sort.priceAsc" },
  { value: "priceMin:desc", label: "products.sort.priceDesc" },
];

/** A column's name, for a sort set from a header that has no named preset. */
const SORT_COLUMN_LABEL: Record<SortColumn, Key> = {
  name: "products.col.product",
  brand: "products.f.brand",
  category: "products.col.category",
  priceMin: "products.col.price",
  createdAt: "products.col.added",
};

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
const SIZE_PRESETS: Record<string, { sizes: string[] }> = {
  tops:        { sizes: ["XXS","XS","S","M","L","XL","XXL","XXXL"] },
  shirts:      { sizes: ["XXS","XS","S","M","L","XL","XXL"] },
  knitwear:    { sizes: ["XS","S","M","L","XL","XXL"] },
  bottoms:     { sizes: ["XS","S","M","L","XL","XXL"] },
  jeans:       { sizes: ["24","25","26","27","28","29","30","31","32","33","34","36","38"] },
  shorts:      { sizes: ["XS","S","M","L","XL","XXL"] },
  skirts:      { sizes: ["XS","S","M","L","XL"] },
  outerwear:   { sizes: ["XS","S","M","L","XL","XXL"] },
  blazers:     { sizes: ["XS","S","M","L","XL","XXL"] },
  dresses:     { sizes: ["XS","S","M","L","XL","XXL"] },
  jumpsuits:   { sizes: ["XS","S","M","L","XL","XXL"] },
  footwear:    { sizes: ["35","36","37","38","39","40","41","42","43","44","45","46"] },
  accessories: { sizes: ["One Size","XS/S","S/M","M/L","L/XL"] },
  bags:        { sizes: ["One Size"] },
  swimwear:    { sizes: ["XS","S","M","L","XL"] },
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
const MISSING_FILTERS: { value: string; label: Key; test: (p: Product) => boolean }[] = [
  { value: "subcategory", label: "products.missing.subcategory", test: (p) => !p.subcategory },
  { value: "colorGroups", label: "products.missing.colorGroups", test: (p) => !p.colorGroupIds?.length },
  { value: "colors", label: "products.missing.colors", test: (p) => !p.colors?.length },
  { value: "style", label: "products.missing.style", test: (p) => !p.styleKeywords?.length },
  { value: "gender", label: "products.missing.gender", test: (p) => !p.gender },
  { value: "description", label: "products.missing.description", test: (p) => !p.description?.trim() },
  { value: "sizes", label: "products.missing.sizes", test: (p) => !p.sizes?.length },
  { value: "image", label: "products.missing.image", test: (p) => !p.imageUrl?.trim() },
];

const GENDERS: { value: string; label: Key }[] = [
  { value: "women", label: "products.gender.women" },
  { value: "men", label: "products.gender.men" },
  { value: "unisex", label: "products.gender.unisex" },
];


const AVAILABILITY_OPTIONS = ["in stock", "low stock", "sold out"] as const;

/** What each stored availability reads as; the value saved stays the English one. */
const AVAILABILITY_LABEL: Record<(typeof AVAILABILITY_OPTIONS)[number], Key> = {
  "in stock": "products.availability.inStock",
  "low stock": "products.availability.lowStock",
  "sold out": "products.availability.soldOut",
};

/**
 * Example values shown as placeholders. They are not in the dictionary: they
 * show the shape of the catalog's own data (a URL, size codes, colors and
 * materials as the storefront prints them), which is English whatever
 * language the admin is in.
 */
const EXAMPLE = {
  url: "https://…",
  storeUrl: "https://zara.com/product/…",
  sizes: "XS, S, M, L, XL",
  material: "100% Wool",
  colors: "Black, White, Camel",
};

/** How long the "New" badge shows after a product is added (see db.ts isWithinLastWeek). */
const NEW_ARRIVAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
  /**
   * What `price` is in — the store's own currency. An imported hryvnia store
   * arrives as "4000" + "UAH", and the catalogue price above is that converted
   * to dollars; reading "4000" as dollars is the bug this field exists to stop.
   */
  currency: string;
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

// The shared field recipes (_ui/recipes.ts), full width by default.
const inputCls = `${INPUT} w-full`;
// Width is not part of the base: a select that sets its own (the store's
// currency) would otherwise carry both w-full and its width, and w-full won —
// the currency took the row and squeezed the store price to a few pixels.
const selectBaseCls = SELECT;
const selectCls = `${selectBaseCls} w-full`;
const labelCls = FIELD_LABEL;

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveColors(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * A dictionary message with inline marks: `<b>…</b>` becomes <strong>, and a
 * `{name}` left unfilled becomes `code[name]` in code type. Messages are plain
 * strings, so the few sentences that stress a word or name a setting carry the
 * mark in the text, and each language puts it where its own word order needs.
 */
function rich(text: string, code: Record<string, string> = {}): ReactNode[] {
  return text.split(/(<b>.*?<\/b>|\{\w+\})/).map((part, i) => {
    if (part.startsWith("<b>")) return <strong key={i}>{part.slice(3, -4)}</strong>;
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    if (name && name in code) return <code key={i} className="font-mono">{code[name]}</code>;
    return part;
  });
}

/** A confirm body that keeps the line breaks it was written with. */
// ── Sub-components ─────────────────────────────────────────────────────────────

function ImageList({
  images,
  onChange,
}: {
  images: string[];
  /**
   * Takes an updater rather than a new array: an upload finishes up to 30 s
   * after it started, and must apply to the list as it is by then.
   */
  onChange: (update: (imgs: string[]) => string[]) => void;
}) {
  const t = useT();
  /** The URL being copied to storage; its row shows a spinner meanwhile. */
  const [uploading, setUploading] = useState<string | null>(null);
  /**
   * Why a row's photo is still on someone else's CDN, keyed by the URL that
   * failed — so the note goes away as soon as the URL is changed.
   */
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  /** URLs the server has already confirmed are in our storage. */
  const stored = useRef<Set<string>>(new Set());

  const addRow = () => onChange((imgs) => [...imgs, ""]);
  const removeRow = (i: number) => onChange((imgs) => imgs.filter((_, idx) => idx !== i));
  const setVal = (i: number, v: string) =>
    onChange((imgs) => imgs.map((img, idx) => (idx === i ? v : img)));

  // Whether a URL is already ours is the server's call (it knows the storage
  // origin); a substring check here missed the self-hosted domain and
  // re-uploaded our own files on every blur.
  const handleBlur = async (i: number, url: string) => {
    if (!url || !url.startsWith("http") || stored.current.has(url)) return;
    setUploading(url);
    try {
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || t("products.image.uploadFailedHttp", { status: String(res.status) }));
      }
      stored.current.add(data.url);
      setUploadErrors((e) => {
        const next = { ...e };
        delete next[url];
        return next;
      });
      // Swap by value, not by the index the upload started at: rows may have
      // been removed or edited while it ran. A URL no longer in the list was
      // removed or retyped, so the stored copy is simply not applied.
      if (data.url !== url) {
        onChange((imgs) => {
          const at = imgs[i] === url ? i : imgs.indexOf(url);
          return at === -1 ? imgs : imgs.map((img, idx) => (idx === at ? data.url : img));
        });
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : t("products.image.uploadFailed");
      setUploadErrors((prev) => ({ ...prev, [url]: reason }));
    } finally {
      setUploading((u) => (u === url ? null : u));
    }
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
                placeholder={EXAMPLE.url}
                className={`${inputCls} ${uploading === url ? "opacity-50" : ""}`}
                disabled={uploading === url}
              />
              {uploading === url && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2">
                  <span className="w-3.5 h-3.5 border border-[var(--foreground)] border-t-transparent rounded-full animate-spin inline-block" />
                </span>
              )}
            </div>
            {url && uploadErrors[url] && uploading !== url && (
              <p className="text-[12px] leading-snug text-[var(--err)]">
                {t("products.image.notCopied", { error: uploadErrors[url] })}
              </p>
            )}
            {url && uploading !== url && (
              <div className="relative w-12 h-16 border border-[var(--border)] rounded-lg overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={t("products.image.previewAlt")}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                />
              </div>
            )}
          </div>
          {i === 0 && (
            <span className="text-[11px] font-medium text-[var(--foreground-subtle)] mt-2.5 shrink-0">{t("products.image.main")}</span>
          )}
          {images.length > 1 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label={t("products.image.remove")}
              className={`${BTN_ICON} md:mt-0.5`}
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
        className={`${btn("ghost")} self-start mt-1`}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {t("products.image.add")}
      </button>
    </div>
  );
}


function RetailerList({
  retailers,
  onChange,
  storeLibrary = [],
  storeRules = [],
}: {
  retailers: RetailerForm[];
  onChange: (r: RetailerForm[]) => void;
  /** Stores (name + logo) from the admin library, used to pick a real store. */
  storeLibrary?: { name: string; logoUrl: string | null }[];
  /** The Retailers page's rules, domain → store name, for naming a pasted link's store. */
  storeRules?: { domain: string; name: string }[];
}) {
  const t = useT();
  const add = () =>
    onChange([...retailers, { name: "", url: "", price: "", currency: "USD", availability: "in stock", isOfficial: false, rating: "", reviewCount: "" }]);
  const remove = (i: number) => onChange(retailers.filter((_, idx) => idx !== i));
  const set = (i: number, patch: Partial<RetailerForm>) =>
    onChange(retailers.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Resolve a typed store name to its library logo (case-insensitive), so the
  // admin sees which logo will appear on the storefront.
  const logoFor = (name: string): string | null =>
    storeLibrary.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())?.logoUrl ?? null;

  // A pasted link as the storefront's "Buy" button needs it: the address out
  // of share text, a scheme when the address bar left it off, an ad click's
  // tracking gone (`pastedUrl`). An empty store name is taken from the
  // domain's rule, as an import would name it.
  const tidyUrl = (i: number) => {
    const r = retailers[i];
    const url = pastedUrl(r.url);
    if (!url) return;
    const host = bareHost(url);
    const rule = r.name.trim() ? undefined : storeRules.find((x) => host === x.domain || host.endsWith(`.${x.domain}`));
    if (url !== r.url || rule) set(i, { url, ...(rule ? { name: rule.name } : {}) });
  };

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
          {/* The wrapper is what sits in the corner: an `.absolute` button
              itself is left out of the phone's 40px touch target (globals.css). */}
          <div className="absolute top-0 right-0 md:top-1 md:right-1">
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t("products.store.remove")}
              title={t("products.store.remove")}
              className={BTN_ICON}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-8">
            <div>
              <label className={labelCls}>{t("products.store.name")}</label>
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden flex items-center justify-center">
                  {logoFor(r.name) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoFor(r.name)!} alt={r.name} className="w-full h-full object-contain p-1" />
                  ) : (
                    <span className="text-[11px] font-semibold text-[var(--foreground-subtle)]">
                      {r.name.trim() ? r.name.slice(0, 2).toUpperCase() : "—"}
                    </span>
                  )}
                </span>
                <input
                  type="text"
                  list="retailer-store-library"
                  value={r.name}
                  onChange={(e) => set(i, { name: e.target.value })}
                  placeholder={t("products.store.namePlaceholder")}
                  className={`${inputCls} flex-1`}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("products.col.price")}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={r.price}
                  onChange={(e) => set(i, { price: e.target.value })}
                  placeholder="99"
                  min="0"
                  className={`${inputCls} flex-1 min-w-0`}
                />
                <select
                  value={r.currency}
                  onChange={(e) => set(i, { currency: e.target.value })}
                  aria-label={t("products.store.currency")}
                  className={`${selectBaseCls} w-[84px] shrink-0`}
                >
                  {/* An imported store may price in a currency the switcher does
                      not offer (złoty, say); it stays selectable rather than
                      being silently replaced by the first option. */}
                  {(CURRENCIES.some((c) => c.code === r.currency)
                    ? CURRENCIES.map((c) => c.code as string)
                    : [r.currency, ...CURRENCIES.map((c) => c.code as string)]
                  ).map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls}>{t("products.store.url")}</label>
            <input
              type="url"
              value={r.url}
              onChange={(e) => set(i, { url: e.target.value })}
              onBlur={() => tidyUrl(i)}
              placeholder={EXAMPLE.storeUrl}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>{t("products.store.availability")}</label>
              <select
                value={r.availability}
                onChange={(e) => set(i, { availability: e.target.value as RetailerForm["availability"] })}
                className={selectCls}
              >
                {AVAILABILITY_OPTIONS.map((a) => (
                  <option key={a} value={a}>{t(AVAILABILITY_LABEL[a])}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>{t("products.store.rating")} <span className="font-normal">1–5</span></label>
                <input type="number" value={r.rating} onChange={(e) => set(i, { rating: e.target.value })} placeholder="4.5" min="1" max="5" step="0.1" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("products.store.reviews")}</label>
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
              {t("products.store.official")}
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className={`${btn("ghost")} self-start`}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        {t("products.store.add")}
      </button>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M2 4.5L6 7.5L10 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** A collapsible section header in the product form. */
function SecHead({ label, hint, open, onToggle }: { label: string; hint?: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--background)] transition-colors text-left"
    >
      <span className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-[var(--foreground)]">{label}</span>
        {hint && <span className="text-[12px] text-[var(--foreground-subtle)]">{hint}</span>}
      </span>
      <span className="text-[var(--foreground-subtle)]"><Chevron open={open} /></span>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  // The tree the Categories page edits — the chips below are whatever it says.
  const categoryGroups = useCategoryTree();
  const { convertToUsd, canConvert } = useCurrency();
  /**
   * A store's price on the catalogue's scale. `price_min` is read as dollars by
   * the browse filter, the stylist's budget and the search RPCs, so a retailer
   * row in hryvnia has to be converted before it becomes the product's price.
   * NaN for a price that is missing or in a currency with no known rate: better
   * left out of the range than counted as dollars.
   */
  const retailerUsd = (r: RetailerForm): number => {
    const amount = parseFloat(r.price);
    const code = (r.currency || "USD").toUpperCase();
    if (!(amount > 0) || !canConvert(code)) return NaN;
    return Math.round(convertToUsd(amount, code) * 100) / 100;
  };
  const subcatToValue = useMemo(() => subcategoryToValue(categoryGroups), [categoryGroups]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  // Why the last catalogue load failed, or null. Kept until a load succeeds,
  // so a failure does not pass for an empty catalogue once the toast is gone.
  const [loadError, setLoadError] = useState<string | null>(null);
  /**
   * Whether the database is there to write to. Checked once on load: without
   * it the page says so once and every action that writes is disabled — there
   * is no in-memory mode pretending to save. `null` while the check runs.
   */
  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const canWrite = dbConfigured === true;
  const [colorGroups, setColorGroups] = useState<ColorGroup[]>(DEFAULT_COLOR_GROUPS);
  // Brands fetched from /api/brands — starts with the static list as a fallback so the
  // datalist is never empty while the request is in flight.
  const [suggestedBrands, setSuggestedBrands] = useState<string[]>(SUGGESTED_BRANDS);
  // Store library (name + logo) from /api/brands and the Retailers rules, used by
  // the retailer editor so each "Where to buy" listing is a real store with its
  // logo, not free text.
  const [storeLibrary, setStoreLibrary] = useState<{ name: string; logoUrl: string | null }[]>([]);
  const [storeRules, setStoreRules] = useState<{ domain: string; name: string }[]>([]);
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
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });

  const [recategorizing, setRecategorizing] = useState(false);
  const [restyling, setRestyling] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const confirm = useConfirm();
  const toast = useToast();
  const t = useT();
  const f = useFormat();

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
    if (!cropProduct || !canWrite) return;
    setCropSaving(true);
    try {
      const res = await fetch(`/api/products/${cropProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropData }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.err(json.error ? t("crop.saveFailedWith", { error: json.error }) : t("crop.saveFailed"));
        return;
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === cropProduct.id ? { ...p, cropData } : p))
      );
      toast.ok(t("crop.saved"));
      setCropProduct(null);
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("crop.saveFailed"));
    } finally {
      setCropSaving(false);
    }
  };

  const handleCropClear = async (product: Product) => {
    if (!canWrite) return;
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropData: null }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.err(json.error ? t("crop.clearFailedWith", { error: json.error }) : t("crop.clearFailed"));
        return;
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, cropData: undefined } : p))
      );
      toast.ok(t("crop.cleared"));
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("crop.clearFailed"));
    }
  };

  // ── Group variants modal ───────────────────────────────────────────────────
  const [groupModal, setGroupModal] = useState<GroupModalState>({ open: false, entries: [] });
  const [grouping, setGrouping] = useState(false);
  const [variantSearch, setVariantSearch] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // raw=true returns all products including non-primary variants
      const res = await fetch("/api/products?raw=true");
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        throw new Error((data && typeof data === "object" && "error" in data && String(data.error)) || t("products.load.failedHttp", { status: String(res.status) }));
      }
      setProducts(data);
      setLoadError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : t("products.load.failed");
      setLoadError(message);
      toast.err(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Whether there is a database to write to — asked once, not on every
    // refetch (GET is read-only).
    fetch("/api/products/seed")
      .then((r) => setDbConfigured(r.status !== 501))
      .catch(() => toast.err(t("products.db.checkFailed")));
    fetchProducts();
    fetch("/api/color-groups")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setColorGroups(d); })
      .catch(() => {});
    // The store library behind the retailer editor's "Store" field: brands
    // (with their uploaded logos), plus the store names set on the Retailers
    // page, which are the names imports write (Farfetch, SSENSE…). A store
    // with no brand entry shows its site's favicon.
    Promise.all([
      fetch("/api/brands").then((r) => r.json()).catch(() => null),
      fetch("/api/admin/retailer-domains?rulesOnly=1").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([brands, retailerDomains]) => {
      const library = new Map<string, { name: string; logoUrl: string | null }>();
      if (Array.isArray(brands) && brands.length > 0) {
        setSuggestedBrands(brands.map((b: { name: string }) => b.name).sort());
        for (const b of brands as { name: string; logoUrl?: string | null }[]) {
          library.set(b.name.trim().toLowerCase(), { name: b.name, logoUrl: b.logoUrl ?? null });
        }
      }
      const rules = (retailerDomains?.rules ?? []) as { domain: string; name: string }[];
      setStoreRules(
        rules
          .filter((r) => r.domain && r.name?.trim())
          .map((r) => ({ domain: r.domain.trim().toLowerCase().replace(/^www\./, ""), name: r.name.trim() })),
      );
      for (const r of rules) {
        const key = r.name?.trim().toLowerCase();
        if (!key) continue;
        const known = library.get(key);
        if (!known) library.set(key, { name: r.name.trim(), logoUrl: storeFaviconUrl(r.domain) });
        else if (!known.logoUrl) library.set(key, { ...known, logoUrl: storeFaviconUrl(r.domain) });
      }
      setStoreLibrary([...library.values()].sort((a, b) => a.name.localeCompare(b.name)));
    });
    // Mount-only load; fetchProducts is re-created each render and reads no props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } else {
        const json = await res.json().catch(() => ({}));
        toast.err(json.error || t("products.brand.addFailedHttp", { status: String(res.status) }));
      }
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.brand.addFailed"));
    } finally {
      setAddingBrand(false);
    }
    // The name stays on the product either way; only the brand list missed it.
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
  }, [products, searchQuery, filterGroup, filterSubcategory, filterBrand, filterColorGroup, filterStyle, filterGender, filterMissing, filterNew, sortKey, sortDir, categoryGroups, subcatToValue]);

  // The Audit page links a suspect straight here by name, so the list opens
  // already narrowed to the piece being fixed.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search).get("search");
    if (search) setSearchQuery(search);
  }, []);

  /** Brands actually present in the catalogue, so the list can't offer a dead end. */
  const brandsInCatalogue = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  /**
   * What "Download cards" will draw: the selection when there is one, and
   * otherwise whatever the filters have narrowed the table to — the same
   * selection-or-the-rest rule the backdrop button follows.
   *
   * A list that is the entire catalogue goes as `null` instead, so exporting
   * everything stays a short request rather than a POST carrying ten thousand
   * ids the server is about to read out of its own table anyway.
   */
  const exportIds = useMemo(() => {
    if (selectedIds.size) return filtered.filter((p) => selectedIds.has(p.id)).map((p) => p.id);
    if (filtered.length === products.length) return null;
    return filtered.map((p) => p.id);
  }, [filtered, products, selectedIds]);

  const cards = useDownloadCards("products");

  /** Added in the last 30 days, for the header line. */
  const addedRecently = useMemo(() => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return products.filter((p) => p.createdAt && Date.parse(p.createdAt) >= since).length;
  }, [products]);

  /**
   * Category and subcategory are one filter with two levels, as in the
   * catalog: "g:<group>" or "s:<group>:<subcategory>".
   */
  const categoryValue = filterSubcategory
    ? `s:${filterGroup}:${filterSubcategory}`
    : filterGroup
      ? `g:${filterGroup}`
      : "";
  const categoryOptions = useMemo(
    () =>
      categoryGroups.flatMap((g) => [
        { value: `g:${g.id}`, label: g.label },
        ...g.items.map((item) => ({ value: `s:${g.id}:${item.label}`, label: item.label, nested: true })),
      ]),
    [categoryGroups],
  );
  const setCategoryValue = (v: string) => {
    if (!v) {
      setFilterGroup("");
      setFilterSubcategory("");
    } else if (v.startsWith("g:")) {
      setFilterGroup(v.slice(2));
      setFilterSubcategory("");
    } else {
      const [, group, ...sub] = v.split(":");
      setFilterGroup(group);
      setFilterSubcategory(sub.join(":"));
    }
  };

  const clearFilters = () => {
    setFilterGroup(""); setFilterSubcategory("");
    setFilterBrand(""); setFilterColorGroup(""); setFilterStyle(""); setFilterGender("");
    setFilterMissing(""); setFilterNew(null);
  };

  /** What narrows the list right now, as chips that each remove themselves. */
  const activeFilters: ActiveFilter[] = [
    ...(categoryValue
      ? [{ key: "category", label: `${t("products.f.category")}: ${categoryOptions.find((o) => o.value === categoryValue)?.label ?? filterSubcategory}`, onRemove: () => setCategoryValue("") }]
      : []),
    ...(filterBrand ? [{ key: "brand", label: `${t("products.f.brand")}: ${filterBrand}`, onRemove: () => setFilterBrand("") }] : []),
    ...(filterColorGroup
      ? [{ key: "color", label: `${t("products.f.color")}: ${colorGroups.find((g) => String(g.id) === filterColorGroup)?.name ?? filterColorGroup}`, onRemove: () => setFilterColorGroup("") }]
      : []),
    ...(filterStyle ? [{ key: "style", label: `${t("products.f.style")}: ${styleLabel(filterStyle as StyleKeyword)}`, onRemove: () => setFilterStyle("") }] : []),
    ...(filterGender
      ? [{ key: "gender", label: `${t("products.f.gender")}: ${t(GENDERS.find((g) => g.value === filterGender)?.label ?? "products.gender.unisex")}`, onRemove: () => setFilterGender("") }]
      : []),
    ...(filterNew ? [{ key: "status", label: `${t("products.f.status")}: ${t("products.badge.new")}`, onRemove: () => setFilterNew(null) }] : []),
    ...(filterMissing
      ? [{ key: "missing", label: `${t("products.f.missing")}: ${t(MISSING_FILTERS.find((m) => m.value === filterMissing)?.label ?? "products.missing.image")}`, onRemove: () => setFilterMissing("") }]
      : []),
  ];

  /** Back to the first page whenever the list itself changes. */
  const tableResetKey = [searchQuery, categoryValue, filterBrand, filterColorGroup, filterStyle, filterGender, filterMissing, String(filterNew), sortKey, sortDir].join("|");

  // ── Modal ──────────────────────────────────────────────────────────────────

  /**
   * The catalogue price from the store prices, when there are any. The price
   * fields are read-only then, so the form has to show — and save — the range
   * the stores give now, not whatever the row stored last time.
   */
  const withRetailerPrices = (f: ProductFormState): ProductFormState => {
    const prices = f.retailers.map(retailerUsd).filter((x) => x > 0);
    if (!prices.length) return f;
    return { ...f, priceMin: String(Math.min(...prices)), priceMax: String(Math.max(...prices)) };
  };

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
    setForm(withRetailerPrices({
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
        currency: (r.currency || "USD").toUpperCase(),
        availability: r.availability,
        isOfficial: r.isOfficial,
        rating: r.rating != null ? String(r.rating) : "",
        reviewCount: r.reviewCount != null ? String(r.reviewCount) : "",
      })),
      isNew: product.isNew,
      variantColorHex: product.colorHex ?? "#888888",
      linkedProductIds: linkedIds,
      colorGroupIds: product.colorGroupIds ?? [],
    }));
    setVariantSearch("");
    setShowModal(true);
  };

  const openDuplicateModal = (product: Product) => {
    setEditingProduct(null);
    setIsDuplicating(true);
    setForm(withRetailerPrices({
      // Not from the dictionary: the suffix is saved as part of the name, and
      // catalog names are English whatever language the admin is in.
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
        currency: (r.currency || "USD").toUpperCase(),
        availability: r.availability,
        isOfficial: r.isOfficial,
        rating: r.rating != null ? String(r.rating) : "",
        reviewCount: r.reviewCount != null ? String(r.reviewCount) : "",
      })),
      isNew: product.isNew,
      variantColorHex: product.colorHex ?? "#888888",
      linkedProductIds: [],
      colorGroupIds: product.colorGroupIds ?? [],
    }));
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

  /**
   * Brings the variant group in line with the form's "Color variants" list.
   *
   * Only what changed is written. An edit that leaves the list and the swatch
   * alone does not touch the group: re-posting it made whichever variant was
   * saved the group's primary, silently swapping the product the catalogue
   * shows. The group keeps its primary either way — choosing another is the
   * Group variants dialog's job. A product taken out of the list is unlinked.
   */
  const syncVariants = async (savedId: string): Promise<{ changed: boolean; error: string | null }> => {
    const ownGroup = editingProduct?.variantGroupId;
    const before = ownGroup
      ? products.filter((p) => p.variantGroupId === ownGroup && p.id !== savedId).map((p) => p.id)
      : [];
    const after = form.linkedProductIds;
    const removed = before.filter((id) => !after.includes(id));
    const added = after.filter((id) => !before.includes(id));
    const hexChanged = !!ownGroup && (editingProduct?.colorHex ?? "#888888") !== form.variantColorHex;

    const call = async (method: "POST" | "DELETE", body: unknown): Promise<string | null> => {
      const res = await fetch("/api/products/group", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return null;
      const err = await res.json().catch(() => ({}));
      return (err.error as string) || t("products.save.variantsFailedHttp", { status: String(res.status) });
    };

    // Everyone else left the list: a group of one is no group.
    if (!after.length) {
      if (!ownGroup || !before.length) return { changed: false, error: null };
      return { changed: true, error: await call("DELETE", { groupId: ownGroup }) };
    }
    if (ownGroup && !added.length && !removed.length && !hexChanged) return { changed: false, error: null };

    if (removed.length) {
      const error = await call("DELETE", { ids: removed });
      if (error) return { changed: true, error };
    }

    // Into this product's own group, else the one its new variants already
    // share, else a new one.
    const linkedGroups = new Set(
      after.map((id) => products.find((x) => x.id === id)?.variantGroupId).filter(Boolean)
    );
    const groupId = ownGroup ?? (linkedGroups.size === 1 ? ([...linkedGroups][0] as string) : undefined);
    // A primaryId outside `ids` leaves the group's primary untouched.
    const currentPrimary = groupId
      ? products.find((p) => p.variantGroupId === groupId && p.isGroupPrimary && !removed.includes(p.id))?.id
      : undefined;
    const colorHexMap: Record<string, string> = { [savedId]: form.variantColorHex };
    after.forEach((id) => {
      colorHexMap[id] = products.find((x) => x.id === id)?.colorHex ?? "#888888";
    });
    const error = await call("POST", {
      ids: [savedId, ...after],
      primaryId: currentPrimary ?? savedId,
      colorHexMap,
      groupId,
    });
    return { changed: true, error };
  };

  const handleSave = async () => {
    if (!form.name.trim() || !canWrite) return;
    setSaving(true);

    try {
      const f = withRetailerPrices(form);
      const validImages = f.images.filter((u) => u.trim());
      const colors = deriveColors(f.colorsRaw);

      // NOTE: colorHex, variantGroupId, isGroupPrimary are NOT sent here.
      // They are set exclusively via /api/products/group after the product is saved.
      const payload: Partial<Product> = {
        name: f.name.trim(),
        brand: f.brand as Product["brand"],
        category: f.category,
        // Always sent, so clearing it in the form clears it on the row too.
        subcategory: f.subcategory,
        gender: f.gender ? (f.gender as Gender) : undefined,
        description: f.description.trim(),
        priceMin: parseFloat(f.priceMin) || 0,
        priceMax: parseFloat(f.priceMax) || parseFloat(f.priceMin) || 0,
        // No stand-in photo: a product saved without one stays without one, so
        // the "No image" filter finds it instead of the storefront showing a
        // stock picture of somebody else's jacket.
        imageUrl: validImages[0] ?? "",
        images: validImages,
        colors,
        sizes: f.sizes.split(",").map((s) => s.trim()).filter(Boolean),
        material: f.material.trim(),
        styleKeywords: f.styleKeywords,
        retailers: f.retailers.map((r) => ({
          name: r.name,
          url: r.url,
          price: parseFloat(r.price) || 0,
          // The store's own currency, kept. Forcing "USD" here relabelled every
          // imported hryvnia price as dollars the first time a product was saved.
          currency: r.currency || "USD",
          availability: r.availability,
          isOfficial: r.isOfficial,
          rating: r.rating ? parseFloat(r.rating) : undefined,
          reviewCount: r.reviewCount ? parseInt(r.reviewCount, 10) : undefined,
        })) as Retailer[],
        isNew: f.isNew,
        isSaved: false,
        currency: "USD",
        colorGroupIds: f.colorGroupIds,
      };

      const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
      const method = editingProduct ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const saved = await res.json().catch(() => null);
      if (!res.ok || !saved?.id) {
        toast.err(saved?.error || t("products.save.failedHttp", { status: String(res.status) }));
        return;
      }
      if (editingProduct) {
        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? saved : p)));
      } else {
        setProducts((prev) => [saved, ...prev]);
      }

      // The API drops columns the database does not have rather than failing
      // the save outright — say so, so a missing migration is never silent.
      const problems: string[] = [];
      if (saved.warning) problems.push(saved.warning);

      // The product is saved by now: a variant failure is reported, not
      // retried by leaving the form open (a second Save would add it twice).
      let variants: { changed: boolean; error: string | null };
      try {
        variants = await syncVariants(saved.id);
      } catch (e) {
        variants = { changed: true, error: e instanceof Error ? e.message : t("common.networkError") };
      }
      if (variants.error) problems.push(t("products.save.variantsFailed", { error: variants.error }));

      if (problems.length) toast.err(problems.join(" · "));
      else toast.ok(t(editingProduct ? "products.save.updated" : "products.save.added"));

      if (variants.changed) await fetchProducts();
      closeModal();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.save.failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canWrite) return;
    if (!(await confirm({ title: t("products.delete.title"), confirmLabel: t("products.delete.action"), tone: "danger" }))) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        // 409 names the outfits that still use it; the row stays.
        const json = await res.json().catch(() => ({}));
        toast.err(json.error || t("products.delete.failedHttp", { status: String(res.status) }));
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.ok(t("products.delete.done"));
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.delete.failed"));
    }
  };

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

  /** A list field is either added to or replaced wholesale. */
  const bulkModeOptions = [
    { value: "add", label: t("products.bulkEdit.mode.add") },
    { value: "replace", label: t("products.bulkEdit.mode.replace") },
  ];

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

    const gender = GENDERS.find((g) => g.value === bulk.gender);
    const summary = [
      bulk.brand.trim() && t("products.bulkEdit.sum.brand", { value: bulk.brand.trim() }),
      bulk.gender && t("products.bulkEdit.sum.gender", { value: gender ? t(gender.label) : bulk.gender }),
      bulk.subcategory && t("products.bulkEdit.sum.subcategory", { value: bulk.subcategory }),
      bulk.styleKeywords.length &&
        t(bulk.styleMode === "replace" ? "products.bulkEdit.sum.stylesReplace" : "products.bulkEdit.sum.stylesAdd", {
          list: bulk.styleKeywords.join(", "),
        }),
      bulk.colorGroupIds.length &&
        t(bulk.colorMode === "replace" ? "products.bulkEdit.sum.colorsReplace" : "products.bulkEdit.sum.colorsAdd", {
          count: bulk.colorGroupIds.length,
        }),
      bulk.nameFind && t("products.bulkEdit.sum.rename", { find: bulk.nameFind, replace: bulk.nameReplace }),
      bulk.namePrefix && t("products.bulkEdit.sum.prefix", { value: bulk.namePrefix }),
      bulk.nameSuffix && t("products.bulkEdit.sum.suffix", { value: bulk.nameSuffix }),
    ].filter(Boolean).join("\n  ");

    if (
      !(await confirm({
        title: t("products.bulkEdit.confirmTitle", { count: ids.length }),
        body: `  ${summary}\n\n${t("products.bulkEdit.confirmNote")}`,
        confirmLabel: t("products.bulkEdit.confirmAction", { count: ids.length }),
        tone: "danger",
      }))
    ) return;

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
      if (!res.ok) { toast.err(json.error ?? t("products.bulkEdit.failed")); return; }
      const failed = (json.failures ?? []).length;
      (failed ? toast.err : toast.ok)(
        failed
          ? t("products.bulkEdit.partial", { updated: json.updated, requested: json.requested, failed })
          : t("products.bulkEdit.done", { count: json.updated }),
      );
      setBulkOpen(false);
      resetBulk();
      setSelectedIds(new Set());
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.bulkEdit.failed"));
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

  /** Each suggested field by the name the form gives it. */
  const suggestionLabel: Record<FieldSuggestion["field"], Key> = {
    category: "products.f.category",
    subcategory: "products.field.subcategory",
    gender: "products.f.gender",
    colorGroups: "products.field.colorGroups",
  };

  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<FieldSuggestion[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const runSuggest = async () => {
    if (!form.name.trim()) { toast.err(t("products.suggest.needName")); return; }
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
      if (!res.ok) { toast.err(json.error ?? t("products.suggest.failed")); return; }
      const found = (json.suggestions ?? []) as FieldSuggestion[];
      setSuggestions(found);
      // Only the confident ones start ticked. A low-confidence field left
      // empty is obviously unfinished; one filled in wrongly is not.
      setChosen(new Set(found.filter((s) => s.confidence === "high").map((s) => s.field)));
      if (!found.length) toast.ok(t("products.suggest.none"));
    } catch {
      toast.err(t("products.suggest.offline"));
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
    toast.ok(t("products.suggest.filled", { count: taking.length }));
    setSuggestions(null);
    setChosen(new Set());
  };

  // Re-run the category classifier over EVERY product already in the DB (the
  // import fix only affects new imports). Dry-run first, show what would change,
  // and only write after the admin confirms. scope=all re-evaluates the whole
  // catalog, not just the accessories bucket.
  const handleRecategorize = async () => {
    setRecategorizing(true);
    try {
      const dryRes = await fetch("/api/admin/recategorize?scope=all", { cache: "no-store" });
      const dry = await dryRes.json();
      if (!dryRes.ok) { toast.err(dry.error || t("products.fix.failed")); return; }

      // Products the classifier left alone, and why. Worth stating up front:
      // the whole worry about this button is that it overwrites hand-filed work,
      // and the answer is that it refuses to look at it.
      const guarded = (dry.skippedBreakdown ?? []) as { reason: string; explanation: string; count: number }[];
      const guardNote = guarded
        .filter((g) => g.count > 0)
        .map((g) => `  ${t("products.fix.untouched", { count: g.count, reason: g.explanation })}`)
        .join("\n");

      if (!dry.wouldChange) {
        toast.ok(dry.protected ? t("products.fix.protected", { count: dry.protected }) : t("products.fix.allCorrect"));
        if (guardNote) toast.info(`${t("products.fix.noChanges")}\n\n${guardNote}`);
        return;
      }

      const summary = Object.entries(dry.breakdown as Record<string, number>)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `  ${k}: ${f.number(n)}`)
        .join("\n");
      const ok = await confirm({
        title: t("products.fix.confirmTitle", { changed: dry.wouldChange, count: dry.scanned }),
        body: `${summary}\n\n${guardNote ? `${guardNote}\n\n` : ""}${t("products.fix.confirmBody")}`,
        confirmLabel: t("products.fix.confirmAction", { count: dry.wouldChange }),
      });
      if (!ok) return;

      const applyRes = await fetch("/api/admin/recategorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, scope: "all" }),
      });
      const applied = await applyRes.json();
      if (!applyRes.ok) { toast.err(applied.error || t("products.applyFailed")); return; }
      (applied.undoable ? toast.ok : toast.err)(
        t(applied.undoable ? "products.fix.done" : "products.fix.notRecorded", { count: applied.applied }),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.fix.failed"));
    } finally {
      setRecategorizing(false);
    }
  };

  /** Puts back whatever the last "Fix categories" run changed. */
  const handleUndoRecategorize = async () => {
    if (
      !(await confirm({
        title: t("products.fix.undoTitle"),
        body: t("products.undo.since"),
        confirmLabel: t("products.fix.undoAction"),
      }))
    ) return;
    setRecategorizing(true);
    try {
      const res = await fetch("/api/admin/recategorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true }),
      });
      const json = await res.json();
      if (!res.ok) { toast.err(json.error || t("products.undo.nothing")); return; }
      toast.ok(
        json.movedSince
          ? t("products.undo.restoredSome", { restored: json.restored, changed: json.movedSince })
          : t("products.undo.restored", { count: json.restored }),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.undo.failed"));
    } finally {
      setRecategorizing(false);
    }
  };

  // Takes every style tag off the catalogue and gives products only the five
  // basic styles, read afresh from their own words; curated looks lose theirs.
  // Dry run first, the admin confirms the numbers, then it writes — and the
  // run is recorded, so Undo styles puts the old tags back.
  const handleResetStyles = async () => {
    setRestyling(true);
    try {
      const dryRes = await fetch("/api/admin/restyle", { cache: "no-store" });
      const dry = await dryRes.json();
      if (!dryRes.ok) { toast.err(dry.error || t("products.styles.failed")); return; }

      const would = dry.wouldChange as { products: number; outfits: number };
      if (!would.products && !would.outfits) {
        toast.ok(t("products.styles.nothing"));
        return;
      }

      const after = Object.entries(dry.after as Record<string, number>)
        .map(([style, n]) => `  ${style === "none" ? t("products.styles.none") : style}: ${f.number(n)}`)
        .join("\n");
      const removed = Object.entries(dry.removed as Record<string, number>)
        .sort((a, b) => b[1] - a[1])
        .map(([style, n]) => `${style} ${f.number(n)}`)
        .join(", ");
      // Two clauses, each agreeing with its own number, so a language can
      // join them in its own order.
      const productsClause = t("products.styles.confirmProducts", { changed: would.products, count: dry.scanned.products });
      const ok = await confirm({
        title: would.outfits
          ? t("products.styles.confirmTitleBoth", {
              products: productsClause,
              outfits: t("products.styles.confirmOutfits", { count: would.outfits }),
            })
          : t("products.styles.confirmTitle", { products: productsClause }),
        body:
          `${t("products.styles.confirmBody")}\n\n` +
          `${t("products.styles.perStyle")}\n${after}\n\n` +
          (removed ? `${t("products.styles.removedTags", { list: removed })}\n\n` : "") +
          t("products.canUndo"),
        confirmLabel: t("products.styles.confirmAction", { count: would.products }),
        tone: "danger",
      });
      if (!ok) return;

      const applyRes = await fetch("/api/admin/restyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true }),
      });
      const applied = await applyRes.json();
      if (!applyRes.ok) { toast.err(applied.error || t("products.applyFailed")); return; }
      const failed = (applied.failures ?? []).length;
      (applied.undoable && !failed ? toast.ok : toast.err)(
        applied.undoable
          ? [
              t("products.styles.done", { count: applied.applied }),
              ...(failed ? [t("products.failedCount", { count: failed })] : []),
              t("products.styles.undoHint"),
            ].join(" · ")
          : t("products.styles.notRecorded", { count: applied.applied }),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.styles.failed"));
    } finally {
      setRestyling(false);
    }
  };

  /** Puts back the tags the last style reset replaced. */
  const handleUndoResetStyles = async () => {
    if (
      !(await confirm({
        title: t("products.styles.undoTitle"),
        body: t("products.styles.undoBody"),
        confirmLabel: t("products.styles.undoAction"),
      }))
    ) return;
    setRestyling(true);
    try {
      const res = await fetch("/api/admin/restyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true }),
      });
      const json = await res.json();
      if (!res.ok) { toast.err(json.error || t("products.undo.nothing")); return; }
      toast.ok(
        json.changedSince
          ? t("products.undo.restoredSome", { restored: json.restored, changed: json.changedSince })
          : t("products.styles.restored", { count: json.restored }),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.undo.failed"));
    } finally {
      setRestyling(false);
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
        if (!progressRes.ok) { toast.err(p.error || t("products.bd.progressFailed")); return; }
        if (p.progress.total && !p.progress.unmeasured) {
          toast.ok(
            t("products.bd.allMeasured", {
              total: p.progress.total,
              measured: p.progress.measured,
              declined: p.progress.declined,
            }),
          );
          return;
        }
      }

      const dryRes = await post({ limit: BACKDROP_SAMPLE, ids: chosenIds });
      const dry = await dryRes.json();
      if (!dryRes.ok) { toast.err(dry.error || t("products.bd.failed")); return; }

      if (!dry.scanned) { toast.ok(t("products.bd.nothingLeft")); return; }

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
        .map(([reason, n]) => `  ${f.number(n)} — ${reason}`)
        .join("\n");

      const remaining = (dry.progress?.unmeasured ?? dry.scanned) as number;
      const ok = await confirm({
        title: chosenIds.length
          ? t("products.bd.confirmSelected", { count: dry.scanned })
          : t("products.bd.confirmAll", { count: remaining }),
        body:
          `${t("products.bd.measuredDry", { count: dry.scanned })}\n\n` +
          `  ${t("products.bd.single", { count: dry.measured })}\n` +
          `  ${t("products.bd.none", { count: dry.declined })}\n` +
          (dry.failed ? `  ${t("products.bd.downloadFailed", { count: dry.failed })}\n` : "") +
          (examples ? `\n${examples}\n` : "") +
          (whyNotNote ? `\n${t("products.bd.whyDeclined")}\n${whyNotNote}\n` : "") +
          `\n${t("products.canUndo")}`,
        confirmLabel: chosenIds.length
          ? t("products.bd.confirmSaveSelected", { count: dry.scanned })
          : t("products.bd.confirmSaveAll", { count: remaining }),
      });
      if (!ok) return;

      // One click works through the catalogue rather than one batch of it. The
      // loop is bounded two ways: a round cap, and a stall check — if a round
      // saves nothing, either everything left is failing to download or the
      // writes are failing, and calling again would only repeat that. It counts
      // what was written, not what was measured: a measurement the database
      // refused is not progress.
      let rounds = 0;
      let totalMeasured = 0;
      let totalDeclined = 0;
      let totalFailed = 0;
      let totalApplied = 0;
      let totalWriteFailures = 0;
      let lastWriteError = "";
      let thumbnails = 0;
      let notRecorded = false;
      let left: number | undefined;
      // A round the server refused ends the run; it goes into the summary
      // below rather than a toast of its own the summary would replace.
      let roundError = "";

      while (rounds < BACKDROP_MAX_ROUNDS) {
        rounds++;
        const res = await post({
          apply: true,
          limit: chosenIds.length ? BACKDROP_SAMPLE : BACKDROP_BATCH,
          ids: chosenIds,
        });
        const round = await res.json().catch(() => ({}));
        if (!res.ok) {
          roundError = round.error || t("products.applyFailedHttp", { status: String(res.status) });
          break;
        }

        const applied = (round.applied ?? 0) as number;
        const writeFailures = (round.writeFailures ?? []) as { id: string; error: string }[];
        totalMeasured += round.measured ?? 0;
        totalDeclined += round.declined ?? 0;
        totalFailed = round.failed ?? 0;
        totalApplied += applied;
        totalWriteFailures += writeFailures.length;
        if (writeFailures.length) lastWriteError = writeFailures[0].error;
        thumbnails += round.viaThumbnail ?? 0;
        if (round.undoable === false && applied > 0) notRecorded = true;
        // Null when the progress count failed after a successful write — say
        // nothing about what is left rather than guessing at it.
        left = round.progress?.unmeasured as number | undefined;

        if (chosenIds.length || left === undefined || left === 0 || applied === 0) break;

        toast.ok(t("products.bd.progress", { saved: totalApplied, left }));
      }

      const failedWrites = totalWriteFailures > 0;
      (roundError || notRecorded || failedWrites ? toast.err : toast.ok)(
        (roundError ? `${t("products.bd.stopped", { error: roundError })} · ` : "") +
        t("products.bd.summary", { saved: totalApplied, measured: totalMeasured, declined: totalDeclined }) +
        (totalFailed ? ` · ${t("products.bd.toRetry", { count: totalFailed })}` : "") +
        (failedWrites ? ` · ${t("products.bd.notSaved", { count: totalWriteFailures, error: lastWriteError })}` : "") +
        (left === undefined ? "" : ` · ${left ? t("products.bd.leftClickAgain", { count: left }) : t("products.bd.allDone")}`) +
        // Worth saying: without renditions every photo came at full size, which
        // is the difference between a minute and an hour on a large catalogue.
        (totalMeasured && !thumbnails ? ` — ${t("products.bd.fullSize")}` : "") +
        (notRecorded ? ` — ${t("products.bd.notRecorded")}` : ""),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.bd.failed"));
    } finally {
      setSampling(false);
    }
  };

  /** Clears whatever the last backdrop run wrote. */
  const handleUndoBackdrops = async () => {
    if (
      !(await confirm({
        title: t("products.bd.undoTitle"),
        body: t("products.undo.since"),
        confirmLabel: t("products.bd.undoAction"),
      }))
    ) return;
    setSampling(true);
    try {
      const res = await fetch("/api/admin/product-bg-color", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true }),
      });
      const json = await res.json();
      if (!res.ok) { toast.err(json.error || t("products.undo.nothing")); return; }
      toast.ok(
        json.changedSince
          ? t("products.bd.clearedSome", { restored: json.restored, changed: json.changedSince })
          : t("products.bd.cleared", { count: json.restored }),
      );
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.undo.failed"));
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

  // Keep the Sort dropdown in sync with column-header clicks. If a header produced a
  // (key, dir) combo that isn't a named preset (e.g. Category ↓), surface it as an option
  // so the <select> always reflects the active sort instead of falling back to the first item.
  const currentSortValue = `${sortKey}:${sortDir}`;
  const sortOptions = [
    ...SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) })),
    ...(SORT_OPTIONS.some((o) => o.value === currentSortValue)
      ? []
      : [{ value: currentSortValue, label: `${t(SORT_COLUMN_LABEL[sortKey])} ${sortDir === "asc" ? "↑" : "↓"}` }]),
  ];

  /**
   * Select a row, and with Shift held, everything between it and the row
   * clicked before it.
   *
   * The anchor is the last row whose checkbox was used, held in a ref because
   * it steers the next click rather than anything on screen — re-rendering the
   * table for it would be work for nothing.
   *
   * The range takes the state the clicked row is moving *to*, so shift-clicking
   * also clears a run: the gesture that selects fifty rows undoes them the same
   * way, instead of only ever adding.
   */
  const rangeAnchor = useRef<string | null>(null);

  // A selection dragged out of the bulk-edit form must not close it.

  const toggleSelect = (id: string, extendRange = false) => {
    // Read the anchor here, not inside the updater. React runs the updater at
    // render time, by which point the assignment below has already moved the
    // anchor to this row — so the updater would compare the row against itself,
    // find `anchor === id`, and quietly fall through to a plain toggle. That is
    // exactly the bug this had: Shift was detected, and nothing extended.
    const anchor = rangeAnchor.current;
    rangeAnchor.current = id;

    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (extendRange && anchor && anchor !== id) {
        const ids = filtered.map((p) => p.id);
        const from = ids.indexOf(anchor);
        const to = ids.indexOf(id);
        // A filter or sort change can leave the anchor off the current list.
        // Falling through to the plain toggle is the honest answer then.
        if (from !== -1 && to !== -1) {
          const selecting = !prev.has(id);
          for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
            if (selecting) next.add(ids[i]); else next.delete(ids[i]);
          }
          return next;
        }
      }

      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    rangeAnchor.current = null;
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((p) => p.id)));
  };

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
    if (!canWrite) return;
    const { entries, existingGroupId } = groupModal;
    const primaryEntry = entries.find((e) => e.isPrimary) ?? entries[0];
    setGrouping(true);
    try {
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
        // Includes a database without the variant columns: the message says
        // which columns to add.
        const err = await res.json().catch(() => ({}));
        toast.err(err.error || t("products.group.failedHttp", { status: String(res.status) }));
        return;
      }
      toast.ok(t("products.group.done", { count: entries.length }));
      setGroupModal({ open: false, entries: [] });
      setSelectedIds(new Set());
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.group.failed"));
    } finally {
      setGrouping(false);
    }
  };

  const handleUngroup = async (groupId: string) => {
    if (!canWrite) return;
    if (
      !(await confirm({
        title: t("products.group.unlinkTitle"),
        confirmLabel: t("products.group.unlinkAction"),
        tone: "danger",
      }))
    ) return;
    try {
      const res = await fetch("/api/products/group", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.err(err.error || t("products.group.unlinkFailedHttp", { status: String(res.status) }));
        return;
      }
      toast.ok(t("products.group.unlinked"));
      await fetchProducts();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.group.unlinkFailed"));
    }
  };

  /**
   * Deletes the selection one product at a time and reports what actually
   * went: only rows the server deleted leave the table, and the ones it
   * refused — a product still used in an outfit, say — stay selected, with
   * the reason in the toast.
   */
  const handleBulkDelete = async () => {
    if (!selectedIds.size || !canWrite) return;
    const ids = [...selectedIds];
    const count = ids.length;
    if (
      !(await confirm({
        title: t("products.bulkDelete.title", { count }),
        body: t("products.bulkDelete.body"),
        confirmLabel: t("products.bulkDelete.action", { count }),
        tone: "danger",
      }))
    ) return;
    setDeleting(true);
    try {
      const failures: { id: string; error: string }[] = [];
      const deleted: string[] = [];
      // A few at a time rather than hundreds of requests at once.
      for (let i = 0; i < ids.length; i += 8) {
        await Promise.all(ids.slice(i, i + 8).map(async (id) => {
          try {
            const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
            if (res.ok) { deleted.push(id); return; }
            const json = await res.json().catch(() => ({}));
            failures.push({ id, error: (json.error as string) || `HTTP ${res.status}` });
          } catch (e) {
            failures.push({ id, error: e instanceof Error ? e.message : t("common.networkError") });
          }
        }));
      }
      const gone = new Set(deleted);
      setProducts((prev) => prev.filter((p) => !gone.has(p.id)));
      setSelectedIds(new Set(failures.map((f) => f.id)));
      if (failures.length) {
        const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? id;
        const shown = failures.slice(0, 3).map((f) => `${nameOf(f.id)}: ${f.error}`).join(" · ");
        toast.err(
          t("products.bulkDelete.partial", { deleted: deleted.length, total: count, list: shown }) +
          (failures.length > 3 ? ` (${t("products.bulkDelete.more", { count: failures.length - 3 })})` : ""),
        );
      } else {
        toast.ok(t("products.bulkDelete.done", { count }));
      }
    } catch (e) {
      toast.err(e instanceof Error ? e.message : t("products.bulkDelete.failed"));
    } finally {
      setDeleting(false);
    }
  };

  /** Which way a column header's arrows point: its direction when it is the sort. */
  const sortDirFor = (col: SortColumn) => (sortKey === col ? sortDir : null);

  // ── Header menu, row menu, columns ─────────────────────────────────────────

  /** What a maintenance run is busy with, shown beside the header buttons. */
  const maintenanceBusy = recategorizing
    ? t("products.busy.categories")
    : restyling
      ? t("products.busy.styles")
      : sampling
        ? t("products.busy.backdrops")
        : cards.busy
          ? cards.received
            ? t("products.busy.downloadMb", { mb: (cards.received / (1024 * 1024)).toFixed(1) })
            : t("products.busy.download")
          : null;

  const maintenanceItems: MenuItem[] = [
    { kind: "label", label: t("products.maintenance") },
    {
      label: t("products.mt.fixCategories"),
      hint: t("products.mt.fixCategoriesHint"),
      onSelect: handleRecategorize,
      disabled: recategorizing || !canWrite,
    },
    { label: t("products.mt.undoFix"), onSelect: handleUndoRecategorize, disabled: recategorizing || !canWrite },
    { kind: "separator" },
    {
      label: t("products.mt.resetStyles"),
      hint: t("products.mt.resetStylesHint"),
      onSelect: handleResetStyles,
      disabled: restyling || !canWrite,
    },
    { label: t("products.mt.undoStyles"), onSelect: handleUndoResetStyles, disabled: restyling || !canWrite },
    { kind: "separator" },
    {
      label: t("products.mt.backdrops"),
      // Works on the selection when there is one, otherwise on the next batch
      // of never-measured products.
      hint: selectedIds.size
        ? t("products.mt.backdropsSelected", { count: selectedIds.size })
        : t("products.mt.backdropsHint"),
      onSelect: handleSampleBackdrops,
      disabled: sampling || !canWrite,
    },
    { label: t("products.mt.undoBackdrops"), onSelect: handleUndoBackdrops, disabled: sampling || !canWrite },
    { kind: "separator" },
    {
      label: t("products.mt.download"),
      // The selection, else what the filters left, else the whole catalogue.
      hint: t("products.mt.downloadHint", { count: exportIds ? exportIds.length : products.length }),
      onSelect: () => void cards.download(exportIds),
      disabled: cards.busy || (exportIds ? exportIds.length : products.length) === 0,
    },
  ];

  const rowItems = (product: Product): MenuItem[] => [
    // Also an icon beside the menu; on a phone the icon gives its room to the name.
    { label: t("products.row.editShort"), onSelect: () => openEditModal(product), disabled: !canWrite },
    { label: t(product.cropData ? "crop.edit" : "crop.setUp"), onSelect: () => setCropProduct(product), disabled: !canWrite },
    { label: t("products.row.download"), onSelect: () => void cards.download([product.id]), disabled: cards.busy },
    { label: t("products.row.duplicate"), onSelect: () => openDuplicateModal(product), disabled: !canWrite },
    ...(product.variantGroupId && canWrite
      ? [{ label: t("products.row.unlink"), onSelect: () => handleUngroup(product.variantGroupId!) }]
      : []),
    { kind: "separator" },
    { label: t("products.row.delete"), onSelect: () => handleDelete(product.id), tone: "danger", disabled: !canWrite },
  ];

  const sortFor = (col: SortColumn) => ({ dir: sortDirFor(col), onToggle: () => toggleSort(col) });

  const productColumns: Column<Product>[] = [
    {
      key: "product",
      header: t("products.col.product"),
      grow: true,
      sort: sortFor("name"),
      cell: (p) => (
        <div className="flex items-center gap-3 min-w-0">
          <Thumb src={p.imageUrl} bg={p.bgColor} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium truncate" title={p.name}>
                {p.name}
              </span>
              {p.isNew && <Badge>{t("products.badge.new")}</Badge>}
              {/* The variant's own swatch as the dot, rather than Badge's
                  `dot`, which takes the text color. */}
              {p.variantGroupId && (
                <Badge>
                  {t(p.isGroupPrimary ? "products.badge.primary" : "products.badge.variant")}
                  {p.colorHex && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.colorHex }} aria-hidden="true" />}
                </Badge>
              )}
            </div>
            <div className="text-[12px] text-[var(--foreground-muted)] truncate">{p.brand}</div>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: t("products.col.category"),
      hide: "md",
      sort: sortFor("category"),
      cell: (p) => <span className="text-[var(--foreground-muted)]">{categoryPath(p.category, p.subcategory, categoryGroups)}</span>,
    },
    {
      key: "price",
      header: t("products.col.price"),
      align: "right",
      sort: sortFor("priceMin"),
      cell: (p) => f.moneyRange(p.priceMin, p.priceMax),
    },
    {
      key: "stores",
      header: t("products.col.stores"),
      align: "right",
      hide: "lg",
      cell: (p) => <span className="text-[var(--foreground-muted)]">{f.number(p.retailers?.length ?? 0)}</span>,
    },
    {
      key: "added",
      header: t("products.col.added"),
      hide: "md",
      sort: sortFor("createdAt"),
      cell: (p) => <span className="text-[var(--foreground-muted)]">{f.date(p.createdAt)}</span>,
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* DB status banner — the one place a missing database is explained;
          every action that writes is disabled below it. */}
      {dbConfigured === false && (
        <div className="mb-4 rounded-xl bg-[var(--err-bg)] text-[var(--err)] border border-[var(--err-line)] px-4 py-3 text-xs">
          <strong>{t("products.db.title")}</strong>{" "}
          {rich(t("products.db.hint"), { url: "SUPABASE_URL", key: "SUPABASE_SERVICE_ROLE_KEY" })}
        </div>
      )}

      {/* Header: what there is, the one main action, and the rest under "…".
          The catalogue maintenance runs (GS1-12) live in that menu; each one
          still does its dry run and asks with the number it will touch. */}
      <PageHeader
        title={t("nav.products")}
        subtitle={
          !loadError && !loading ? `${t("products.count", { count: products.length })} · ${t("products.recent", { count: addedRecently })}` : undefined
        }
        status={maintenanceBusy}
        actions={[{ key: "import", label: t("products.import"), href: "/goo-studio/import" }]}
        primary={{
          key: "add",
          label: t("products.add"),
          icon: PLUS,
          onClick: openAddModal,
          disabled: !canWrite,
          title: canWrite ? undefined : t("products.needsDb"),
        }}
        menu={maintenanceItems}
        menuLabel={t("products.maintenance")}
      />

      {/* Search and filters (FilterBar): one button per field, the active ones
          again as chips under the row, and the count. */}
      <div className="mb-4 flex flex-col gap-2.5">
        <FilterBar
          search={
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t("products.search.placeholder")}
              label={t("products.search.label")}
            />
          }
          active={activeFilters.length}
          onClearAll={clearFilters}
          shown={filtered.length}
        >
          <FilterMenu
            label={t("products.f.category")}
            value={categoryValue}
            options={categoryOptions}
            onChange={setCategoryValue}
            allLabel={t("filter.all")}
            searchable
          />
          <FilterMenu
            label={t("products.f.brand")}
            value={filterBrand}
            options={brandsInCatalogue.map((b) => ({ value: b, label: b }))}
            onChange={setFilterBrand}
            allLabel={t("filter.all")}
            searchable
          />
          <FilterMenu
            label={t("products.f.color")}
            value={filterColorGroup}
            options={colorGroups.map((g) => ({ value: String(g.id), label: g.name }))}
            onChange={setFilterColorGroup}
            allLabel={t("filter.all")}
          />
          <FilterMenu
            label={t("products.f.style")}
            value={filterStyle}
            options={STYLE_KEYWORDS.map((s) => ({ value: s, label: styleLabel(s) }))}
            onChange={setFilterStyle}
            allLabel={t("filter.all")}
          />
          <FilterMenu
            label={t("products.f.gender")}
            value={filterGender}
            options={GENDERS.map((g) => ({ value: g.value, label: t(g.label) }))}
            onChange={setFilterGender}
            allLabel={t("filter.all")}
          />
          <FilterMenu
            label={t("products.f.status")}
            value={filterNew ? "new" : ""}
            options={[{ value: "new", label: t("products.badge.new") }]}
            onChange={(v) => setFilterNew(v === "new" ? true : null)}
            allLabel={t("filter.all")}
          />
          {/* The gaps: filtering by what a product has cannot find what it is
              missing, which is most of the work when tidying a catalogue. */}
          <FilterMenu
            label={t("products.f.missing")}
            value={filterMissing}
            options={MISSING_FILTERS.map((m) => ({ value: m.value, label: t(m.label) }))}
            onChange={setFilterMissing}
            allLabel={t("products.f.missingNone")}
            tone="warn"
          />
        </FilterBar>
        {!loading && !loadError && (
          <ActiveFilters
            filters={activeFilters}
            onClearAll={clearFilters}
            count={t("filter.count", { shown: filtered.length, total: products.length })}
            trailing={
              <FilterMenu
                label={t("filter.sort")}
                value={currentSortValue}
                options={sortOptions}
                onChange={(v) => {
                  const [key, dir] = v.split(":") as [SortColumn, "asc" | "desc"];
                  setSortKey(key);
                  setSortDir(dir);
                }}
                variant="ghost"
                align="end"
              />
            }
          />
        )}
      </div>

      {/* Bulk edit modal */}
      {bulkOpen && (
        <Modal
          onClose={() => setBulkOpen(false)}
          label={t("products.bulk.edit")}
          panelClassName="w-full max-w-xl max-h-[90dvh] md:max-h-[85vh] overflow-y-auto rounded-2xl shadow-xl"
        >
          <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-[var(--border)]">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                {t("products.bulkEdit.title", { count: selectedIds.size })}
              </h2>
              <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
                {t("products.bulkEdit.hint")}
              </p>
            </div>
            <button onClick={() => setBulkOpen(false)} aria-label={t("common.close")} title={t("common.close")} className={`${BTN_ICON} shrink-0`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="px-4 md:px-6 py-5 flex flex-col gap-5">
            {/* Brand + gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t("products.f.brand")}</label>
                <input
                  list="bulk-brands"
                  value={bulk.brand}
                  onChange={(e) => setBulk((b) => ({ ...b, brand: e.target.value }))}
                  placeholder={t("products.bulkEdit.keepBlank")}
                  className={inputCls}
                />
                <datalist id="bulk-brands">
                  {brandsInCatalogue.map((b) => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>{t("products.f.gender")}</label>
                <select value={bulk.gender} onChange={(e) => setBulk((b) => ({ ...b, gender: e.target.value }))} className={selectCls}>
                  <option value="">{t("products.bulkEdit.keep")}</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>{t(g.label)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subcategory — sets the category with it */}
            <div>
              <label className={labelCls}>{t("products.field.subcategory")}</label>
              <select
                value={bulk.subcategory}
                onChange={(e) => setBulk((b) => ({ ...b, subcategory: e.target.value }))}
                className={selectCls}
              >
                <option value="">{t("products.bulkEdit.keep")}</option>
                {categoryGroups.map((g) => (
                  <optgroup key={g.id} label={g.label}>
                    {g.items.map((i) => <option key={i.label} value={i.label}>{i.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <p className="text-[12px] text-[var(--foreground-subtle)] mt-1">
                {t("products.bulkEdit.subcategoryHint")}
              </p>
            </div>

            {/* Style keywords */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className={labelCls}>{t("products.field.styles")}</label>
                <FilterChips
                  label={t("products.bulkEdit.modeFor", { field: t("products.field.styles") })}
                  value={bulk.styleMode}
                  options={bulkModeOptions}
                  onChange={(v) => setBulk((b) => ({ ...b, styleMode: v as typeof b.styleMode }))}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_KEYWORDS.map((k) => {
                  const on = bulk.styleKeywords.includes(k);
                  return (
                    <button key={k} onClick={() => setBulk((b) => ({
                      ...b,
                      styleKeywords: on ? b.styleKeywords.filter((x) => x !== k) : [...b.styleKeywords, k],
                    }))}
                      className={`px-2.5 py-1 text-[11px] border rounded-full transition-colors ${on ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)]"}`}
                    >{styleLabel(k)}</button>
                  );
                })}
              </div>
            </div>

            {/* Color filters */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className={labelCls}>{t("products.field.colorGroups")}</label>
                <FilterChips
                  label={t("products.bulkEdit.modeFor", { field: t("products.field.colorGroups") })}
                  value={bulk.colorMode}
                  options={bulkModeOptions}
                  onChange={(v) => setBulk((b) => ({ ...b, colorMode: v as typeof b.colorMode }))}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {colorGroups.map((g) => {
                  const on = bulk.colorGroupIds.includes(g.id);
                  return (
                    <button key={g.id} onClick={() => setBulk((b) => ({
                      ...b,
                      colorGroupIds: on ? b.colorGroupIds.filter((x) => x !== g.id) : [...b.colorGroupIds, g.id],
                    }))}
                      className={`px-2.5 py-1 text-[11px] border rounded-full transition-colors ${on ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)]"}`}
                    >{g.name}</button>
                  );
                })}
              </div>
            </div>

            {/* Names */}
            <div>
              <label className={labelCls}>{t("products.field.names")}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={bulk.nameFind} onChange={(e) => setBulk((b) => ({ ...b, nameFind: e.target.value }))} placeholder={t("products.bulkEdit.find")} className={inputCls} />
                <input value={bulk.nameReplace} onChange={(e) => setBulk((b) => ({ ...b, nameReplace: e.target.value }))} placeholder={t("products.bulkEdit.replaceWith")} className={inputCls} />
                <input value={bulk.namePrefix} onChange={(e) => setBulk((b) => ({ ...b, namePrefix: e.target.value }))} placeholder={t("products.bulkEdit.addBefore")} className={inputCls} />
                <input value={bulk.nameSuffix} onChange={(e) => setBulk((b) => ({ ...b, nameSuffix: e.target.value }))} placeholder={t("products.bulkEdit.addAfter")} className={inputCls} />
              </div>
              <p className="text-[12px] text-[var(--foreground-subtle)] mt-1">
                {t("products.bulkEdit.namesHint")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-t border-[var(--border)]">
            <span className="text-[11px] text-[var(--foreground-muted)]">
              {bulkChangeCount ? t("products.bulkEdit.willChange", { count: bulkChangeCount }) : t("products.bulkEdit.nothing")}
            </span>
            <div className="flex items-center gap-3">
              <button onClick={() => { setBulkOpen(false); resetBulk(); }} className={btn("ghost")}>
                {t("common.cancel")}
              </button>
              <button
                onClick={applyBulkEdit}
                disabled={bulkSaving || !bulkChangeCount || !canWrite}
                className={btn("primary")}
              >
                {bulkSaving ? t("products.bulkEdit.applying") : t("products.bulkEdit.apply", { count: selectedIds.size })}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <DataTable
        label={t("nav.products")}
        rows={filtered}
        rowKey={(p) => p.id}
        loading={loading}
        resetKey={tableResetKey}
        selection={{
          selected: selectedIds,
          onToggle: toggleSelect,
          onToggleAll: toggleSelectAll,
          allSelected,
          rowLabel: (p) => p.name,
        }}
        columns={productColumns}
        card={(p) => ({
          thumb: <Thumb src={p.imageUrl} bg={p.bgColor} size="lg" />,
          title: p.name,
          badge: p.isNew ? <Badge>{t("products.badge.new")}</Badge> : undefined,
          meta: `${p.brand} · ${f.moneyRange(p.priceMin, p.priceMax)}`,
        })}
        actions={(product) => (
          <>
            <button
              onClick={() => openEditModal(product)}
              disabled={!canWrite}
              className={`${BTN_ICON_SM} max-md:hidden`}
              aria-label={t("products.row.edit", { name: product.name })}
              title={t("products.row.edit", { name: product.name })}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M11 2.5L13.5 5 6 12.5l-3 .5.5-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </button>
            <RowMenu size="sm" label={t("menu.moreFor", { name: product.name })} items={rowItems(product)} />
          </>
        )}
        empty={
          loadError ? (
            <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <p className="text-[13px] text-[var(--err)] break-words">{loadError}</p>
              <button onClick={fetchProducts} className={btn("secondary")}>
                {t("products.retry")}
              </button>
            </div>
          ) : (
            <EmptyState
              text={t(products.length ? "products.empty.filtered" : "products.empty.none")}
              action={
                activeFilters.length > 0 || searchQuery ? (
                  <button
                    onClick={() => {
                      clearFilters();
                      setSearchQuery("");
                    }}
                    className={btn("secondary")}
                  >
                    {t("products.clearFilters")}
                  </button>
                ) : undefined
              }
            />
          )
        }
      />

      <BulkBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        actions={[
          { key: "edit", label: t("products.bulk.edit"), onClick: () => setBulkOpen(true), disabled: !canWrite },
          ...(selectedIds.size >= 2
            ? [{ key: "group", label: t("products.bulk.group"), onClick: openGroupModal, disabled: !canWrite }]
            : []),
          { key: "cards", label: t("products.bulk.download"), onClick: () => void cards.download(exportIds), disabled: cards.busy },
          { key: "delete", label: t(deleting ? "products.bulk.deleting" : "products.bulk.delete"), onClick: handleBulkDelete, disabled: deleting || !canWrite, tone: "danger" as const },
        ]}
      />

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <Modal
          onClose={closeModal}
          label={t(editingProduct ? "products.editor.edit" : "products.editor.new")}
          panelClassName="rounded-2xl max-w-5xl w-full max-h-[90dvh] md:max-h-[94vh] flex flex-col overflow-hidden"
          closeOnScrim={false}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-[var(--border)] shrink-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                {t(editingProduct ? "products.editor.edit" : isDuplicating ? "products.editor.duplicate" : "products.add")}
              </h2>
              <button
                onClick={runSuggest}
                disabled={suggesting || !canWrite}
                title={t("products.suggest.title")}
                className={btn("secondary")}
              >
                {t(suggesting ? "products.suggest.reading" : "products.suggest.button")}
              </button>
            </div>
            <button onClick={closeModal} aria-label={t("common.close")} title={t("common.close")} className={`${BTN_ICON} shrink-0`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Suggestions — spans the modal, above both columns, because the
              fields they land in live in different ones. */}
          {suggestions && suggestions.length > 0 && (
            <div className="shrink-0 border-b border-[var(--border)] px-4 md:px-6 py-3 bg-[var(--background)] max-h-[35dvh] overflow-y-auto md:max-h-none md:overflow-visible">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <p className="text-[12px] text-[var(--foreground-subtle)]">
                  {t("products.suggest.source")}
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={applySuggestions} disabled={!chosen.size}
                    className={btn("secondary")}>
                    {chosen.size ? t("products.suggest.fill", { count: chosen.size }) : t("products.suggest.fillNone")}
                  </button>
                  <button onClick={() => { setSuggestions(null); setChosen(new Set()); }}
                    className={btn("ghost")}>
                    {t("common.dismiss")}
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
                          if (next.has(s.field)) next.delete(s.field); else next.add(s.field);
                          return next;
                        })}
                        className="mt-0.5 accent-[var(--foreground)]"
                      />
                      <span className="text-[12px] leading-relaxed">
                        <span className="text-[var(--foreground-subtle)]">{t(suggestionLabel[s.field])}</span>{" "}
                        <span className="font-mono text-[var(--foreground)]">{shown}</span>
                        {s.replaces && <span className="text-[var(--warn)]"> — {t("products.suggest.replaces", { value: s.replaces })}</span>}
                        {s.alsoSetsCategory && <span className="text-[var(--foreground-muted)]"> · {t("products.suggest.alsoSets", { value: s.alsoSetsCategory })}</span>}
                        {s.confidence === "low" && <span className="text-[var(--warn)]"> · {t("products.suggest.unsure")}</span>}
                        <span className="block text-[var(--foreground-subtle)]">{s.why}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-[12px] text-[var(--foreground-subtle)]">
                {t("products.suggest.footer")}
              </p>
            </div>
          )}

          {/* Body — two-column */}
          {/* One column on a phone (the whole body scrolls), two from md up
              (each column scrolls on its own). The columns are scroll
              boxes only from md: below it a scroll box shrinks its grid row
              and the form would scroll inside a strip. */}
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] flex-1 min-h-0 overflow-y-auto divide-y md:divide-y-0 md:divide-x divide-[var(--border)]">

            {/* ── Left: Images ── */}
            <div className="flex flex-col gap-3 px-4 py-4 md:overflow-y-auto">
              <p className="text-[13px] font-medium text-[var(--foreground)]">{t("products.editor.images")}</p>
              <p className="text-[12px] text-[var(--foreground-subtle)] leading-relaxed">{t("products.editor.imagesHint")}</p>
              <ImageList
                images={form.images}
                onChange={(update) => setForm((f) => ({ ...f, images: update(f.images) }))}
              />
            </div>

            {/* ── Right: Sections ── */}
            <div className="flex flex-col divide-y divide-[var(--border)] md:overflow-y-auto">

              {(() => {
                // Section header wired to the collapsed set.
                const sec = (id: string) => ({ open: !collapsed.has(id), onToggle: () => toggleSection(id) });

                return (
                  <>
                    {/* ── Basic info (always open) ── */}
                    <div className="px-4 py-4 flex flex-col gap-3">
                      <p className="text-[13px] font-medium text-[var(--foreground)]">{t("products.editor.basic")}</p>
                      <div>
                        <label className={labelCls}>{t("products.field.name")}</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder={t("products.field.namePlaceholder")}
                          className={inputCls}
                        />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <label className={labelCls}>{t("products.f.brand")}</label>
                      <input
                        ref={brandInputRef}
                        type="text"
                        value={form.brand}
                        onChange={(e) => { setForm((f) => ({ ...f, brand: e.target.value })); setBrandDropdownOpen(true); }}
                        onFocus={() => setBrandDropdownOpen(true)}
                        placeholder={t("products.brand.placeholder")}
                        className={inputCls}
                        autoComplete="off"
                      />
                      {brandDropdownOpen && (
                        <div ref={brandDropdownRef} className="absolute z-50 top-full left-0 right-0 mt-0.5 border border-[var(--border)] rounded-xl bg-[var(--surface)] max-h-48 overflow-y-auto shadow-lg">
                          {(() => {
                            const q = form.brand.toLowerCase().trim();
                            const filtered = suggestedBrands.filter((b) => b.toLowerCase().includes(q));
                            const exactMatch = suggestedBrands.some((b) => b.toLowerCase() === q);
                            return (
                              <>
                                {filtered.map((b) => (
                                  <button key={b} type="button" onMouseDown={(e) => { e.preventDefault(); setForm((f) => ({ ...f, brand: b })); setBrandDropdownOpen(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--background)] transition-colors ${form.brand === b ? "text-[var(--foreground)] font-medium" : "text-[var(--foreground-muted)]"}`}>{b}</button>
                                ))}
                                {form.brand.trim() && !exactMatch && (
                                  <button type="button" disabled={addingBrand} onMouseDown={(e) => { e.preventDefault(); addBrandInline(form.brand.trim()); }} className="w-full text-left px-3 py-2 text-xs text-[var(--foreground)] border-t border-[var(--border)] hover:bg-[var(--background)] flex items-center gap-2 transition-colors">
                                    {addingBrand ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <span className="text-base leading-none">+</span>}
                                    {t("products.brand.addNew", { name: form.brand.trim() })}
                                  </button>
                                )}
                                {filtered.length === 0 && !form.brand.trim() && <p className="px-3 py-2 text-xs text-[var(--foreground-subtle)]">{t("products.brand.startTyping")}</p>}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>{t("products.f.gender")}</label>
                      <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Gender | "" }))} className={selectCls}>
                        <option value="">{t("products.field.genderUnset")}</option>
                        {GENDERS.map((g) => (
                          <option key={g.value} value={g.value}>{t(g.label)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Category ── */}
                <div>
                  <SecHead {...sec("category")} label={t("products.f.category")} hint={`— ${categoryPath(form.category, form.subcategory, categoryGroups)}`} />
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
                                    title={first ? undefined : t("products.cat.emptyGroup", { group: g.label, section: t("nav.categories") })}
                                    onClick={() => first && pick(first.label)}
                                    className={`py-1.5 text-[12px] border rounded-full transition-colors text-center leading-tight disabled:opacity-40 disabled:cursor-not-allowed ${activeGroup?.id === g.id ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
                                  >{g.label}</button>
                                );
                              })}
                            </div>

                            {activeGroup ? (
                              <div className="flex flex-wrap gap-1.5">
                                {activeGroup.items.map((item) => (
                                  <button key={item.label} type="button"
                                    onClick={() => pick(item.label)}
                                    className={`px-2.5 py-1.5 text-[11px] border rounded-full transition-colors ${form.subcategory === item.label ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
                                  >{item.label}</button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[12px] text-[var(--foreground-subtle)]">
                                {rich(t("products.cat.notInTree"), { category: form.category })}
                              </p>
                            )}

                            {activeGroup && !form.subcategory && (
                              <p className="text-[12px] text-[var(--foreground-subtle)]">
                                {t("products.cat.noSubcategory", { group: activeGroup.label })}
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
                  <SecHead {...sec("sizes")} label={t("products.field.sizes")} hint={form.sizes ? `— ${form.sizes}` : undefined} />
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
                                      className={`min-w-[34px] px-2 py-1.5 text-[11px] border rounded-full transition-colors text-center ${active ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
                                    >{size}</button>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <input type="text" value={form.sizes} onChange={(e) => setForm((f) => ({ ...f, sizes: e.target.value }))} placeholder={EXAMPLE.sizes} className={`${inputCls} flex-1`} />
                              {selected.length > 0 && (
                                <button type="button" onClick={() => setForm((f) => ({ ...f, sizes: "" }))} className={`${btn("ghost")} shrink-0`}>{t("products.sizes.clear")}</button>
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
                  <SecHead {...sec("pricing")} label={t("products.field.pricing")} />
                  {!collapsed.has("pricing") && (
                    <div className="px-4 pb-4 flex flex-col gap-3">
                      {(() => {
                        const retailerPrices = form.retailers.map(retailerUsd).filter((p) => p > 0);
                        const isAutoCalc = retailerPrices.length > 0;
                        const converted = [
                          ...new Set(
                            form.retailers
                              .filter((r) => retailerUsd(r) > 0 && (r.currency || "USD").toUpperCase() !== "USD")
                              .map((r) => r.currency.toUpperCase()),
                          ),
                        ];
                        return (
                          <>
                            {isAutoCalc && (
                              <p className="text-[12px] text-[var(--foreground-muted)]">
                                {t("products.price.auto", { count: retailerPrices.length })}
                                {converted.length > 0 && ` · ${t("products.price.converted", { currencies: converted.join(", ") })}`}
                              </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className={labelCls}>{t("products.price.min")}</label>
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
                                <label className={labelCls}>{t("products.price.max")}</label>
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
                      {(() => {
                        // The badge shows only in a product's first 7 days,
                        // counted from when it was added — so on an older
                        // piece the box can do nothing and says so.
                        const createdMs = editingProduct?.createdAt ? new Date(editingProduct.createdAt).getTime() : NaN;
                        const pastNewWindow = Number.isFinite(createdMs) && Date.now() - createdMs >= NEW_ARRIVAL_WINDOW_MS;
                        return (
                          <div className="flex items-center gap-3">
                            <input type="checkbox" id="isNew" checked={form.isNew && !pastNewWindow} disabled={pastNewWindow} onChange={(e) => setForm((f) => ({ ...f, isNew: e.target.checked }))} className="w-3.5 h-3.5 accent-[var(--foreground)] disabled:opacity-40 disabled:cursor-not-allowed" />
                            <label htmlFor="isNew" className={`text-xs text-[var(--foreground-muted)] tracking-wide ${pastNewWindow ? "cursor-not-allowed" : "cursor-pointer"}`}>
                              {t("products.isNew.label")}{" "}
                              <span className="text-[var(--foreground-subtle)]">
                                {pastNewWindow
                                  ? t("products.isNew.expired", { date: f.date(editingProduct?.createdAt) })
                                  : t("products.isNew.hint")}
                              </span>
                            </label>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* ── Details (collapsible) ── */}
                <div>
                  <SecHead {...sec("details")} label={t("products.field.details")} />
                  {!collapsed.has("details") && (
                    <div className="px-4 pb-4 flex flex-col gap-3">
                      <div>
                        <label className={labelCls}>{t("products.field.description")}</label>
                        <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t("products.field.descriptionPlaceholder")} rows={3} className={`${inputCls} resize-none`} />
                      </div>
                      <div>
                        <label className={labelCls}>{t("products.field.material")}</label>
                        <input type="text" value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} placeholder={EXAMPLE.material} className={inputCls} />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Colors (collapsible) ── */}
                <div>
                  <SecHead {...sec("colors")} label={t("products.field.colors")} hint={form.colorsRaw ? `— ${form.colorsRaw}` : undefined} />
                  {!collapsed.has("colors") && (
                    <div className="px-4 pb-4">
                      <input type="text" value={form.colorsRaw} onChange={(e) => setForm((f) => ({ ...f, colorsRaw: e.target.value }))} placeholder={EXAMPLE.colors} className={inputCls} />
                    </div>
                  )}
                </div>

                {/* ── Color filter groups (collapsible, compact grid) ── */}
                <div>
                  <SecHead
                    {...sec("color-groups")}
                    label={t("products.field.colorGroups")}
                    hint={form.colorGroupIds.length ? `— ${t("products.colorGroups.selected", { count: form.colorGroupIds.length })}` : undefined}
                  />
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
                              className={`flex items-center gap-2 px-2.5 py-2 border rounded-full text-[12px] transition-colors text-left ${active ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground-muted)] hover:text-[var(--foreground)]"}`}
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
                  <SecHead {...sec("style")} label={t("products.field.styles")} />
                  {!collapsed.has("style") && (
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-1.5">
                        {STYLE_KEYWORDS.map((kw) => (
                          <button key={kw} type="button" onClick={() => toggleKeyword(kw)}
                            className={`px-2.5 py-1 text-[12px] border rounded-full transition-colors ${form.styleKeywords.includes(kw) ? "bg-[var(--foreground)] text-[var(--surface)] border-[var(--foreground)]" : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"}`}
                          >{styleLabel(kw)}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Color variants (collapsible) ── */}
                <div>
                  <SecHead
                    {...sec("variants")}
                    label={t("products.field.variants")}
                    hint={form.linkedProductIds.length ? `— ${t("products.variants.linked", { count: form.linkedProductIds.length })}` : undefined}
                  />
                  {!collapsed.has("variants") && (
                    <div className="px-4 pb-4 flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="color" value={form.variantColorHex} onChange={(e) => setForm((f) => ({ ...f, variantColorHex: e.target.value }))} className="w-8 h-8 border border-[var(--border)] cursor-pointer bg-transparent p-0.5 shrink-0" title={t("products.variants.swatchTitle")} />
                        <input type="text" value={form.variantColorHex} onChange={(e) => setForm((f) => ({ ...f, variantColorHex: e.target.value }))} placeholder="#888888" maxLength={7} className={`${inputCls} font-mono max-w-[110px] py-1.5`} />
                        <span className="text-[12px] text-[var(--foreground-subtle)]">{t("products.variants.swatchHint")}</span>
                      </div>
                      {form.linkedProductIds.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {form.linkedProductIds.map((lid) => {
                            const lp = products.find((x) => x.id === lid);
                            if (!lp) return null;
                            return (
                              <div key={lid} className="flex items-center gap-2 border border-[var(--border)] px-2 py-1.5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {lp.imageUrl && <img src={lp.imageUrl} alt={lp.name} loading="lazy" decoding="async" className="w-7 h-9 object-cover shrink-0" />}
                                <div className="w-3 h-3 rounded-full shrink-0 border border-[var(--border)]" style={{ backgroundColor: lp.colorHex ?? "#888888" }} />
                                <span className="text-xs text-[var(--foreground)] flex-1 truncate">{lp.name}</span>
                                <span className="text-[12px] text-[var(--foreground-subtle)] shrink-0">{f.money(lp.priceMin)}</span>
                                <button
                                  type="button"
                                  onClick={() => setForm((f) => ({ ...f, linkedProductIds: f.linkedProductIds.filter((x) => x !== lid) }))}
                                  className={`${BTN_ICON} shrink-0 ml-1`}
                                  aria-label={t("products.variants.remove", { name: lp.name })}
                                  title={t("products.variants.remove", { name: lp.name })}
                                >
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="relative">
                        <input type="text" value={variantSearch} onChange={(e) => setVariantSearch(e.target.value)} placeholder={t("products.variants.search")} className={`${inputCls} py-1.5`} />
                        {variantSearch.trim().length >= 1 && (() => {
                          const q = variantSearch.toLowerCase();
                          const matches = products.filter((p) => p.id !== (editingProduct?.id ?? "") && !form.linkedProductIds.includes(p.id) && (p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))).slice(0, 6);
                          if (matches.length === 0) return null;
                          return (
                            <div className="absolute z-20 left-0 right-0 top-full border border-[var(--border)] rounded-xl shadow-lg mt-0.5 max-h-48 overflow-y-auto" style={{ background: "var(--surface)" }}>
                              {matches.map((mp) => (
                                <button key={mp.id} type="button" onClick={() => { setForm((f) => ({ ...f, linkedProductIds: [...f.linkedProductIds, mp.id] })); setVariantSearch(""); }} className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[var(--background)] transition-colors border-b border-[var(--border)] last:border-0">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  {mp.imageUrl && <img src={mp.imageUrl} alt={mp.name} loading="lazy" decoding="async" className="w-6 h-8 object-cover shrink-0" />}
                                  {mp.colorHex && <span className="w-3 h-3 rounded-full shrink-0 border border-[var(--border)]" style={{ backgroundColor: mp.colorHex }} />}
                                  <span className="text-xs text-[var(--foreground)] flex-1 truncate">{mp.name}</span>
                                  <span className="text-[12px] text-[var(--foreground-muted)] shrink-0">{mp.brand}</span>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      {form.linkedProductIds.length > 0 && (
                        <p className="text-[12px] text-[var(--foreground-subtle)]">
                          {editingProduct?.variantGroupId
                            ? rich(t("products.variants.helpGrouped", { action: t("products.bulk.group") }))
                            : rich(t("products.variants.helpNew"))}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Retailers (collapsible) ── */}
                <div>
                  <SecHead
                    {...sec("retailers")}
                    label={t("products.field.stores")}
                    hint={form.retailers.length ? `— ${t("products.stores.count", { count: form.retailers.length })}` : undefined}
                  />
                  {!collapsed.has("retailers") && (
                    <div className="px-4 pb-4">
                      <RetailerList
                        retailers={form.retailers}
                        storeLibrary={storeLibrary}
                        storeRules={storeRules}
                        onChange={(r) => setForm((f) => withRetailerPrices({ ...f, retailers: r }))}
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
          <div className="flex gap-3 px-4 md:px-6 py-4 border-t border-[var(--border)] shrink-0">
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || saving || !canWrite}
              className={`${btn("primary")} flex-1`}
            >
              {t(saving ? "common.saving" : editingProduct ? "products.editor.saveChanges" : "products.add")}
            </button>
            <button
              onClick={closeModal}
              className={btn("ghost")}
            >
              {t("common.cancel")}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Crop Editor Modal ── */}
      {cropProduct && (
        <Modal
          onClose={() => setCropProduct(null)}
          label={t("crop.title")}
          panelClassName="rounded-2xl p-5 md:p-8 max-w-xl w-full max-h-[90dvh] md:max-h-[95vh] overflow-y-auto"
          closeOnScrim={false}
        >
          {/* Title, with the button that removes the crop */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-4">
            <h2 className="font-display text-xl font-light text-[var(--foreground)] min-w-0">{t("crop.title")}</h2>
            <div className="flex items-center gap-3 ml-auto">
              {cropProduct.cropData && canWrite && (
                <button
                  onClick={() => { handleCropClear(cropProduct); setCropProduct(null); }}
                  className={btn("danger")}
                >
                  {t("crop.remove")}
                </button>
              )}
              <button
                onClick={() => setCropProduct(null)}
                aria-label={t("common.close")}
                title={t("common.close")}
                className={BTN_ICON}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <ImageCropEditor
            imageUrl={cropProduct.imageUrl}
            productName={cropProduct.name}
            initialCrop={cropProduct.cropData}
            onSave={handleCropSave}
            onCancel={() => setCropProduct(null)}
            saving={cropSaving}
          />
        </Modal>
      )}

      {/* ── Group Variants Modal ── */}
      {groupModal.open && (
        <Modal
          onClose={() => setGroupModal({ open: false, entries: [] })}
          label={t("products.bulk.group")}
          panelClassName="rounded-2xl p-5 md:p-8 max-w-lg w-full max-h-[90dvh] md:max-h-[92vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-light text-[var(--foreground)]">
                {t(groupModal.existingGroupId ? "products.group.titleEdit" : "products.group.titleNew")}
              </h2>
              <p className="text-[11px] text-[var(--foreground-muted)] mt-1">
                {t("products.group.hint")}
              </p>
            </div>
            <button
              onClick={() => setGroupModal({ open: false, entries: [] })}
              aria-label={t("common.close")}
              title={t("common.close")}
              className={`${BTN_ICON} shrink-0`}
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
                  <Thumb src={p.imageUrl} bg={p.bgColor} />

                  {/* Name + swatch */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--foreground)] truncate">{p.name}</p>
                    <p className="text-[12px] text-[var(--foreground-muted)] truncate">{p.brand} · {f.money(p.priceMin)}</p>

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
                        title={t("products.group.swatch")}
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

                  {/* Primary: a state on the one that is, an action on the
                      rest. Pressing the primary itself changed nothing, so it
                      is a badge rather than a button. */}
                  <div className="shrink-0 text-center">
                    {entry.isPrimary ? (
                      <Badge tone="inverse">{t("products.badge.primary")}</Badge>
                    ) : (
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
                        className={btn("secondary", "sm")}
                      >
                        {t("products.group.setPrimary")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[12px] text-[var(--foreground-subtle)] mt-4">
            {rich(t("products.group.help"))}
          </p>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleGroupSave}
              disabled={grouping || !canWrite}
              className={`${btn("primary")} flex-1`}
            >
              {t(grouping ? "common.saving" : groupModal.existingGroupId ? "products.group.update" : "products.group.create")}
            </button>
            <button
              onClick={() => setGroupModal({ open: false, entries: [] })}
              className={btn("ghost")}
            >
              {t("common.cancel")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
