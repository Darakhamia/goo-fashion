import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { updateOutfit, deleteOutfit, outfitToDb } from "@/lib/data/db";

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

  const { id } = await params;
  const body = await req.json();
  const row = outfitToDb(body);
  const outfit = await updateOutfit(id, row);

  if (!outfit) {
    return NextResponse.json({ error: "Failed to update outfit." }, { status: 500 });
  }

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

  const { id } = await params;
  const ok = await deleteOutfit(id);

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete outfit." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
