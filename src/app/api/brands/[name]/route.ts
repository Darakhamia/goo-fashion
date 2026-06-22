import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";

// PATCH /api/brands/[name]  Body: { url: string | null } → set the store's homepage link.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const body = await req.json().catch(() => null);
  const rawUrl = (body as { url?: unknown } | null)?.url;
  const cleanUrl = typeof rawUrl === "string" && rawUrl.trim() ? rawUrl.trim() : null;
  const { error } = await supabase
    .from("brands")
    .update({ url: cleanUrl })
    .eq("name", decodedName);
  if (error) {
    // url column not added yet — surface a clear, actionable message
    if (error.code === "PGRST204" || error.message?.includes("url")) {
      return NextResponse.json(
        { error: "Store URL column not found. Run supabase-migration-store-urls.sql first.", code: "URL_COLUMN_MISSING" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ name: decodedName, url: cleanUrl });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const { error } = await supabase
    .from("brands")
    .delete()
    .eq("name", decodedName);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: decodedName });
}
