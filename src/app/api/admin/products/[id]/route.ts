import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { readProductWithGroup } from "@/lib/data/db";
import { isSuperAdminId, requireAdmin } from "@/lib/server/admin-auth";
import { productFixes } from "@/lib/server/catalogue-check/store";

/**
 * GET /api/admin/products/[id] — everything the admin's product page shows
 * (GS6-1), in one request:
 *
 * - `product` — the row itself, fresh (404 when it is not in the catalogue);
 * - `group` — the other colours of its variant group;
 * - `quality` — AI check fixes waiting for a decision and the latest it wrote,
 *   or null before migration 025 (the page then leaves the block out);
 * - `history` — the latest Activity entries about this product, or null for
 *   an admin who is not the super admin: Activity is the super admin's, and a
 *   product page must not become a way round that.
 *
 * Write goes through the existing routes: PUT /api/products/[id], the group
 * route, the AI check's decide actions.
 */

const HISTORY_LIMIT = 8;

type HistoryRow = { id: number; action: string; admin_email: string | null; metadata: Record<string, unknown>; created_at: string };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { product, group, error } = await readProductWithGroup(id);
  if (!product) {
    return NextResponse.json(
      { error: error ? `Could not load the product: ${error}` : "Product not found" },
      { status: error ? 500 : 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const [quality, history] = await Promise.all([
    productFixes(id).catch(() => null),
    isSuperAdminId(admin.userId) && supabase
      ? supabase
          .from("admin_audit_log")
          .select("id, action, admin_email, metadata, created_at")
          .eq("target_id", id)
          .order("created_at", { ascending: false })
          .limit(HISTORY_LIMIT)
          .then(({ data, error: e }) => (e ? null : ((data ?? []) as HistoryRow[])))
      : Promise.resolve(null),
  ]);

  return NextResponse.json(
    {
      product,
      group,
      groupError: error,
      quality,
      history: history?.map((h) => ({ id: h.id, action: h.action, by: h.admin_email, at: h.created_at, metadata: h.metadata })) ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
