import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb, dbToProduct } from "@/lib/data/db";
import type { DbProduct } from "@/lib/supabase";

const noDb = () =>
  NextResponse.json(
    { error: "Database not configured." },
    { status: 501 }
  );

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured || !supabase) return noDb();
  const { id } = await params;
  const body = await req.json();
  const row = productToDb(body);
  const { data, error } = await supabase
    .from("products")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(dbToProduct(data as DbProduct));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured || !supabase) return noDb();
  const { id } = await params;
  const body = await req.json();
  // Only update crop_data; all other fields stay unchanged
  const { error } = await supabase
    .from("products")
    .update({ crop_data: body.cropData ?? null })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured || !supabase) return noDb();
  const { id } = await params;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
