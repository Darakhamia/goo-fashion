import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { checkAnalyticsRateLimit } from "@/lib/server/rate-limit";
import { isUntrackedPath } from "@/lib/analytics/paths";

// Accept only a known event vocabulary to keep storage clean.
const ALLOWED_EVENTS = new Set([
  "product_view",
  "outfit_view",
  "like_product",
  "unlike_product",
  "like_outfit",
  "unlike_outfit",
  "save_outfit",
  "generate_start",
  "generate_success",
  "generate_error",
  "sign_up",
  "sign_in",
  "subscribe_click",
  "plan_upgrade",
  "stylist_open",
  "builder_open",
  "search",
]);

// The rate limit counts requests, not bytes, and `props` is jsonb with no size
// limit: a script could send megabyte payloads well inside the limit and fill
// the disk. A real event is well under a kilobyte, so the body is refused above
// this, strings are cut, and props too large for any event we send are dropped.
const MAX_BODY_BYTES = 16 * 1024;
const MAX_PROPS_JSON_LENGTH = 2000;

/** A string cut to `max` characters (never mid-emoji), or null. */
function capped(v: unknown, max: number): string | null {
  return typeof v === "string" ? v.slice(0, max).replace(/[\uD800-\uDBFF]$/, "") : null;
}

function boundedProps(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  const json = JSON.stringify(v);
  return json && json.length <= MAX_PROPS_JSON_LENGTH ? (v as Record<string, unknown>) : null;
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) return NextResponse.json({ ok: true });

  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.session_id !== "string" || typeof body.event !== "string") {
    return NextResponse.json({ ok: true });
  }
  if (!ALLOWED_EVENTS.has(body.event)) return NextResponse.json({ ok: true });
  // track() sends the page it fired on; events from the admin panel are not
  // the site's.
  if (typeof body.path === "string" && isUntrackedPath(body.path)) {
    return NextResponse.json({ ok: true });
  }

  const limit = await checkAnalyticsRateLimit(req);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let userId: string | null = null;
  try { userId = (await auth()).userId; } catch {}

  await supabase.from("analytics_events").insert({
    session_id: capped(body.session_id, 256),
    user_id:    userId,
    event:      body.event,
    target_id:  capped(body.target_id, 256),
    props:      boundedProps(body.props),
  });

  return NextResponse.json({ ok: true });
}
