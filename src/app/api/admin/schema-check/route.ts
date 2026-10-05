import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { checkSchema } from "@/lib/server/schema-check";

export const dynamic = "force-dynamic";

// GET /api/admin/schema-check — which optional columns the live database has,
// and the migrations that add the missing ones (Settings → Database schema).
// The checks themselves live in lib/server/schema-check.ts, shared with the
// dashboard's "Needs attention".
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  return NextResponse.json(await checkSchema());
}
