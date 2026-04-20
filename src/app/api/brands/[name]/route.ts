import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";

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
