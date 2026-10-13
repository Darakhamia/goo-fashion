// Turns the catalogue export in fixtures/source/ into the database tables the
// stand-in Supabase (mock-supabase.mjs) serves to the real app.
//
//   node capture/build-fixtures.mjs
//
// Sources (all copied once from goo-fashion.com's public API, 2026-10-13):
//   products-2026-10-13.json  GET /api/products: 554 live items, as the app's Product type
//   categories.json           GET /api/categories: the category tree (source "db")
//   color-groups.json         GET /api/color-groups
//   brands.json               GET /api/brands
//
// Products go back to the `products` row shape (src/lib/supabase.ts, DbProduct),
// so the app reads them through its own code path (dbToProduct, groupVariants,
// the seeded shuffle). The export lists colour groups as one primary with a
// `variants` array; the other members come back here as their own rows, built
// from the swatch, so the cards show the same swatches as the live site.
//
// Photo URLs move from supabase.goo-fashion.com to the stand-in's storage
// endpoint, which serves the copies in fixtures/storage/.
//
// One exception to "as exported": fixtures/illustrative.json (D2).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = (f) => JSON.parse(readFileSync(join(here, "fixtures/source", f), "utf8"));
const out = join(here, "fixtures/db");
mkdirSync(out, { recursive: true });

export const MOCK_ORIGIN = process.env.MOCK_ORIGIN ?? "http://127.0.0.1:54321";
const LIVE_STORAGE = "https://supabase.goo-fashion.com/storage/";
const local = (u) => (typeof u === "string" ? u.replace(LIVE_STORAGE, `${MOCK_ORIGIN}/storage/`) : u);

const exported = src("products-2026-10-13.json");

/** Product (camelCase, as /api/products answers) → products row. */
function toRow(p) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    subcategory: p.subcategory ?? null,
    description: p.description ?? "",
    image_url: local(p.imageUrl),
    images: (p.images ?? []).map(local),
    colors: p.colors ?? [],
    color_images: p.colorImages
      ? Object.fromEntries(Object.entries(p.colorImages).map(([k, v]) => [k, v.map(local)]))
      : null,
    sizes: p.sizes ?? [],
    material: p.material ?? "",
    retailers: p.retailers ?? [],
    price_min: p.priceMin,
    price_max: p.priceMax,
    currency: p.currency ?? "USD",
    is_new: p.isNew ?? false,
    is_saved: false,
    style_keywords: p.styleKeywords ?? [],
    gender: p.gender ?? null,
    created_at: p.createdAt,
    updated_at: p.updatedAt ?? null,
    variant_group_id: p.variantGroupId ?? null,
    color_hex: p.colorHex ?? null,
    is_group_primary: p.isGroupPrimary ?? null,
    crop_data: p.cropData ?? null,
    color_group_ids: p.colorGroupIds ?? null,
    bg_color: p.bgColor ?? null,
    source_price: p.sourcePrice ?? null,
    source_currency: p.sourceCurrency ?? null,
    fx_rate: p.fxRate ?? null,
    fx_date: p.fxDate ?? null,
    gtin: p.gtin ?? null,
    mpn: p.mpn ?? null,
    sku: p.sku ?? null,
  };
}

const rows = [];
for (const p of exported) {
  const row = toRow(p);
  rows.push(row);
  // Rebuild the other members of a colour group from their swatches.
  for (const v of p.variants ?? []) {
    if (v.id === p.id) continue;
    rows.push({
      ...row,
      id: v.id,
      name: v.name ?? row.name,
      colors: v.colorName ? [v.colorName] : row.colors,
      color_hex: v.colorHex ?? null,
      price_min: v.priceMin ?? row.price_min,
      price_max: v.priceMax ?? row.price_max,
      image_url: local(v.imageUrl ?? p.imageUrl),
      images: (v.images ?? [v.imageUrl ?? p.imageUrl]).map(local),
      is_group_primary: false,
      // Older than its primary, so the primary stays the newest member.
      created_at: new Date(new Date(row.created_at).getTime() - 1000).toISOString(),
    });
  }
}

// Illustrative additions (D2), kept in their own file so they never pass for
// catalogue data. See fixtures/illustrative.json.
const illustrative = JSON.parse(readFileSync(join(here, "fixtures/illustrative.json"), "utf8"));
for (const [id, change] of Object.entries(illustrative.products)) {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`illustrative.json names ${id}, which is not in the export`);
  row.retailers = [...row.retailers, ...(change.appendRetailers ?? [])];
  console.log(`illustrative: ${row.name} now lists ${row.retailers.length} stores`);
}

const categories = src("categories.json");
const categoryGroups = categories.groups.map((g, i) => ({ id: g.id, label: g.label, sort_order: i }));
const categorySubcategories = categories.groups.flatMap((g) =>
  g.items.map((it, i) => ({
    id: it.id,
    group_id: g.id,
    label: it.label,
    value: it.value,
    sort_order: i,
    size_type: it.sizeType ?? null,
    sizes: it.sizes ?? null,
  })),
);

const colorGroups = src("color-groups.json").map((c) => ({
  id: c.id,
  name: c.name,
  hex_code: c.hexCode,
  sort_order: c.sortOrder,
}));

const brands = src("brands.json").map((b) => ({ name: b.name, logo_url: local(b.logoUrl ?? null) }));

const tables = {
  products: rows,
  category_groups: categoryGroups,
  category_subcategories: categorySubcategories,
  color_groups: colorGroups,
  brands,
};
for (const [name, data] of Object.entries(tables)) {
  writeFileSync(join(out, `${name}.json`), JSON.stringify(data, null, 1) + "\n");
  console.log(`${name}: ${data.length} rows`);
}
