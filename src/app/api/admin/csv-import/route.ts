import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { logAdminAction } from "@/lib/server/audit";
import { droppedColumnsWarning, importParsedProduct } from "@/lib/server/parser/import-product";
import { getAiSettings } from "@/lib/server/parser/configs";
import { loadRetailerRules, resolveRetailer, type RetailerRule } from "@/lib/server/retailer-domains";
import { normalizeGtin } from "@/lib/server/product-fields";
import {
  canRefreshOnly,
  groupUrls,
  MAX_CHECK_URLS,
  MAX_IMPORT_GROUPS,
  type CSVImportGroup,
  type CSVMappedRow,
} from "@/lib/csv-import";
import type { Product } from "@/lib/types";

// The feed itself is read in the browser (`@/lib/csv-import`); this route only
// answers which links the catalogue already has and writes batches of grouped
// products. A batch is up to MAX_IMPORT_GROUPS products, each through the full
// import pipeline — photo mirroring, colour sampling, the duplicate search.
export const maxDuration = 300;

/**
 * Links per `.in()` filter: they travel in the query string, which has a length
 * limit, and an affiliate link percent-encoded again is a few hundred characters.
 */
const LOOKUP_SLICE = 10;

const isHttpUrl = (u: unknown): u is string => typeof u === "string" && /^https?:\/\//.test(u);

type LinkRow = { source_url?: string | null; retailers?: { url?: unknown }[] | null };
type LinkAnswer = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** jsonb containment of one link in `retailers`, as the value `cs` takes. */
const retailerLink = (url: string) => JSON.stringify([{ url }]);

/**
 * Products whose "Where to buy" holds one of these links: one `or` of
 * containments for the lot. A term ends at a comma or a closing parenthesis,
 * so a link carrying one (or whitespace) is asked on its own instead.
 */
function retailerLinkQueries(slice: string[]): LinkAnswer[] {
  const plain = slice.filter((u) => !/[,()\s]/.test(u));
  const odd = slice.filter((u) => /[,()\s]/.test(u));
  const queries: LinkAnswer[] = odd.map((u) =>
    supabase!.from("products").select("retailers").contains("retailers", retailerLink(u)),
  );
  if (plain.length) {
    queries.push(
      supabase!
        .from("products")
        .select("retailers")
        .or(plain.map((u) => `retailers.cs.${retailerLink(u)}`).join(",")),
    );
  }
  return queries;
}

/**
 * Which of these links the catalogue already carries: as a product's
 * `source_url`, or as one of its stores — a feed row that joined another
 * source's product (see `importParsedProduct`) lives only there. Throws when
 * the database does not answer.
 */
async function knownLinks(urls: string[]): Promise<Set<string>> {
  const wanted = new Set(urls);
  const found = new Set<string>();
  const slices: string[][] = [];
  for (let i = 0; i < urls.length; i += LOOKUP_SLICE) slices.push(urls.slice(i, i + LOOKUP_SLICE));
  for (let i = 0; i < slices.length; i += 4) {
    const answers = await Promise.all(
      slices.slice(i, i + 4).flatMap((slice): LinkAnswer[] => [
        supabase!.from("products").select("source_url").in("source_url", slice),
        ...retailerLinkQueries(slice),
      ]),
    );
    for (const { data, error } of answers) {
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as LinkRow[]) {
        if (row.source_url && wanted.has(row.source_url)) found.add(row.source_url);
        for (const store of Array.isArray(row.retailers) ? row.retailers : []) {
          if (typeof store?.url === "string" && wanted.has(store.url)) found.add(store.url);
        }
      }
    }
  }
  return found;
}

// ── POST /api/admin/csv-import — which of these feed links do we already carry ─

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  const urls: string[] = Array.isArray(body?.urls)
    ? [...new Set((body.urls as unknown[]).filter(isHttpUrl))]
    : [];
  if (!urls.length) return NextResponse.json({ error: "urls array is required" }, { status: 400 });
  if (urls.length > MAX_CHECK_URLS) {
    return NextResponse.json({ error: `At most ${MAX_CHECK_URLS} links per request` }, { status: 400 });
  }

  try {
    return NextResponse.json({ existing: [...(await knownLinks(urls))] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read the catalogue" },
      { status: 500 },
    );
  }
}

// ── One group → one product ───────────────────────────────────────────────────

/**
 * "Where to buy" for one group: one entry per store, with its in-stock link and
 * its lowest in-stock price. A domain rule wins over the CSV's merchant column,
 * which wins over the name guessed from the link host — the merchant column is
 * one of the things that arrives wrong.
 */
function storesOf(rows: CSVMappedRow[], rules: Map<string, RetailerRule>): Product["retailers"] {
  const stores = new Map<string, Product["retailers"][number]>();
  const ordered = [...rows.filter((r) => !r.soldOut), ...rows.filter((r) => r.soldOut)];
  for (const row of ordered) {
    const store = resolveRetailer(row.referralUrl, row.brand, rules, row.merchant);
    const name = store.name || "Store";
    const current = stores.get(name.toLowerCase());
    if (!current) {
      stores.set(name.toLowerCase(), {
        name,
        url: row.referralUrl,
        price: row.price,
        currency: (row.currency || "GBP").toUpperCase(),
        availability: row.soldOut ? "sold out" : "in stock",
        isOfficial: store.isOfficial,
      });
    } else if (
      !row.soldOut && row.price > 0 && row.price < current.price &&
      (row.currency || "GBP").toUpperCase() === current.currency
    ) {
      current.price = row.price;
    }
  }
  return [...stores.values()];
}

