import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { checkAnalyticsRateLimit } from "@/lib/server/rate-limit";
import { isUntrackedPath } from "@/lib/analytics/paths";

const ALLOWED_METRICS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);

// The rate limit counts requests, not bytes, and these text columns have no
// size limit of their own. A real report is well under a kilobyte, so the body
// is refused above this and each string is cut to a length real values fit in.
const MAX_BODY_BYTES = 16 * 1024;

/** A string cut to `max` characters (never mid-emoji), or null. */
function capped(v: unknown, max: number): string | null {
  return typeof v === "string" ? v.slice(0, max).replace(/[\uD800-\uDBFF]$/, "") : null;
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) return NextResponse.json({ ok: true });

  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.session_id !== "string" || typeof body.metric !== "string" || typeof body.value !== "number") {
    return NextResponse.json({ ok: true });
  }
  if (!ALLOWED_METRICS.has(body.metric)) return NextResponse.json({ ok: true });
  if (typeof body.path !== "string" || isUntrackedPath(body.path)) {
    return NextResponse.json({ ok: true });
  }

  const limit = await checkAnalyticsRateLimit(req);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  await supabase.from("web_vitals").insert({
    session_id: capped(body.session_id, 256),
    path:   capped(body.path, 1000),
    metric: body.metric,
    value:  body.value,
    rating: capped(body.rating, 256),
    device: capped(body.device, 256),
  });

  return NextResponse.json({ ok: true });
}
