/**
 * The catalogue's landing pages: one per brand, per category group and per
 * subcategory, each a server-rendered list of its products with its own title,
 * text and canonical (docs/SEO_PLAN.md, SEO-17).
 *
 * These are what a search for "timberland boots" or "balenciaga sneakers" can
 * land on. Before them the only lists were `/browse?brand=…` filter states — one
 * client page, empty in its HTML, with the homepage as its canonical.
 *
 * Everything is derived from the catalogue as it is read: a brand gets a page
 * as soon as it has a product, and the page is offered to search engines once
 * it has enough of them to be worth one (`LANDING_MIN_PRODUCTS`).
 */
import { cache } from "react";
import { readAllProducts } from "@/lib/data/db";
import { groupForProduct, resolveSubcategory, type CategoryGroup } from "@/lib/categories";
import { loadCategoryTree } from "@/lib/server/category-tree";
import {
  BRAND_LINES,
  brandPath,
  brandSubcategoryPath,
  categoryPath,
  landingSlug,
  subcategoryPath,
} from "@/lib/landing-paths";
import { displayedPriceLabel, titleFits } from "@/lib/seo";
import type { Product } from "@/lib/types";

/** Fewer products than this and the page is kept out of the index: too thin to rank, too thin to be worth landing on. */
export const LANDING_MIN_PRODUCTS = 6;

/** How many products a category or subcategory page lists; the rest are a link into the catalogue away. */
export const LANDING_MAX_PRODUCTS = 96;

export type LandingKind = "brand" | "category" | "subcategory" | "brand-subcategory";

export interface LandingLink {
  name: string;
  path: string;
  count: number;
}

export interface Landing {
  kind: LandingKind;
  name: string;
  path: string;
  /** The group a subcategory sits in; the brand of a line or of a brand's subcategory. */
  parent?: { name: string; path: string };
  /** A brand's lines — "adidas Originals" on the adidas page (BRAND_LINES). */
  lines?: LandingLink[];
  /** The subcategory a page is about, with its group. */
  facet?: { label: string; groupId: string };
  /** Every product the page covers, newest first. */
  products: Product[];
  indexable: boolean;
  /** The /browse filter state showing the same products, for "see all". */
  browseHref: string;
}

/**
 * The catalogue and the category tree, read once per render. Newest first, so
 * the order — unlike the storefront's shuffled one — is the same on every
 * render and a page's list doesn't reshuffle between crawls.
 */
export const loadLandingCatalog = cache(async (): Promise<{ products: Product[]; tree: CategoryGroup[] }> => {
  const [{ products, error }, tree] = await Promise.all([readAllProducts(), loadCategoryTree()]);
  if (error) throw new Error(`Could not read the catalogue: ${error}`);
  return { products: [...products].sort(newestFirst), tree: tree.groups };
});

function newestFirst(a: Product, b: Product): number {
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || a.name.localeCompare(b.name);
}

