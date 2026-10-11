import BrowseClient from "./BrowseClient";
import { getAllColorGroups, readAllOutfits, readAllProducts } from "@/lib/data/db";
import { withTimeout } from "@/lib/server/with-timeout";
import type { ColorGroup } from "@/lib/types";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  // Only single values are meaningful; a repeated parameter keeps its first.
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") params[key] = first;
  }

  // A failed or slow read leaves that list out, and the client fetches it as
  // it always did — showing its own error state if that fails too.
  const [products, outfits, colorGroups] = await Promise.all([
    withTimeout(readAllProducts(), { products: [], error: "timed out" }, "browse products"),
    withTimeout(readAllOutfits(), { outfits: [], error: "timed out" }, "browse outfits"),
    withTimeout<ColorGroup[] | undefined>(getAllColorGroups(), undefined, "browse colour groups"),
  ]);

  return (
    <BrowseClient
      initial={{
        products: products.error ? undefined : products.products,
        outfits: outfits.error ? undefined : outfits.outfits,
        colorGroups,
        params,
      }}
    />
  );
}
