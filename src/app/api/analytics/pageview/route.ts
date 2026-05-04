import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|localhost)/;

async function resolveCountry(req: Request): Promise<string | null> {
  const fromHeader =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-forwarded-country");
  if (fromHeader && fromHeader !== "XX") return fromHeader;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip");
  if (!ip || PRIVATE_IP.test(ip)) return null;

  try {
    const res = await fetch(`https://ipapi.co/${ip}/country_code/`, {
      signal: AbortSignal.timeout(1200),
      headers: { "User-Agent": "goo-fashion/1.0" },
    });
    if (!res.ok) return null;
    const code = (await res.text()).trim();
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

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

  const clientCountry = typeof body.country === "string" && /^[A-Z]{2}$/.test(body.country)
    ? body.country
    : null;
  const country = clientCountry ?? await resolveCountry(req);

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
