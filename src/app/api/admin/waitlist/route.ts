import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json([]);
  }
  const { data, error } = await supabase
    .from("waitlist")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(req: Request) {
  const { email } = await req.json();
  if (!isSupabaseConfigured || !supabase) return NextResponse.json({ ok: false });
  await supabase.from("waitlist").delete().eq("email", email);
  return NextResponse.json({ ok: true });
}
