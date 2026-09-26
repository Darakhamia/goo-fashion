import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireSuperAdmin } from "@/lib/server/admin-auth";
import { resolveAdminEmails } from "@/lib/server/audit";

/** Loose-index-scan ceiling: the log holds a handful of admins, not hundreds. */
const MAX_ADMINS = 100;

interface AuditRow {
  id: number;
  admin_id: string;
  admin_email: string | null;
  action: string;
  target_id: string | null;
  target_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// GET /api/admin/audit?limit=<n>&offset=<n>&admin_id=<id>&action=<action>
// The first page (offset 0) also carries `admins`: every admin who has ever
// written to the log, independent of the filters, for the filter row.
export async function GET(req: Request) {
  const sa = await requireSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }
  const sb = supabase;

  const url = new URL(req.url);
  const limit  = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
  const adminFilter  = url.searchParams.get("admin_id") || null;
  const actionFilter = url.searchParams.get("action") || null;

  let query = sb
    .from("admin_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);

  if (adminFilter)  query = query.eq("admin_id", adminFilter);
  if (actionFilter) query = query.eq("action", actionFilter);

  // PostgREST has no DISTINCT, so the admins are found by a loose index scan
  // over admin_id: one tiny query per admin, not a read of the whole log.
  async function listAdminIds(): Promise<{ ids: string[]; error: string | null }> {
    const ids: string[] = [];
    let after: string | null = null;
    while (ids.length < MAX_ADMINS) {
      let q = sb.from("admin_audit_log").select("admin_id").order("admin_id").limit(1);
      if (after !== null) q = q.gt("admin_id", after);
      const { data, error } = await q;
      if (error) return { ids, error: error.message };
      const next = (data as { admin_id: string }[] | null)?.[0]?.admin_id;
      if (next === undefined) break;
      ids.push(next);
      after = next;
    }
    return { ids, error: null };
  }

  const [page, adminList] = await Promise.all([
    query,
    offset === 0 ? listAdminIds() : Promise.resolve(null),
  ]);
  if (page.error) return NextResponse.json({ error: page.error.message }, { status: 500 });
  if (adminList?.error) return NextResponse.json({ error: adminList.error }, { status: 500 });

  const entries = (page.data ?? []) as AuditRow[];
  const adminIds = adminList?.ids ?? [];

  // Older entries were written without an email; name them all with one call.
  const unnamed = entries.filter((e) => !e.admin_email).map((e) => e.admin_id);
  const emails = await resolveAdminEmails([...unnamed, ...adminIds]);

  // An admin Clerk no longer knows keeps the email the log last recorded.
  const missing = [...new Set([...unnamed, ...adminIds])].filter((id) => !emails.has(id));
  await Promise.all(missing.map(async (id) => {
    const { data } = await sb
      .from("admin_audit_log")
      .select("admin_email")
      .eq("admin_id", id)
      .not("admin_email", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const email = (data as { admin_email: string }[] | null)?.[0]?.admin_email;
    if (email) emails.set(id, email);
  }));

  return NextResponse.json({
    entries: entries.map((e) => ({ ...e, admin_email: e.admin_email || emails.get(e.admin_id) || null })),
    total: page.count ?? 0,
    ...(adminList ? { admins: adminIds.map((id) => ({ id, email: emails.get(id) ?? null })) } : {}),
  });
}
