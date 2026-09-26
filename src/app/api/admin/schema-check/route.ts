import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { OPTIONAL_COLUMNS } from "@/lib/data/db";

export const dynamic = "force-dynamic";

/**
 * Which optional columns the live database actually has.
 *
 * This project deploys the app and runs its migrations as separate steps, and
 * several write paths are deliberately tolerant of a column that isn't there
 * yet: they drop the field and save the rest, so the row is never lost. The
 * cost of that tolerance is that a missing column is invisible — the app keeps
 * answering "saved" while quietly storing less than it was asked to.
 *
 * That is not hypothetical. It is exactly how a look's name came to survive on
 * the phone that typed it and nowhere else: `user_looks.look_name` was missing,
 * every rename was dropped on write, and the only trace was a console.warn on
 * the server. Moving the database to a new host re-opens the same hole, because
 * the migrations have to be re-run there and nothing checks that they were.
 *
 * So: ask the database directly, and let the answer be read from the admin
 * panel instead of from a psql session.
 */

/** PostgREST's code for "you selected a column I don't know about". */
const UNDEFINED_COLUMN = "42703";
/**
 * A whole table that isn't there yet reads as the same problem to the admin —
 * a migration to run — so it is reported the same way. Postgres answers 42P01;
 * PostgREST, which knows the schema from its own cache, answers PGRST205.
 */
const UNDEFINED_TABLE = new Set(["42P01", "PGRST205"]);

interface Check {
  table: string;
  column: string;
  /** The migration that adds it, so the fix is named alongside the problem. */
  migration: string;
  /** What silently stops working while it is missing. */
  breaks: string;
}

const OTHER_CHECKS: readonly Check[] = [
  {
    table: "settings",
    column: "value",
    migration: "024_settings.sql",
    breaks:
      "Nothing in Settings or Prompts can be saved: the stored OpenAI key, prompt edits, parser settings and homepage picks all fall back to defaults.",
  },
  {
    table: "user_looks",
    column: "look_name",
    migration: "009_user_looks_share.sql",
    breaks: "A look renamed on one device keeps its old name everywhere else.",
  },
  {
    table: "user_looks",
    column: "look_description",
    migration: "009_user_looks_share.sql",
    breaks: "A look's description never leaves the device it was written on.",
  },
  {
    table: "pending_looks",
    column: "name",
    migration: "017_pending_look_details.sql",
    breaks: "A look submitted for publication reaches the studio unnamed.",
  },
  {
    table: "pending_looks",
    column: "description",
    migration: "017_pending_look_details.sql",
    breaks: "A submitted look reaches the studio with no description.",
  },
  {
    table: "pending_looks",
    column: "occasion",
    migration: "017_pending_look_details.sql",
    breaks: "Published community looks all fall back to the default occasion.",
  },
  {
    table: "pending_looks",
    column: "season",
    migration: "017_pending_look_details.sql",
    breaks: "Published community looks all fall back to the default season.",
  },
  {
    table: "pending_looks",
    column: "look_id",
    migration: "008_pending_looks_look_id.sql",
    breaks: "A submission cannot be matched back to the look it came from.",
  },
  {
    table: "retailer_domains",
    column: "domain",
    migration: "018_retailer_domains.sql",
    breaks: "Per-domain store names and official-store flags are not applied to imports.",
  },
  {
    table: "retailer_domains",
    column: "default_gender",
    migration: "022_retailer_default_gender.sql",
    breaks: "A store's \"unmarked pieces are for…\" setting cannot be saved, and imports ignore it.",
  },
];

/**
 * Where each optional product column comes from. The list of columns itself is
 * OPTIONAL_COLUMNS — the same list the product writers drop from a save when
 * the database lacks one — so a column added there is checked here too, even
 * before it gets a line below.
 */
