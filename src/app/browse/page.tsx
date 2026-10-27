import type { Metadata } from "next";
import { cache } from "react";
import BrowseClient, { type BrowseInitial } from "./BrowseClient";
import { getAllColorGroups, readAllOutfits, readAllProducts } from "@/lib/data/db";
import { toListOutfit, toListProduct } from "@/lib/data/list-product";
import { withTimeout } from "@/lib/server/with-timeout";
import { loadCategoryTree } from "@/lib/server/category-tree";
import { brandPath, brandSubcategoryPath, categoryPath, subcategoryPath } from "@/lib/landing-paths";
import { pageMetadata } from "@/lib/seo";
import { allLandings } from "@/lib/server/landing";
import { allOutfitLandings } from "@/lib/server/outfit-landing";
import type { ColorGroup, Product } from "@/lib/types";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Only single values are meaningful; a repeated parameter keeps its first. */
function singleValues(query: Record<string, string | string[] | undefined>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") params[key] = first;
  }
  return params;
}

// The storefront's catalogue read, in its shuffled "featured" order. Metadata
// asks the landing pages instead (lib/server/landing), which sort it newest first.
const readCatalog = cache(() =>
  withTimeout(readAllProducts(), { products: [], error: "timed out" }, "browse products"),
);

const TITLE = "Browse Clothing, Shoes & Outfits";
const DESCRIPTION =
  "Clothing, shoes and accessories from leading brands in one catalog, plus ready-made outfits. Compare prices across stores and buy from the original retailer.";

/**
 * Which address stands for a filtered view (docs/SEO_PLAN.md, SEO-18).
 *
 * - No filter: /browse itself. The outfits tab alone: its own address.
 * - A filter, or a brand with a subcategory, that an indexed landing page
 *   covers: that page, which lists the same products in HTML of its own.
 *   Likewise the outfits tab with one style: that style's outfit ideas.
 * - Anything else (a search, a colour, other combinations): kept out of the
 *   index, its links still followed — a crawler that finds every combination
 *   of filters would otherwise index thousands of near-copies.
 */
async function canonicalFor(params: Record<string, string>): Promise<{ path: string; noindex?: boolean }> {
  const facets = Object.keys(params).filter((k) => !(k === "view" && params.view === "pieces"));
  if (facets.length === 0) return { path: "/browse" };
  if (facets.length === 1 && facets[0] === "view" && params.view === "outfits") {
    return { path: "/browse?view=outfits" };
  }

  const only = (...keys: string[]) => facets.length === keys.length && keys.every((k) => facets.includes(k));
  if (only("view", "style") && params.view === "outfits") {
    const styles = await withTimeout(allOutfitLandings(), [], "browse canonical");
    const target = styles.find((l) => l.indexable && l.style === params.style.toLowerCase());
    if (target) return { path: target.path };
  }
  const candidates: string[] = [];
  if (only("brand")) candidates.push(brandPath(params.brand));
  if (only("category")) candidates.push(categoryPath(params.category));
  if (only("brand", "subcat")) candidates.push(brandSubcategoryPath(params.brand, params.subcat));
  if (only("subcat")) {
    const tree = await loadCategoryTree();
    const group = tree.groups.find((g) => g.items.some((i) => i.label === params.subcat));
    if (group) candidates.push(subcategoryPath(group.id, params.subcat));
  }
  if (candidates.length) {
    // Only a landing page that is itself indexed: pointing at one that isn't
    // would contradict its own noindex.
    const landings = await withTimeout(allLandings(), [], "browse canonical");
    const target = landings.find((l) => l.indexable && candidates.includes(l.path));
    if (target) return { path: target.path };
  }
  return { path: params.view === "outfits" ? "/browse?view=outfits" : "/browse", noindex: true };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = singleValues(await searchParams);
  const { path, noindex } = await canonicalFor(params);
  if (params.view === "outfits") {
    return pageMetadata({
      title: "Outfit Ideas",
      description: "Ready-made outfits put together from pieces across stores, by our stylists and the AI stylist. See the total price and shop each piece.",
      path,
      noindex,
    });
  }
  return pageMetadata({ title: TITLE, description: DESCRIPTION, path, noindex });
}

/** Two pages of cards: what the first screen shows, and the next one's start. */
const FIRST_SCREEN = 40;

/** URL parameters that filter the pieces (BrowseClient's `filtersFromParams`). */
const PIECE_FILTERS = ["search", "subcat", "category", "color", "gender", "brand", "ai", "style"];

/**
 * The pieces written into the page.
 *
 * Every prop here is serialised into the HTML and parsed before the page can
 * be used, and the whole catalogue — 4,000 pieces, a couple of thousand cards
 * once colourways are grouped — made that page megabytes long for a first
 * screen of twenty cards. A plain /browse now carries its first two pages, and
 * the client fetches the rest from /api/products, which answers from the
 * server's cached catalogue. A filtered link keeps the whole list, since its
 * matches can be anywhere in it. Either way as lists carry pieces
 * (lib/data/list-product), not as the database holds them.
 */
function firstScreen(
  read: { products: Product[]; error: string | null },
  params: Record<string, string>,
): Pick<BrowseInitial, "products" | "productsPartial" | "productsTotal"> {
  if (read.error) return {};
  const all = read.products;
  if (PIECE_FILTERS.some((k) => params[k]) || all.length <= FIRST_SCREEN) {
    return { products: all.map(toListProduct) };
  }
  return {
    products: all.slice(0, FIRST_SCREEN).map(toListProduct),
    productsPartial: true,
    productsTotal: all.length,
  };
}

/**
 * The catalogue, rendered on the server. It used to be a client page that
 * fetched /api/products after load — and /api/ is closed in robots.txt, so to a
 * search engine /browse was a header, a footer and the word "Browse", with no
 * link to a single product (docs/SEO_PLAN.md, SEO-16).
 *
 * The page reads the query string, so it renders per request: the same one
 * catalogue read the client used to make through the API, now made here.
 * Filtering, sorting and paging stay in the client component.
 */
export default async function BrowsePage({ searchParams }: Props) {
  const query = await searchParams;
  const params = singleValues(query);

  // A failed or slow read leaves that list out, and the client fetches it as
  // it always did — showing its own error state if that fails too.
  const [products, outfits, colorGroups] = await Promise.all([
    readCatalog(),
    withTimeout(readAllOutfits(), { outfits: [], error: "timed out" }, "browse outfits"),
    withTimeout<ColorGroup[] | undefined>(getAllColorGroups(), undefined, "browse colour groups"),
  ]);

  return (
    <BrowseClient
      initial={{
        ...firstScreen(products, params),
        outfits: outfits.error ? undefined : outfits.outfits.map(toListOutfit),
        colorGroups,
        params,
      }}
    />
  );
}