/** The spelling a brand is shown with: the most common one among its products. */
function brandName(products: Product[]): string {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

interface BrandGroup {
  name: string;
  /** Its own products and, for a brand with lines, theirs too — newest first. */
  products: Product[];
  /** For a line: the brand it belongs to. */
  parent?: string;
  /** For a brand: its lines that have products. */
  lines: LandingLink[];
}

/**
 * Brands by slug. "Adidas" and "adidas" are one brand. A line in BRAND_LINES
 * keeps a page of its own and is folded into its parent's as well.
 */
function brandGroups(products: Product[]): Map<string, BrandGroup> {
  const groups = new Map<string, BrandGroup>();
  for (const p of products) {
    const slug = landingSlug(p.brand ?? "");
    if (!slug) continue;
    const g = groups.get(slug) ?? { name: "", products: [], lines: [] };
    g.products.push(p);
    groups.set(slug, g);
  }
  for (const g of groups.values()) g.name = brandName(g.products);

  for (const [lineSlug, { parent, parentName }] of Object.entries(BRAND_LINES)) {
    const line = groups.get(lineSlug);
    if (!line) continue;
    const head = groups.get(parent) ?? { name: parentName, products: [], lines: [] };
    head.products = [...head.products, ...line.products.filter((p) => !head.products.includes(p))].sort(newestFirst);
    head.lines.push({ name: line.name, path: brandPath(line.name), count: line.products.length });
    groups.set(parent, head);
    line.parent = head.name;
  }
  return groups;
}

/**
 * A page is offered to search engines once it has enough products — and, for
 * a page inside another (a brand's boots, a group's subcategory), only when it
 * lists fewer than that page: the same list under two addresses is a duplicate.
 */
function landing(
  kind: LandingKind,
  name: string,
  path: string,
  products: Product[],
  browseHref: string,
  extra: Partial<Pick<Landing, "parent" | "lines" | "facet">> & { outerCount?: number } = {},
): Landing {
  const { outerCount, ...rest } = extra;
  const indexable =
    products.length >= LANDING_MIN_PRODUCTS && (outerCount === undefined || products.length < outerCount);
  return { kind, name, path, products, indexable, browseHref, ...rest };
}

const browseQuery = (params: Record<string, string>) =>
  `/browse?${new URLSearchParams({ view: "pieces", ...params })}`;

function inGroup(p: Product, group: CategoryGroup, tree: CategoryGroup[]): boolean {
  return groupForProduct(p.category, p.subcategory, tree)?.id === group.id;
}

/** The subcategories the products fall into, each with its group and products, biggest first. */
function subcategoriesOf(
  products: Product[],
  tree: CategoryGroup[],
): { label: string; group: CategoryGroup; products: Product[] }[] {
  const out = new Map<string, { label: string; group: CategoryGroup; products: Product[] }>();
  for (const p of products) {
    const group = groupForProduct(p.category, p.subcategory, tree);
    const label = resolveSubcategory(p.category, p.subcategory, tree);
    if (!group || !label) continue;
    const key = `${group.id}/${label}`;
    const entry = out.get(key) ?? { label, group, products: [] };
    entry.products.push(p);
    out.set(key, entry);
  }
  return [...out.values()].sort((a, b) => b.products.length - a.products.length || a.label.localeCompare(b.label));
}

function brandPage(g: BrandGroup): Landing {
  return landing("brand", g.name, brandPath(g.name), g.products, browseQuery({ brand: g.name }), {
    ...(g.parent ? { parent: { name: g.parent, path: brandPath(g.parent) } } : {}),
    ...(g.lines.length ? { lines: g.lines } : {}),
  });
}

function brandSubPage(g: BrandGroup, sub: { label: string; group: CategoryGroup; products: Product[] }): Landing {
  return landing(
    "brand-subcategory",
    `${g.name} ${sub.label}`,
    brandSubcategoryPath(g.name, sub.label),
    sub.products,
    browseQuery({ brand: g.name, subcat: sub.label }),
    {
      parent: { name: g.name, path: brandPath(g.name) },
      facet: { label: sub.label, groupId: sub.group.id },
      outerCount: g.products.length,
    },
  );
}

function categoryPage(group: CategoryGroup, products: Product[]): Landing {
  return landing("category", group.label, categoryPath(group.id), products, browseQuery({ category: group.id }));
}

function subcategoryPage(group: CategoryGroup, label: string, products: Product[], groupCount: number): Landing {
  return landing("subcategory", label, subcategoryPath(group.id, label), products, browseQuery({ subcat: label }), {
    parent: { name: group.label, path: categoryPath(group.id) },
    facet: { label, groupId: group.id },
    outerCount: groupCount,
  });
}

export async function brandLanding(slug: string): Promise<Landing | undefined> {
  const { products } = await loadLandingCatalog();
  const g = brandGroups(products).get(slug);
  return g?.products.length ? brandPage(g) : undefined;
}

export async function brandSubcategoryLanding(slug: string, subSlug: string): Promise<Landing | undefined> {
  const { products, tree } = await loadLandingCatalog();
  const g = brandGroups(products).get(slug);
  if (!g) return undefined;
  const sub = subcategoriesOf(g.products, tree).find((s) => landingSlug(s.label) === subSlug);
  return sub ? brandSubPage(g, sub) : undefined;
}

export async function categoryLanding(groupId: string): Promise<Landing | undefined> {
  const { products, tree } = await loadLandingCatalog();
  const group = tree.find((g) => g.id === groupId);
  if (!group) return undefined;
  return categoryPage(group, products.filter((p) => inGroup(p, group, tree)));
}

export async function subcategoryLanding(groupId: string, slug: string): Promise<Landing | undefined> {
  const { products, tree } = await loadLandingCatalog();
  const group = tree.find((g) => g.id === groupId);
  const item = group?.items.find((i) => landingSlug(i.label) === slug);
  if (!group || !item) return undefined;
  const inThis = products.filter((p) => inGroup(p, group, tree));
  const list = inThis.filter((p) => resolveSubcategory(p.category, p.subcategory, tree) === item.label);
  return subcategoryPage(group, item.label, list, inThis.length);
}

/** Every landing page with at least one product — the brand index and the sitemap list them. */
export async function allLandings(): Promise<Landing[]> {
  const { products, tree } = await loadLandingCatalog();
  return landingsFrom(products, tree);
}

/** `allLandings` for a given catalogue: pure, so it can be checked without a database. */
export function landingsFrom(products: Product[], tree: CategoryGroup[]): Landing[] {
  const out: Landing[] = [];
  for (const g of brandGroups(products).values()) {
    out.push(brandPage(g));
    for (const sub of subcategoriesOf(g.products, tree)) out.push(brandSubPage(g, sub));
  }
  for (const group of tree) {
    const inThis = products.filter((p) => inGroup(p, group, tree));
    if (!inThis.length) continue;
    out.push(categoryPage(group, inThis));
    for (const item of group.items) {
      const list = inThis.filter((p) => resolveSubcategory(p.category, p.subcategory, tree) === item.label);
      if (list.length) out.push(subcategoryPage(group, item.label, list, inThis.length));
    }
  }
  return out;
}

// ── What a page says about its products ─────────────────────────────────────

/**
 * Names in a sentence: "a", "a and b", "a, b and c" — or, when the list is a
 * top few of more, "a, b, c and others".
 */
export function listPhrase(names: string[], others?: string): string {
  if (others) return `${names.join(", ")} and ${others}`;
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** How many distinct non-empty values the products have. */
function distinct(products: Product[], key: (p: Product) => string | undefined): number {
  return new Set(products.map(key).filter(Boolean)).size;
}

/** The most common values among the products, most frequent first. */
function top(products: Product[], key: (p: Product) => string | undefined, n: number): string[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    const v = key(p);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([v]) => v);
}

/** Lowest and highest price, as the page prints prices. */
function priceRange(products: Product[]): { from: string; to: string } | undefined {
  const priced = products.filter((p) => p.priceMin > 0);
  if (!priced.length) return undefined;
  const low = priced.reduce((a, b) => (a.priceMin <= b.priceMin ? a : b));
  const high = priced.reduce((a, b) => ((a.priceMax || a.priceMin) >= (b.priceMax || b.priceMin) ? a : b));
  return {
    from: displayedPriceLabel(low.priceMin, low.currency),
    to: displayedPriceLabel(high.priceMax || high.priceMin, high.currency),
  };
}

export interface LandingCopy {
  title: string;
  heading: string;
  intro: string;
}

/**
 * Title, heading and the opening paragraph, from the products themselves:
 * how many, what kinds, which brands, the price range and where they're sold.
 * Facts the page can show, not filler — and different for every page, because
 * every page's products are.
 */
export function landingCopy(page: Landing, tree: CategoryGroup[]): LandingCopy {
  const { products, name } = page;
  const n = products.length;
  const range = priceRange(products);
  const prices = range ? (range.from === range.to ? ` at ${range.from}` : `, priced from ${range.from} to ${range.to}`) : "";
  const storeOf = (p: Product) => p.retailers?.[0]?.name;
  const stores = top(products, storeOf, 3);
  const moreStores = distinct(products, storeOf) > stores.length ? "others" : undefined;
  const storeBit = stores.length ? ` Sold by ${listPhrase(stores, moreStores)}.` : "";
  const genders = top(products, (p) => (p.gender === "unisex" ? undefined : p.gender), 2);
  const forWhom = genders.length === 2 ? " for men and women" : genders.length === 1 ? ` for ${genders[0]}` : "";
  // The longest of the titles that still shows whole beside « | GOO Fashion»
  // in a results page, else the shortest: "Outerwear from Yori, Balenciaga &
  // Manière De Voir" is cut off there, "Outerwear from Yori & Balenciaga" is not.
  const fitted = (titles: string[]) => titles.find(titleFits) ?? titles[titles.length - 1];
  const named = (lead: string, names: string[]) =>
    names.map((_, i) => `${lead}${listPhrase(names.slice(0, names.length - i)).replace(" and ", " & ")}`);

  if (page.kind === "brand") {
    const kinds = top(products, (p) => resolveSubcategory(p.category, p.subcategory, tree)?.toLowerCase() ?? p.category, 3);
    const kindTitle = kinds.slice(0, 2).map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()));
    const lines = page.lines?.length ? `, including ${listPhrase(page.lines.map((l) => l.name))}` : "";
    const lineOf = page.parent ? ` — a line of ${page.parent.name}` : "";
    return {
      title: kindTitle.length ? fitted(named(`${name} `, kindTitle)) : name,
      heading: name,
      intro:
        `${n} ${name} ${n === 1 ? "piece" : "pieces"}${lineOf}${lines}${kinds.length ? `, mostly ${listPhrase(kinds)}` : ""}${forWhom}${prices}.` +
        `${storeBit} Compare prices across stores, see how to wear each piece and buy from the original retailer.`,
    };
  }

  if (page.kind === "brand-subcategory" && page.parent && page.facet) {
    return {
      title: fitted([
        `${name}${genders.length === 2 ? " for Men & Women" : genders.length === 1 ? ` for ${genders[0] === "men" ? "Men" : "Women"}` : ""}`,
        name,
      ]),
      heading: name,
      intro:
        `${n} ${page.parent.name} ${page.facet.label.toLowerCase()}${forWhom}${prices}.` +
        `${storeBit} Compare prices across stores and buy from the original retailer.`,
    };
  }

  const brands = top(products, (p) => p.brand, 3);
  const moreBrands = distinct(products, (p) => p.brand) > brands.length ? "more" : undefined;
  const what = name.toLowerCase();
  const parentBit = page.parent ? ` in ${page.parent.name.toLowerCase()}` : "";
  return {
    title: brands.length ? fitted(named(`${name} from `, brands)) : name,
    heading: name,
    intro:
      `${n} ${n === 1 ? "piece" : "pieces"} of ${what}${parentBit}${forWhom}${brands.length ? ` from ${listPhrase(brands, moreBrands)}` : ""}${prices}.` +
      `${storeBit} Compare prices across stores and buy from the original retailer.`,
  };
}

