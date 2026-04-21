import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireSuperAdmin } from "@/lib/server/admin-auth";

export async function GET(req: Request) {
  const sa = await requireSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const limit  = Math.min(Number(url.searchParams.get("limit")  ?? "100"), 200);
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const adminFilter = url.searchParams.get("admin_id") ?? null;

  const sbUrl = process.env.SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const sb = createClient(sbUrl, sbKey);

  let query = sb
    .from("admin_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (adminFilter) query = query.eq("admin_id", adminFilter);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entries: data ?? [], total: count ?? 0 });
}
