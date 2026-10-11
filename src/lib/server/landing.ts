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
import { brandPath, categoryPath, landingSlug, subcategoryPath } from "@/lib/landing-paths";
import { displayedPriceLabel } from "@/lib/seo";
import type { Product } from "@/lib/types";

/** Fewer products than this and the page is kept out of the index: too thin to rank, too thin to be worth landing on. */
export const LANDING_MIN_PRODUCTS = 6;

/** How many products a category or subcategory page lists; the rest are a link into the catalogue away. */
export const LANDING_MAX_PRODUCTS = 96;

export type LandingKind = "brand" | "category" | "subcategory";

export interface LandingLink {
  name: string;
  path: string;
  count: number;
}

export interface Landing {
  kind: LandingKind;
  name: string;
  path: string;
  /** The group a subcategory sits in. */
  parent?: { name: string; path: string };
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
  const sorted = [...products].sort(
    (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || a.name.localeCompare(b.name),
  );
  return { products: sorted, tree: tree.groups };
});

/** The spelling a brand is shown with: the most common one among its products. */
function brandName(products: Product[]): string {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

/** Products by brand slug. "Adidas" and "adidas" are one brand; "adidas Originals" is its own. */
function byBrand(products: Product[]): Map<string, Product[]> {
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const slug = landingSlug(p.brand ?? "");
    if (!slug) continue;
    const list = map.get(slug) ?? [];
    list.push(p);
    map.set(slug, list);
  }
  return map;
}

function landing(
  kind: LandingKind,
  name: string,
  path: string,
  products: Product[],
  browseHref: string,
  parent?: Landing["parent"],
): Landing {
  return { kind, name, path, products, indexable: products.length >= LANDING_MIN_PRODUCTS, browseHref, parent };
}

const browseQuery = (params: Record<string, string>) =>
  `/browse?${new URLSearchParams({ view: "pieces", ...params })}`;

export async function brandLanding(slug: string): Promise<Landing | undefined> {
  const { products } = await loadLandingCatalog();
  const list = byBrand(products).get(slug);
  if (!list?.length) return undefined;
  const name = brandName(list);
  return landing("brand", name, brandPath(name), list, browseQuery({ brand: name }));
}

function inGroup(p: Product, group: CategoryGroup, tree: CategoryGroup[]): boolean {
  return groupForProduct(p.category, p.subcategory, tree)?.id === group.id;
}

export async function categoryLanding(groupId: string): Promise<Landing | undefined> {
  const { products, tree } = await loadLandingCatalog();
  const group = tree.find((g) => g.id === groupId);
  if (!group) return undefined;
  const list = products.filter((p) => inGroup(p, group, tree));
  return landing("category", group.label, categoryPath(group.id), list, browseQuery({ category: group.id }));
}

export async function subcategoryLanding(groupId: string, slug: string): Promise<Landing | undefined> {
  const { products, tree } = await loadLandingCatalog();
  const group = tree.find((g) => g.id === groupId);
  const item = group?.items.find((i) => landingSlug(i.label) === slug);
  if (!group || !item) return undefined;
  const list = products.filter(
    (p) => inGroup(p, group, tree) && resolveSubcategory(p.category, p.subcategory, tree) === item.label,
  );
  return landing(
    "subcategory",
    item.label,
    subcategoryPath(group.id, item.label),
    list,
    browseQuery({ subcat: item.label }),
    { name: group.label, path: categoryPath(group.id) },
  );
}

