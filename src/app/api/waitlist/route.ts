import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (isSupabaseConfigured && supabase) {
    await supabase.from("waitlist").upsert({ email, created_at: new Date().toISOString() }, { onConflict: "email" });
  }

  return NextResponse.json({ ok: true });
}