type Outcome =
  | { kind: "created"; dropped?: string[] }
  | { kind: "updated"; dropped?: string[] }
  | { kind: "merged"; dropped?: string[] }
  | { kind: "skipped" }
  | { kind: "failed"; error: string };

async function importGroup(
  group: CSVImportGroup,
  ctx: { existing: Set<string>; rules: Map<string, RetailerRule>; mirrorImages: boolean },
): Promise<Outcome> {
  const rows = (Array.isArray(group?.rows) ? group.rows : []).filter(
    (r): r is CSVMappedRow =>
      // The link becomes a shopper's "Buy" button: nothing but a web address.
      !!r && typeof r.name === "string" && !!r.name.trim() && isHttpUrl(r.referralUrl) &&
      (r._valid || canRefreshOnly(r)),
  );
  if (!rows.length) return { kind: "skipped" };

  const live = rows.filter((r) => !r.soldOut);
  const urls = groupUrls(rows);
  // Any of the group's links may be the one a previous run keyed the product
  // by (an Awin feed has a link per size, in no promised order).
  const known = urls.find((u) => ctx.existing.has(u));
  // Sold out everywhere and not in the catalogue: nothing to create or update.
  if (!live.length && !known) return { kind: "skipped" };

  const repr = live[0] ?? rows[0];
  const currency = (repr.currency || "GBP").toUpperCase();
  const pool = live.length ? live : rows;
  // Lowest price across the group (best deal) — among rows in the same currency.
  const prices = pool
    .filter((r) => r.price > 0 && (r.currency || "GBP").toUpperCase() === currency)
    .map((r) => r.price);
  const price = prices.length ? Math.min(...prices) : repr.price;
  const priceOriginal = pool.find((r) => r.priceOriginal > 0)?.priceOriginal ?? 0;
  // The item's code, re-checked here: the rows arrive from the browser.
  const gtin = pool.map((r) => normalizeGtin(r.gtin)).find(Boolean);

  const result = await importParsedProduct(
    {
      name: typeof group.name === "string" && group.name.trim() ? group.name : repr.name,
      brand: repr.brand || repr.merchant,
      category: repr.category,
      gender: repr.gender,
      description: repr.description || "",
      material: repr.material,
      imageUrl: repr.imageUrl,
      images: repr.images?.length ? repr.images : (repr.imageUrl ? [repr.imageUrl] : []),
      colors: repr.colors,
      sizes: [...new Set(live.flatMap((r) => r.sizes || []))],
      price,
      priceOriginal,
      currency,
      ...(gtin ? { gtin } : {}),
      variantUrls: Array.isArray(group.siblingUrls) ? group.siblingUrls : [],
    },
    known ?? urls[0],
    { mirrorImages: ctx.mirrorImages, onExisting: "refresh", retailers: storesOf(rows, ctx.rules) },
  );

  if (!result.ok) return { kind: "failed", error: result.error ?? "Import failed" };
  const dropped = result.droppedColumns;
  if (result.mergedInto) return { kind: "merged", dropped };
  return { kind: result.updated ? "updated" : "created", dropped };
}

// ── PUT /api/admin/csv-import — import one batch of grouped products ──────────

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const groups: CSVImportGroup[] = Array.isArray(body?.groups) ? body.groups : [];
  if (!groups.length) return NextResponse.json({ error: "groups array is required" }, { status: 400 });
  if (groups.length > MAX_IMPORT_GROUPS) {
    return NextResponse.json({ error: `At most ${MAX_IMPORT_GROUPS} products per request` }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  // Read once per batch rather than per product: neither changes while it runs.
  const [aiSettings, rules] = await Promise.all([getAiSettings(), loadRetailerRules()]);

  let existing: Set<string>;
  try {
    const urls = groups.flatMap((g) =>
      (Array.isArray(g?.rows) ? g.rows : [])
        .map((r) => r?.referralUrl)
        .filter(isHttpUrl),
    );
    existing = await knownLinks([...new Set(urls)]);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not read the catalogue: ${err instanceof Error ? err.message : "unknown error"}` },
      { status: 500 },
    );
  }

  let created = 0;
  let updated = 0;
  let merged = 0;
  let skipped = 0;
  const errors: { name: string; error: string }[] = [];
  const dropped = new Set<string>();

  // One at a time: a colour imported first is found by the next one's
  // `siblingUrls`, which is how the swatches get grouped.
  for (const group of groups) {
    let outcome: Outcome;
    try {
      outcome = await importGroup(group, { existing, rules, mirrorImages: aiSettings.downloadImages });
    } catch (err) {
      outcome = { kind: "failed", error: err instanceof Error ? err.message : "Import failed" };
    }
    if (outcome.kind === "created") created++;
    else if (outcome.kind === "updated") updated++;
    else if (outcome.kind === "merged") merged++;
    else if (outcome.kind === "skipped") skipped++;
    else errors.push({ name: String(group?.name ?? "") || "Unnamed product", error: outcome.error });
    if ("dropped" in outcome) for (const column of outcome.dropped ?? []) dropped.add(column);
  }

  if (created || updated || merged) {
    revalidatePath("/");
    // One entry per batch (up to MAX_IMPORT_GROUPS products), not per product.
    void logAdminAction({
      admin_id: admin.userId,
      action: "import.csv",
      target_type: "product",
      metadata: { created, updated, merged, skipped, errors: errors.length },
    });
  }

  return NextResponse.json({
    created,
    updated,
    merged,
    skipped,
    errors,
    // Saved, but without columns the database does not have yet.
    ...(dropped.size && { warning: droppedColumnsWarning([...dropped]) }),
  });
}
