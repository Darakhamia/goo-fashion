import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { checkAnalyticsRateLimit } from "@/lib/server/rate-limit";
import { isUntrackedPath } from "@/lib/analytics/paths";

const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|localhost)/;

// The rate limit counts requests, not bytes, and none of these columns has a
// size limit of its own: a script could send megabyte referrers well inside
// the limit and fill the disk. A real beacon is well under a kilobyte, so the
// body is refused above this, and each field is cut to a length real values
// fit in.
const MAX_BODY_BYTES = 16 * 1024;

/** A string cut to `max` characters (never mid-emoji), or null. */
function capped(v: unknown, max: number): string | null {
  return typeof v === "string" ? v.slice(0, max).replace(/[\uD800-\uDBFF]$/, "") : null;
}

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

  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.session_id !== "string" || typeof body.path !== "string") {
    return NextResponse.json({ ok: true });
  }

  // Skip obvious noise — admin/API paths should never reach here, but guard anyway.
  if (isUntrackedPath(body.path)) {
    return NextResponse.json({ ok: true });
  }

  // Unauthenticated writes into the database: capped per IP, and before the
  // country lookup so a flood cannot spend that either.
  const limit = await checkAnalyticsRateLimit(req);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let userId: string | null = null;
  try { userId = (await auth()).userId; } catch { /* anon request */ }

  const clientCountry = typeof body.country === "string" && /^[A-Z]{2}$/.test(body.country)
    ? body.country
    : null;
  const country = clientCountry ?? await resolveCountry(req);

  await supabase.from("page_views").insert({
    session_id:   capped(body.session_id, 256),
    user_id:      userId,
    path:         capped(body.path, 1000),
    referrer:     capped(body.referrer, 512),
    utm_source:   capped(body.utm_source, 256),
    utm_medium:   capped(body.utm_medium, 256),
    utm_campaign: capped(body.utm_campaign, 256),
    country,
    device:  capped(body.device, 256),
    browser: capped(body.browser, 256),
    os:      capped(body.os, 256),
    load_ms: typeof body.load_ms === "number" ? body.load_ms : null,
    ttfb_ms: typeof body.ttfb_ms === "number" ? body.ttfb_ms : null,
  });

  return NextResponse.json({ ok: true });
}
