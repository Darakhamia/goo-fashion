import type { ColorGroup, Product, Category, StyleKeyword, Retailer, Gender } from "@/lib/types";
import { groupForProduct, resolveSubcategory, type CategoryGroup } from "@/lib/categories";
import type { Key } from "@/app/goo-studio/_i18n";

/*
 * The product form: its state, what it is filled from and what it saves
 * (GS6-1). Shared by the product page and the Products list, which still
 * needs a few of the same tables (genders, color groups, the category path).
 */

export const SUGGESTED_BRANDS = [
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
export const SIZE_PRESETS: Record<string, { sizes: string[] }> = {
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

/** "Footwear › Boots" for a stored pair, for the table and the page header. */
export function categoryPath(category: string, subcategory: string | undefined, tree: CategoryGroup[]): string {
  const group = groupForProduct(category, subcategory, tree);
  const sub = resolveSubcategory(category, subcategory, tree);
  if (!group) return category;
  return sub ? `${group.label} › ${sub}` : group.label;
}

export const GENDERS: { value: Gender; label: Key }[] = [
  { value: "women", label: "products.gender.women" },
  { value: "men", label: "products.gender.men" },
  { value: "unisex", label: "products.gender.unisex" },
];

export const AVAILABILITY_OPTIONS = ["in stock", "low stock", "sold out"] as const;
export type Availability = (typeof AVAILABILITY_OPTIONS)[number];

/** What each stored availability reads as; the value saved stays the English one. */
export const AVAILABILITY_LABEL: Record<Availability, Key> = {
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
export const EXAMPLE = {
  url: "https://…",
  storeUrl: "https://zara.com/product/…",
  sizes: "XS, S, M, L, XL",
  material: "100% Wool",
  colors: "Black, White, Camel",
};

/** How long the "New" badge shows after a product is added (see db.ts isWithinLastWeek). */
export const NEW_ARRIVAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Static fallback color groups — shown even before Supabase is configured.
// IDs match the seed data in supabase-schema.sql (sort_order order).
export const DEFAULT_COLOR_GROUPS: ColorGroup[] = [
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

/** A color group's swatch: a flat color, or a wheel for "Multicolor". */
export function swatchBackground(hex: string): string {
  return hex === "#multicolor" ? "conic-gradient(red,orange,yellow,green,blue,violet,red)" : hex;
}

export interface RetailerForm {
  name: string;
  url: string;
  price: string;
  /**
   * What `price` is in — the store's own currency. An imported hryvnia store
   * arrives as "4000" + "UAH", and the catalogue price above is that converted
   * to dollars; reading "4000" as dollars is the bug this field exists to stop.
   */
  currency: string;
  availability: Availability;
  isOfficial: boolean;
  rating: string;       // "4.5" or ""
  reviewCount: string;  // "1234" or ""
}

export const emptyRetailer = (): RetailerForm => ({
  name: "", url: "", price: "", currency: "USD", availability: "in stock", isOfficial: false, rating: "", reviewCount: "",
});

export interface ProductFormState {
  name: string;
  brand: string;
  category: Category;
  /** Filter subcategory, e.g. "Sneakers" under footwear. "" = not set. */
  subcategory: string;
  gender: Gender | "";
  description: string;
  priceMin: string;
  priceMax: string;
  /** Photo URLs, the first one the main photo. No empty rows. */
  images: string[];
  /** "Color name" on the page: the product's own color words, comma-separated. */
  colorsRaw: string;
  sizes: string[];
  material: string;
  styleKeywords: StyleKeyword[];
  retailers: RetailerForm[];
  isNew: boolean;
  /** HEX swatch color for this product (used when it's part of a variant group) */
  variantColorHex: string;
  /** IDs of other products linked to this one as color variants */
  linkedProductIds: string[];
  /** "Storefront color filters": color group IDs from the color_groups table */
  colorGroupIds: number[];
}

export const defaultForm: ProductFormState = {
  name: "",
  brand: "",
  category: "outerwear",
  subcategory: "Jackets",
  gender: "",
  description: "",
  priceMin: "",
  priceMax: "",
  images: [],
  colorsRaw: "",
  sizes: [],
  material: "",
  styleKeywords: ["minimal"],
  retailers: [],
  isNew: false,
  variantColorHex: "#888888",
  linkedProductIds: [],
  colorGroupIds: [],
};

export function deriveColors(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** The form a stored product fills; `linkedIds` are the other colors of its group. */
export function productToForm(product: Product, linkedIds: string[], tree: CategoryGroup[]): ProductFormState {
  return {
    name: product.name,
    brand: product.brand,
    category: product.category,
    subcategory: resolveSubcategory(product.category, product.subcategory, tree) ?? "",
    gender: (product.gender ?? "") as Gender | "",
    description: product.description ?? "",
    priceMin: String(product.priceMin ?? ""),
    priceMax: String(product.priceMax ?? ""),
    images: (product.images?.length ? product.images : [product.imageUrl ?? ""]).filter((u) => u.trim()),
    colorsRaw: product.colors?.join(", ") ?? "",
    sizes: product.sizes ?? [],
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
  };
}

/**
 * The fields PUT/POST /api/products take. `colorHex`, `variantGroupId` and
 * `isGroupPrimary` are not among them: the group route sets those after the
 * product is saved.
 */
export function formToPayload(form: ProductFormState): Partial<Product> {
  return {
    name: form.name.trim(),
    brand: form.brand as Product["brand"],
    category: form.category,
    // Always sent, so clearing it in the form clears it on the row too.
    subcategory: form.subcategory,
    gender: form.gender ? (form.gender as Gender) : undefined,
    description: form.description.trim(),
    priceMin: parseFloat(form.priceMin) || 0,
    priceMax: parseFloat(form.priceMax) || parseFloat(form.priceMin) || 0,
    // No stand-in photo: a product saved without one stays without one, so
    // the "No image" filter finds it instead of the storefront showing a
    // stock picture of somebody else's jacket.
    imageUrl: form.images[0] ?? "",
    images: form.images,
    colors: deriveColors(form.colorsRaw),
    sizes: form.sizes,
    material: form.material.trim(),
    styleKeywords: form.styleKeywords,
    retailers: form.retailers.map((r) => ({
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
    isNew: form.isNew,
    isSaved: false,
    currency: "USD",
    colorGroupIds: form.colorGroupIds,
  };
}

/** Sizes in the order of the preset; ones the preset does not know go last. */
export function sortSizes(sizes: string[], preset: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ai = preset.indexOf(a), bi = preset.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** The size chart a subcategory offers, else its category's. */
export function sizePreset(form: Pick<ProductFormState, "category" | "subcategory">, tree: CategoryGroup[]): string[] {
  // The subcategory's own chart wins: Belts and Watches are both
  // `accessories`, and only one of them has sizes.
  const sub = tree.flatMap((g) => g.items).find((i) => i.label === form.subcategory);
  return sub?.sizes?.length ? sub.sizes : SIZE_PRESETS[form.category]?.sizes ?? [];
}
