import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { writeRowDroppingUnknown } from "@/lib/server/write-row";
import { checkNamedRateLimit } from "@/lib/server/rate-limit";
import { isOwnStorageUrl } from "@/lib/data/db";
import {
  asFiniteNumber,
  asHttpUrl,
  asTrimmedString,
  sanitizeLookPieces,
  sanitizeStyleKeywords,
} from "@/lib/server/look-input";

// A submission goes to the admins' moderation queue, which opens with the
// Outfits page. Anyone can sign up, so the queue is held to the share route's
// field rules (lib/server/look-input), a daily bucket per user and a ceiling on
// looks still waiting — otherwise one account could fill it with rows large
// enough that the page no longer loads.
const SUBMISSIONS_PER_DAY = 10;
const MAX_PENDING_PER_USER = 20;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkNamedRateLimit(req, {
    name: "look-submit",
    requests: SUBMISSIONS_PER_DAY,
    window: "1 d",
    key: userId,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions today. Try again tomorrow." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  // The photo is what gets published, so it must be one generate-outfit put in
  // our storage — not a data URL, and not a picture from anywhere else.
  const hostedImage = asHttpUrl(body?.generatedImage);
  const generatedImage = hostedImage && isOwnStorageUrl(hostedImage) ? hostedImage : null;
  if (!generatedImage) {
    return NextResponse.json(
      { error: "generatedImage must be a photo generated on GOO" },
      { status: 400 },
    );
  }
  const pieces = sanitizeLookPieces(body?.pieces ?? [], { allowEmpty: true });
  if (!pieces) {
    return NextResponse.json({ error: "Invalid pieces" }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    // Accept gracefully when DB not configured
    return NextResponse.json({ ok: true, id: null });
  }

  const { count: pendingCount, error: countError } = await supabase
    .from("pending_looks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");
  if (countError) {
    console.error("[looks/submit] pending count:", countError);
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }
  if ((pendingCount ?? 0) >= MAX_PENDING_PER_USER) {
    return NextResponse.json(
      { error: "You already have looks waiting for review. Submit more once they are reviewed." },
      { status: 403 },
    );
  }

  // What the shopper called it travels with the submission. Before this, only
  // the image, pieces, price and tags were sent, so approval had nothing to name
  // the outfit with and every community look reached the catalogue as
  // "Community Look" with no description.
  const text = (v: unknown, max: number) => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : null;
  };

  const row = {
    user_id: userId,
    generated_image: generatedImage,
    generated_style: asTrimmedString(body.generatedStyle, 40),
    pieces,
    total_price: asFiniteNumber(body.totalPrice),
    style_keywords: sanitizeStyleKeywords(body.styleKeywords),
    status: "pending",
    look_id: asTrimmedString(body.lookId, 100),
    name: text(body.name, 120),
    description: text(body.description, 2000),
    occasion: text(body.occasion, 40),
    season: text(body.season, 20),
  };

  // Each of these arrived with a migration, so a database a step behind the
  // deploy drops the ones it lacks and still records the submission — the row
  // matters more than the label. Replaces a retry that dropped `look_id` on any
  // error at all, including real ones.
  const { data, error, dropped } = await writeRowDroppingUnknown<{ id: string }>(
    row,
    ["look_id", "name", "description", "occasion", "season"],
    (payload) => supabase!.from("pending_looks").insert(payload).select("id").single(),
  );

  if (error) {
    console.error("[looks/submit]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (dropped.length) {
    console.warn(`[looks/submit] stored without ${dropped.join(", ")} — run the pending migration`);
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null, dropped });
}