const PRODUCT_COLUMN_SOURCES: Record<string, Pick<Check, "migration" | "breaks">> = {
  subcategory: {
    migration: "010_product_subcategory.sql",
    breaks: "Subcategories are dropped on every save and import.",
  },
  color_images: {
    migration: "supabase-schema.sql",
    breaks: "Per-colour photos are not stored; every colour shows the main photo.",
  },
  variant_group_id: {
    migration: "supabase-schema.sql",
    breaks: "Colours of one item are not grouped into one card.",
  },
  color_hex: {
    migration: "supabase-schema.sql",
    breaks: "Colour swatches lose their exact shade.",
  },
  is_group_primary: {
    migration: "supabase-schema.sql",
    breaks: "A colour group cannot mark which variant its card shows.",
  },
  bg_color: {
    migration: "015_product_bg_color.sql",
    breaks: "Product cards cannot take the colour of the photo's backdrop.",
  },
  price_min_usd: {
    migration: "019_product_price_usd.sql",
    breaks: "Price filters and the stylist's budget compare store prices as if they were dollars.",
  },
  price_max_usd: {
    migration: "019_product_price_usd.sql",
    breaks: "Price filters and the stylist's budget compare store prices as if they were dollars.",
  },
  source_price: {
    migration: "019_product_source_price.sql",
    breaks: "The store's own price is not kept, so a converted price cannot be checked.",
  },
  source_currency: {
    migration: "019_product_source_price.sql",
    breaks: "The store's own currency is not kept, so a converted price cannot be checked.",
  },
  fx_rate: {
    migration: "019_product_source_price.sql",
    breaks: "The exchange rate behind a converted price is not kept.",
  },
  fx_date: {
    migration: "019_product_source_price.sql",
    breaks: "The date of the exchange rate behind a converted price is not kept.",
  },
  gtin: {
    migration: "020_product_codes.sql",
    breaks: "Barcodes are dropped, so the same item from two stores is not matched by code.",
  },
  mpn: {
    migration: "020_product_codes.sql",
    breaks: "Manufacturer part numbers are dropped, so the same item is not matched by code.",
  },
  sku: {
    migration: "020_product_codes.sql",
    breaks: "Store SKUs are dropped on every save and import.",
  },
  color_group_ids: {
    migration: "021_color_groups.sql",
    breaks: "Products get no base colour, so they never show up in the colour filter.",
  },
  crop_data: {
    migration: "023_product_crop_data.sql",
    breaks: "The crop set in the product editor is not saved; cards show the whole photo.",
  },
};

const CHECKS: readonly Check[] = [
  ...OTHER_CHECKS,
  ...OPTIONAL_COLUMNS.map((column) => ({
    table: "products",
    column,
    ...(PRODUCT_COLUMN_SOURCES[column] ?? {
      migration: "a migration in supabase/migrations",
      breaks: "Saves and imports drop this field.",
    }),
  })),
];

/**
 * Migrations in the order to run them: the root schema file first, then the
 * numbered files in file order, then anything unnamed (the generic fallback).
 */
function byRunOrder(a: string, b: string): number {
  const rank = (m: string) => (m === "supabase-schema.sql" ? 0 : /^\d/.test(m) ? 1 : 2);
  return rank(a) - rank(b) || a.localeCompare(b);
}

async function present(table: string, column: string): Promise<{ present: boolean; error?: string }> {
  const { error } = await supabase!.from(table).select(column).limit(1);
  if (!error) return { present: true };
  // Only "undefined column" and "undefined table" are answers about the schema.
  // Anything else — RLS, the network — is reported as-is rather than being read
  // as "the column is absent", which would send someone to re-run a migration
  // that was never the problem.
  if (error.code === UNDEFINED_COLUMN) return { present: false };
  if (error.code && UNDEFINED_TABLE.has(error.code)) return { present: false };
  return { present: false, error: error.message };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const results = await Promise.all(
    CHECKS.map(async (check) => ({ ...check, ...(await present(check.table, check.column)) })),
  );

  const missing = results.filter((r) => !r.present && !r.error);
  const failed = results.filter((r) => !!r.error);

  return NextResponse.json({
    ok: missing.length === 0 && failed.length === 0,
    checks: results,
    // The migrations to run, de-duplicated and in file order — the actual
    // next action, rather than a list of columns to work back from.
    missingMigrations: [...new Set(missing.map((m) => m.migration))].sort(byRunOrder),
  });
}
