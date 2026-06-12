import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// POST /api/looks/share
//
// Publishes a snapshot of a user-created look so its public /look/[id] page
// opens for ANY visitor — signed in or not, published to the catalog or not.
// No session is required: looks that exist only in localStorage (created
// before sign-in) must still produce working links.
//
// This endpoint must never dead-end the Share button, so it does not respond
// with 5xx for persistence problems. Instead it always returns the id the
// link should use plus `persisted` — when false, the client falls back to a
// self-contained link that carries the look in the URL, which the /look page
// can render without a database row.
//
// Look ids are minted client-side as `outfit-${Date.now()}` and can collide
// across users. A row owned by someone else is never overwritten — a fresh id
// is minted for this snapshot instead.

const ANON_USER = "anonymous";
const MAX_PIECES = 12;

type RawPiece = {
  slot?: unknown;
  productId?: unknown;
  variantId?: unknown;
  imageUrl?: unknown;
  name?: unknown;
};

function asTrimmedString(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > maxLen) return null;
  return s;
}

function sanitizePieces(raw: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PIECES) return null;
  const pieces: Array<Record<string, unknown>> = [];
  for (const item of raw as RawPiece[]) {
    const slot = asTrimmedString(item?.slot, 40);
    const productId = asTrimmedString(item?.productId, 100);
    if (!slot || !productId) return null;
    const piece: Record<string, unknown> = { slot, productId };
    const variantId = asTrimmedString(item?.variantId, 100);
    if (variantId) piece.variantId = variantId;
    const imageUrl = asTrimmedString(item?.imageUrl, 2000);
    if (imageUrl) piece.imageUrl = imageUrl;
    const name = asTrimmedString(item?.name, 300);
    if (name) piece.name = name;
    pieces.push(piece);
  }
  return pieces;
}

function mintLookId(): string {
  return `outfit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The live DB may predate migration 009 (look_name / look_description). */
function isMissingColumnError(e: { code?: string; message?: string } | null): boolean {
  if (!e) return false;
  return (
    e.code === "42703" ||
    e.code === "PGRST204" ||
    /column|schema cache/i.test(e.message ?? "")
  );
}

export async function POST(req: Request) {
  const { userId } = await auth().catch(() => ({ userId: null as string | null }));
  const owner = userId ?? ANON_USER;

  const body = await req.json().catch(() => null);
  const requestedId = asTrimmedString(body?.id, 100);
  const pieces = sanitizePieces(body?.pieces);
  if (!requestedId || !pieces) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    console.error("[looks/share] Supabase not configured — falling back to data link");
    return NextResponse.json({ id: requestedId, persisted: false });
  }

  const name = asTrimmedString(body?.name, 200);
  const description = asTrimmedString(body?.description, 2000);
  // Generated previews may be data URLs, so the cap is generous.
  const generatedImage =
    typeof body?.generatedImage === "string" && body.generatedImage.length <= 2_000_000
      ? body.generatedImage
      : null;
  const styleKeywords = Array.isArray(body?.styleKeywords)
    ? (body.styleKeywords as unknown[])
        .filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 60)
        .slice(0, 20)
    : [];
  const totalPrice =
    typeof body?.totalPrice === "number" && Number.isFinite(body.totalPrice)
      ? body.totalPrice
      : null;
  const savedAtMs = Date.parse(typeof body?.savedAt === "string" ? body.savedAt : "");
  const savedAt = Number.isNaN(savedAtMs)
    ? new Date().toISOString()
    : new Date(savedAtMs).toISOString();

  const contentColumns = {
    saved_at: savedAt,
    pieces,
    total_price: totalPrice,
    style_keywords: styleKeywords,
    generated_image: generatedImage,
    generated_style: body?.generatedStyle ?? null,
  };
  const nameColumns = { look_name: name, look_description: description };

  const { data: existing, error: lookupError } = await supabase
    .from("user_looks")
    .select("id, user_id")
    .eq("id", requestedId)
    .maybeSingle();

  if (lookupError) {
    console.error("[looks/share] lookup failed:", lookupError.message);
    return NextResponse.json({ id: requestedId, persisted: false });
  }

  // Fast path: the look is already in place (builder sync) and owned by this
  // user — the link already works. Refresh content best-effort; a failed
  // refresh must not block sharing.
  if (existing && existing.user_id === owner) {
    const { error: updateError } = await supabase
      .from("user_looks")
      .update({ ...contentColumns, ...nameColumns })
      .eq("id", requestedId);
    if (isMissingColumnError(updateError)) {
      await supabase.from("user_looks").update(contentColumns).eq("id", requestedId);
    } else if (updateError) {
      console.error("[looks/share] refresh failed:", updateError.message);
    }
    return NextResponse.json({ id: requestedId, persisted: true });
  }

  // Insert a snapshot — under a fresh id when the requested one is taken by a
  // different user (timestamp ids can collide; never overwrite foreign rows).
  const insertSnapshot = async (id: string) => {
    const row = { id, user_id: owner, ...contentColumns, ...nameColumns };
    let { error } = await supabase!.from("user_looks").insert(row);
    if (isMissingColumnError(error)) {
      ({ error } = await supabase!
        .from("user_looks")
        .insert({ id, user_id: owner, ...contentColumns }));
    }
    return error;
  };

  let id = existing ? mintLookId() : requestedId;
  let insertError = await insertSnapshot(id);

  // Duplicate key: a concurrent share won the race for this id — retry once
  // with a minted id so this snapshot still lands.
  if (insertError?.code === "23505") {
    id = mintLookId();
    insertError = await insertSnapshot(id);
  }

  if (insertError) {
    console.error("[looks/share] insert failed:", insertError.message);
    return NextResponse.json({ id, persisted: false });
  }

  return NextResponse.json({ id, persisted: true });
}
