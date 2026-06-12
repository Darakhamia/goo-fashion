import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// POST /api/looks/share
//
// Publishes a snapshot of a user-created look so its public /look/[id] page
// opens for ANY visitor — signed in or not, published to the catalog or not.
//
// Unlike /api/user/looks this endpoint does not require a session: looks that
// exist only in localStorage (created before sign-in) must still produce
// working links. The caller awaits the response and only hands the link out
// once the row is confirmed in place, so a recipient can never land on a 404.
//
// Look ids are minted client-side as `outfit-${Date.now()}`, which can collide
// across users. If the requested id already belongs to someone else we never
// overwrite it — a fresh id is minted for this snapshot instead. The response
// always carries the id the share link must use.

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

export async function POST(req: Request) {
  const { userId } = await auth();
  const owner = userId ?? ANON_USER;

  const body = await req.json().catch(() => null);
  const requestedId = asTrimmedString(body?.id, 100);
  const pieces = sanitizePieces(body?.pieces);
  if (!requestedId || !pieces) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Sharing is unavailable" }, { status: 503 });
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

  // Never clobber a look that belongs to a different user: timestamp-based ids
  // can collide, and a malicious caller could otherwise overwrite any row.
  const { data: existing, error: lookupError } = await supabase
    .from("user_looks")
    .select("id, user_id")
    .eq("id", requestedId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  const id = existing && existing.user_id !== owner ? mintLookId() : requestedId;

  const { error } = await supabase
    .from("user_looks")
    .upsert(
      {
        id,
        user_id: owner,
        saved_at: savedAt,
        look_name: name,
        look_description: description,
        pieces,
        total_price: totalPrice,
        style_keywords: styleKeywords,
        generated_image: generatedImage,
        generated_style: body?.generatedStyle ?? null,
      },
      { onConflict: "id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id });
}
