import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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

interface Check {
  table: string;
  column: string;
  /** The migration that adds it, so the fix is named alongside the problem. */
  migration: string;
  /** What silently stops working while it is missing. */
  breaks: string;
}

const CHECKS: readonly Check[] = [
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
    table: "products",
    column: "bg_color",
    migration: "015_product_bg_color.sql",
    breaks: "Product cards cannot take the colour of the photo's backdrop.",
  },
];

async function present(table: string, column: string): Promise<{ present: boolean; error?: string }> {
  const { error } = await supabase!.from(table).select(column).limit(1);
  if (!error) return { present: true };
  // Only "undefined column" is an answer about the schema. Anything else — the
  // table missing, RLS, the network — is reported as-is rather than being read
  // as "the column is absent", which would send someone to re-run a migration
  // that was never the problem.
  if (error.code === UNDEFINED_COLUMN) return { present: false };
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
    missingMigrations: [...new Set(missing.map((m) => m.migration))].sort(),
  });
}
