import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { updateOutfit, deleteOutfit, outfitToDb } from "@/lib/data/db";
import { requireAdmin } from "@/lib/server/admin-auth";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 501 }
    );
  }

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const row = outfitToDb(body);
  const outfit = await updateOutfit(id, row);

  if (!outfit) {
    return NextResponse.json({ error: "Failed to update outfit." }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json(outfit);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 501 }
    );
  }

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteOutfit(id);

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete outfit." }, { status: 500 });
  }

  revalidatePath("/");
  return NextResponse.json({ success: true });
}
