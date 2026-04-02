import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured, dbToColorGroup, type DbColorGroup } from "@/lib/supabase";
import { getAllColorGroups } from "@/lib/data/db";

export async function GET() {
  const groups = await getAllColorGroups();
  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 501 }
    );
  }
  const body = await req.json();
  const { data, error } = await supabase
    .from("color_groups")
    .insert({
      name: body.name,
      hex_code: body.hexCode,
      sort_order: body.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(dbToColorGroup(data as DbColorGroup), { status: 201 });
}
