import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { checkNamedRateLimit } from "@/lib/server/rate-limit";

// The two kinds of thing the heart icon can be on — GET sorts rows by these.
const ENTITY_TYPES = new Set(["outfit", "product"]);
// Product and outfit ids are far shorter; this only keeps junk out of the table.
const MAX_ENTITY_ID_LENGTH = 100;
// Tapping hearts down a page is quick, but not this quick. Per user: sign-up is
// open, and without a bucket a script could grow user_likes without end.
const LIKES_PER_MINUTE = 120;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ outfits: [], products: [] });
  }

  const { data, error } = await supabase
    .from("user_likes")
    .select("entity_type, entity_id")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const outfits = (data ?? []).filter((r) => r.entity_type === "outfit").map((r) => r.entity_id);
  const products = (data ?? []).filter((r) => r.entity_type === "product").map((r) => r.entity_id);

  return NextResponse.json({ outfits, products });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await checkNamedRateLimit(req, {
    name: "user-likes",
    requests: LIKES_PER_MINUTE,
    window: "1 m",
    key: userId,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  const { entityType, entityId, liked } = body ?? {};
  if (
    typeof entityType !== "string" ||
    !ENTITY_TYPES.has(entityType) ||
    typeof entityId !== "string" ||
    !entityId ||
    entityId.length > MAX_ENTITY_ID_LENGTH ||
    typeof liked !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ ok: true });
  }

  if (liked) {
    const { error } = await supabase
      .from("user_likes")
      .upsert({ user_id: userId, entity_type: entityType, entity_id: entityId }, { onConflict: "user_id,entity_type,entity_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("user_likes")
      .delete()
      .eq("user_id", userId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