/**
 * Pages to link to from this one: a brand's lines and the kinds of thing it
 * makes; a category's subcategories and its biggest brands; a subcategory's
 * neighbours and the brands that make it.
 */
export async function relatedLinks(page: Landing): Promise<{ title: string; links: LandingLink[] }[]> {
  const { products, tree } = await loadLandingCatalog();
  const brands = brandGroups(products);
  const sections: { title: string; links: LandingLink[] }[] = [];

  if (page.kind === "brand" || page.kind === "brand-subcategory") {
    const brandSlug = landingSlug(page.kind === "brand" ? page.name : (page.parent?.name ?? ""));
    const g = brands.get(brandSlug);
    if (!g) return sections;
    if (page.kind === "brand" && g.lines.length) sections.push({ title: "Lines", links: g.lines });
    const subs = subcategoriesOf(g.products, tree)
      .filter((s) => s.label !== page.facet?.label)
      .map((s) => ({ name: s.label, path: brandSubcategoryPath(g.name, s.label), count: s.products.length }));
    if (subs.length) {
      sections.push({ title: page.kind === "brand" ? "Shop by category" : `More from ${g.name}`, links: subs });
    }
    if (page.kind === "brand-subcategory" && page.facet) {
      const all = products.filter((p) => resolveSubcategory(p.category, p.subcategory, tree) === page.facet!.label);
      sections.push({
        title: "See also",
        links: [
          { name: `All ${page.facet.label.toLowerCase()}`, path: subcategoryPath(page.facet.groupId, page.facet.label), count: all.length },
          { name: `All ${g.name}`, path: brandPath(g.name), count: g.products.length },
        ],
      });
    }
    return sections;
  }

  const group = tree.find((g) => categoryPath(g.id) === (page.parent?.path ?? page.path));
  if (group && page.kind === "category") {
    const subs = subcategoriesOf(page.products, tree).map((s) => ({
      name: s.label,
      path: subcategoryPath(group.id, s.label),
      count: s.products.length,
    }));
    if (subs.length) sections.push({ title: `${group.label} by type`, links: subs });
  }
  if (group && page.kind === "subcategory") {
    const siblings = subcategoriesOf(products.filter((p) => inGroup(p, group, tree)), tree)
      .filter((s) => s.label !== page.name)
      .map((s) => ({ name: s.label, path: subcategoryPath(group.id, s.label), count: s.products.length }));
    if (siblings.length) sections.push({ title: `More ${group.label.toLowerCase()}`, links: siblings });
  }

  // Brands of this page's products: on a subcategory, straight to that brand's
  // pieces of it ("Timberland Boots"), elsewhere to the brand.
  const counts = new Map<string, number>();
  for (const p of page.products) {
    const slug = landingSlug(p.brand ?? "");
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  const brandLinks = [...counts.entries()]
    .map(([slug, count]) => {
      const name = brands.get(slug)?.name ?? slug;
      const path = page.kind === "subcategory" ? brandSubcategoryPath(name, page.name) : brandPath(name);
      return { name, path, count };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12);
  if (brandLinks.length) sections.push({ title: "Brands", links: brandLinks });
  return sections;
}
