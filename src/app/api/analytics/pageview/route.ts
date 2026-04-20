import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Accepts navigator.sendBeacon payloads. Never returns the client anything
// actionable — failures are silent so analytics can't break the app.
export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.session_id !== "string" || typeof body.path !== "string") {
    return NextResponse.json({ ok: true });
  }

  // Skip obvious noise — admin/API paths should never reach here, but guard anyway.
  if (body.path.startsWith("/admin") || body.path.startsWith("/api/")) {
    return NextResponse.json({ ok: true });
  }

  let userId: string | null = null;
  try { userId = (await auth()).userId; } catch { /* anon request */ }

  const country =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-forwarded-country") ||
    null;

  await supabase.from("page_views").insert({
    session_id:   body.session_id,
    user_id:      userId,
    path:         body.path,
    referrer:     body.referrer     ?? null,
    utm_source:   body.utm_source   ?? null,
    utm_medium:   body.utm_medium   ?? null,
    utm_campaign: body.utm_campaign ?? null,
    country,
    device:  body.device  ?? null,
    browser: body.browser ?? null,
    os:      body.os      ?? null,
    load_ms: typeof body.load_ms === "number" ? body.load_ms : null,
    ttfb_ms: typeof body.ttfb_ms === "number" ? body.ttfb_ms : null,
  });

  return NextResponse.json({ ok: true });
}
