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

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) return NextResponse.json({ ok: true });

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
    session_id: body.session_id,
    user_id:    userId,
    event:      body.event,
    target_id:  typeof body.target_id === "string" ? body.target_id : null,
    props:      body.props && typeof body.props === "object" ? body.props : null,
  });

  return NextResponse.json({ ok: true });
}
