import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { checkIpRateLimit } from "@/lib/server/rate-limit";

export async function POST(req: NextRequest) {
  // Throttle per IP so the table can't be flooded with junk signups.
  const limit = await checkIpRateLimit(req, "waitlist", 5, "1 m");
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests — try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const { email } = await req.json().catch(() => ({ email: null }));
  if (
    !email ||
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (isSupabaseConfigured && supabase) {
    await supabase.from("waitlist").upsert({ email, created_at: new Date().toISOString() }, { onConflict: "email" });
  }

  return NextResponse.json({ ok: true });
}
