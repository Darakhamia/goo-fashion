import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";

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
  const { data: deleted, error } = await supabase
    .from("brands")
    .delete()
    .eq("name", decodedName)
    .select("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Logged only when a row went: deleting a name that was not there changes nothing.
  if (deleted?.length) {
    await logAdminAction({
      admin_id: admin.userId,
      action: "brands.deleted",
      target_id: decodedName,
      target_type: "brand",
      metadata: { name: decodedName },
    });
  }
  return NextResponse.json({ deleted: decodedName });
}
