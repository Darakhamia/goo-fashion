import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const ALLOWED_METRICS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.session_id !== "string" || typeof body.metric !== "string" || typeof body.value !== "number") {
    return NextResponse.json({ ok: true });
  }
  if (!ALLOWED_METRICS.has(body.metric)) return NextResponse.json({ ok: true });
  if (typeof body.path !== "string" || body.path.startsWith("/admin") || body.path.startsWith("/api/")) {
    return NextResponse.json({ ok: true });
  }

  await supabase.from("web_vitals").insert({
    session_id: body.session_id,
    path:   body.path,
    metric: body.metric,
    value:  body.value,
    rating: typeof body.rating === "string" ? body.rating : null,
    device: typeof body.device === "string" ? body.device : null,
  });

  return NextResponse.json({ ok: true });
}