/** Every landing page with at least one product — the brand index and the sitemap list them. */
export async function allLandings(): Promise<Landing[]> {
  const { products, tree } = await loadLandingCatalog();
  const out: Landing[] = [];
  for (const [, list] of byBrand(products)) {
    const name = brandName(list);
    out.push(landing("brand", name, brandPath(name), list, browseQuery({ brand: name })));
  }
  for (const group of tree) {
    const inThis = products.filter((p) => inGroup(p, group, tree));
    if (!inThis.length) continue;
    out.push(landing("category", group.label, categoryPath(group.id), inThis, browseQuery({ category: group.id })));
    for (const item of group.items) {
      const list = inThis.filter((p) => resolveSubcategory(p.category, p.subcategory, tree) === item.label);
      if (!list.length) continue;
      out.push(
        landing("subcategory", item.label, subcategoryPath(group.id, item.label), list, browseQuery({ subcat: item.label }), {
          name: group.label,
          path: categoryPath(group.id),
        }),
      );
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

  if (page.kind === "brand") {
    const kinds = top(products, (p) => resolveSubcategory(p.category, p.subcategory, tree)?.toLowerCase() ?? p.category, 3);
    const kindTitle = kinds.slice(0, 2).map((k) => k.replace(/\b\w/g, (c) => c.toUpperCase()));
    return {
      title: kindTitle.length ? `${name} ${listPhrase(kindTitle).replace(" and ", " & ")}` : name,
      heading: name,
      intro:
        `${n} ${name} ${n === 1 ? "piece" : "pieces"}${kinds.length ? `, mostly ${listPhrase(kinds)}` : ""}${forWhom}${prices}.` +
        `${storeBit} Compare prices across stores, see how to wear each piece and buy from the original retailer.`,
    };
  }

  const brands = top(products, (p) => p.brand, 3);
  const moreBrands = distinct(products, (p) => p.brand) > brands.length ? "more" : undefined;
  const what = name.toLowerCase();
  const parentBit = page.parent ? ` in ${page.parent.name.toLowerCase()}` : "";
  return {
    title: brands.length ? `${name} from ${listPhrase(brands).replace(" and ", " & ")}` : name,
    heading: name,
    intro:
      `${n} ${n === 1 ? "piece" : "pieces"} of ${what}${parentBit}${forWhom}${brands.length ? ` from ${listPhrase(brands, moreBrands)}` : ""}${prices}.` +
      `${storeBit} Compare prices across stores and buy from the original retailer.`,
  };
}

/**
 * Pages to link to from this one: for a brand, the categories its products are
 * in; for a category, its subcategories and its biggest brands.
 */
export async function relatedLinks(page: Landing): Promise<{ title: string; links: LandingLink[] }[]> {
  const { products, tree } = await loadLandingCatalog();
  const count = (list: Product[], test: (p: Product) => boolean) => list.filter(test).length;
  const sections: { title: string; links: LandingLink[] }[] = [];

  if (page.kind === "brand") {
    const links: LandingLink[] = [];
    for (const group of tree) {
      for (const item of group.items) {
        const c = count(page.products, (p) => inGroup(p, group, tree) && resolveSubcategory(p.category, p.subcategory, tree) === item.label);
        if (c) links.push({ name: item.label, path: subcategoryPath(group.id, item.label), count: c });
      }
    }
    if (links.length) sections.push({ title: "Shop by category", links: links.sort((a, b) => b.count - a.count) });
    return sections;
  }

  const group = tree.find((g) => categoryPath(g.id) === (page.parent?.path ?? page.path));
  if (group && page.kind === "category") {
    const subs = group.items
      .map((item) => ({
        name: item.label,
        path: subcategoryPath(group.id, item.label),
        count: count(page.products, (p) => resolveSubcategory(p.category, p.subcategory, tree) === item.label),
      }))
      .filter((l) => l.count > 0);
    if (subs.length) sections.push({ title: `${group.label} by type`, links: subs });
  }
  if (group && page.kind === "subcategory") {
    const inThisGroup = products.filter((p) => inGroup(p, group, tree));
    const siblings = group.items
      .filter((item) => item.label !== page.name)
      .map((item) => ({
        name: item.label,
        path: subcategoryPath(group.id, item.label),
        count: count(inThisGroup, (p) => resolveSubcategory(p.category, p.subcategory, tree) === item.label),
      }))
      .filter((l) => l.count > 0);
    if (siblings.length) sections.push({ title: `More ${group.label.toLowerCase()}`, links: siblings });
  }

  const brandCounts = byBrand(page.products);
  const brands = [...brandCounts.values()]
    .map((list) => ({ name: brandName(list), path: brandPath(brandName(list)), count: list.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 12);
  if (brands.length) sections.push({ title: "Brands", links: brands });
  return sections;
}
