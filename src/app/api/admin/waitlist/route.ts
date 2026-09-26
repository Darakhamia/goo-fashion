import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Read-only archive: the public signup form was removed in September 2026, so
// this list only holds the addresses collected before that. The rows are kept.

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }
  const { data, error } = await supabase
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const email = (body as { email?: unknown } | null)?.email;
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ ok: false, error: "email is required" }, { status: 400 });
  }
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const { data, error } = await supabase.from("waitlist").delete().eq("email", email).select("email");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing was deleted — the address is no longer in the waitlist." }, { status: 404 });
  }
  await logAdminAction({
    admin_id: admin.userId,
    action: "waitlist.deleted",
    target_id: email,
    target_type: "waitlist",
  });
  return NextResponse.json({ ok: true });
}
