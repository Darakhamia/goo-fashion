import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { seasonColumns } from "@/lib/data/db";
import { insertOutfitRow, priceLook, type LookPiece } from "@/lib/server/look-outfit";
import { normalizeSeasons, seasonsFromRow } from "@/lib/seasons";
import { normalizeStyleKeywords } from "@/lib/style-keywords";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const { id } = body ?? {};
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Fetch the look — only while it is still waiting. One that was already
  // approved or rejected is not published again: approving twice used to put a
  // second copy of the outfit in the catalogue.
  const { data: look, error: fetchErr } = await supabase
    .from("pending_looks")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchErr) {
    console.error("[looks/approve] fetch pending look error:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!look) {
    return NextResponse.json(
      { error: "This look is no longer pending — it was already approved or rejected." },
      { status: 404 }
    );
  }

  // The pieces as outfit items, priced from the catalogue (lib/server/look-outfit).
  const pieces = (Array.isArray(look.pieces) ? look.pieces : []) as LookPiece[];
  const priced = await priceLook(pieces);
  if ("error" in priced) return NextResponse.json({ error: priced.error }, { status: 500 });

  // What the shopper called it, or an admin's edit of it, wins. The constants
  // are only a floor for looks submitted before those columns existed: this
  // route used to hardcode all four, which is why every community outfit in the
  // catalogue was called "Community Look" and had no description.
  //
  // `overrides` lets the admin fix a name at the moment of approval rather than
  // approving something wrong and editing it afterwards.
  const overrides = (body.overrides ?? {}) as Record<string, unknown>;
  // Three sources, tried in order, with a blank counting as "no opinion" at
  // each step. `??` alone was wrong here: an admin who clears the name box
  // sends "", which is not null, so the shopper's own name would have been
  // skipped and the constant published instead of it.
  const pick = (key: string, fallback: string): string => {
    const text = (v: unknown) => String(v ?? "").trim();
    return text(overrides[key]) || text(look[key]) || fallback;
  };
  const styleKeywords = Array.isArray(overrides.styleKeywords)
    ? (overrides.styleKeywords as string[])
    : (look.style_keywords ?? []);

  // Seasons: the admin's pick, else the shopper's — the list (migration 030),
  // or the single season a submission from before it carried.
  const seasons = Array.isArray(overrides.seasons)
    ? normalizeSeasons(overrides.seasons)
    : seasonsFromRow(look);

  // Put together by the AI (Generate with AI in the studio) or by a person.
  // Only the first is marked AI on the site — the mark means the AI chose the
  // pieces, not that it drew the picture (CEO, 2026-10-27).
  const byAi = Boolean(look.ai_meta);

  // Create an outfit from the pending look. The occasion is left to the
  // database's default: styles replaced it (CEO, 2026-10-27).
  const created = await insertOutfitRow({
    name: pick("name", "Community Look"),
    description: pick("description", ""),
    ...seasonColumns(seasons),
    // A generated look whose picture failed has none; the site draws a collage.
    image_url: look.generated_image ?? "",
    items: priced.items,
    total_price_min: priced.totalPriceMin,
    total_price_max: priced.totalPriceMax,
    currency: "USD",
    style_keywords: normalizeStyleKeywords(styleKeywords),
    is_ai_generated: byAi,
    is_saved: false,
    source: byAi ? "ai" : "community",
  });

  if ("error" in created) {
    console.error("[looks/approve] insert outfit error:", created.error);
    return NextResponse.json({ error: created.error }, { status: 500 });
  }
  const outfit = created;

  // Mark the look approved — again only if it is still pending, so of two
  // moderators approving at once exactly one wins. Whoever loses, or a failed
  // update, takes its outfit back out: a look left in the queue with its outfit
  // already published would be published a second time by the next approval.
  const { data: marked, error: updateErr } = await supabase
    .from("pending_looks")
    .update({ status: "approved", outfit_id: outfit.id })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (updateErr || !marked?.length) {
    const { error: rollbackErr } = await supabase.from("outfits").delete().eq("id", outfit.id);
    if (rollbackErr) {
      console.error(`[looks/approve] could not remove outfit ${outfit.id} after a failed approval:`, rollbackErr);
    }
    if (updateErr) {
      console.error("[looks/approve] mark approved error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "This look was approved or rejected by someone else in the meantime." },
      { status: 409 }
    );
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: "looks.approved",
    target_id: id,
    target_type: "pending_look",
    metadata: { outfitId: outfit.id, name: pick("name", "Community Look") },
  });

  revalidatePath("/");
  return NextResponse.json({ ok: true, outfitId: outfit.id });
}
