import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { seasonColumns } from "@/lib/data/db";
import { insertOutfitRow, priceLook, type LookPiece } from "@/lib/server/look-outfit";
import { writeRowDroppingUnknown } from "@/lib/server/write-row";
import { normalizeSeasons } from "@/lib/seasons";
import { normalizeStyleKeywords } from "@/lib/style-keywords";
import { MAX_OUTFIT_ITEMS } from "@/lib/outfit-limits";

/**
 * An admin's own builder look, published to the catalogue straight from My
 * looks — no queue, since the person who would approve it is the one asking.
 *
 * The studio used to build outfits in a form of its own, with its own product
 * picker and fields the builder never had. By the CEO's decision of 2026-10-27
 * there is one way to make an outfit: build it in the builder, save it, and
 * publish it — a shopper through the moderation queue (api/looks/submit and
 * api/looks/approve), an admin here. Both price and store the outfit through
 * lib/server/look-outfit, so they cannot drift apart.
 *
 * The publication is recorded in `pending_looks` as approved, with the outfit's
 * id, so My looks shows the look as published on every device, and an earlier
 * submission of the same look still waiting in the queue is closed with it
 * rather than left to be approved a second time.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const pieces = (Array.isArray(body?.pieces) ? body.pieces : []) as LookPiece[];
  if (pieces.length === 0) {
    return NextResponse.json({ error: "A look needs at least one piece to be published." }, { status: 400 });
  }
  if (pieces.length > MAX_OUTFIT_ITEMS) {
    return NextResponse.json({ error: `An outfit takes up to ${MAX_OUTFIT_ITEMS} pieces.` }, { status: 400 });
  }

  const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const lookId = text(body.lookId, 200) || null;
  const generatedImage = text(body.generatedImage, 2000) || null;
  const name = text(body.name, 120) || "New look";
  const description = text(body.description, 2000);
  const styleKeywords = normalizeStyleKeywords(body.styleKeywords ?? []);
  const seasons = normalizeSeasons(body.seasons ?? []);

  const priced = await priceLook(pieces);
  if ("error" in priced) return NextResponse.json({ error: priced.error }, { status: 500 });

  // No photo is allowed: the outfit card and page draw a collage of the pieces
  // instead (OutfitCollage), and a cover can be added later in the studio.
  const created = await insertOutfitRow({
    name,
    description,
    ...seasonColumns(seasons),
    image_url: generatedImage ?? "",
    items: priced.items,
    total_price_min: priced.totalPriceMin,
    total_price_max: priced.totalPriceMax,
    currency: "USD",
    style_keywords: styleKeywords,
    // Put together by a person: the "AI" mark is for outfits the AI chose
    // the pieces of (CEO, 2026-10-27), whoever drew the picture.
    is_ai_generated: false,
    is_saved: false,
  });
  if ("error" in created) {
    console.error("[looks/publish] insert outfit error:", created.error);
    return NextResponse.json({ error: created.error }, { status: 500 });
  }
  const outfitId = created.id;

  // The record My looks reads the status from. Losing it costs a badge, not
  // the outfit, so a failure here is logged and reported, not rolled back.
  let recorded = false;
  if (lookId) {
    const { data: closed, error: closeErr } = await supabase
      .from("pending_looks")
      .update({ status: "approved", outfit_id: outfitId })
      .eq("user_id", admin.userId)
      .eq("look_id", lookId)
      .eq("status", "pending")
      .select("id");
    if (closeErr) console.error("[looks/publish] closing an earlier submission:", closeErr.message);
    recorded = (closed?.length ?? 0) > 0;
  }
  if (!recorded) {
    const { error: recordErr } = await writeRowDroppingUnknown<null>(
      {
        user_id: admin.userId,
        generated_image: generatedImage,
        generated_style: text(body.generatedStyle, 40) || null,
        pieces,
        total_price: priced.totalPriceMin,
        style_keywords: styleKeywords,
        status: "approved",
        outfit_id: outfitId,
        look_id: lookId,
        name,
        description: description || null,
        ...seasonColumns(seasons),
      },
      ["look_id", "name", "description", "season", "seasons"],
      (payload) => supabase!.from("pending_looks").insert(payload).then(({ error: e }) => ({ data: null, error: e })),
    );
    if (recordErr) console.error("[looks/publish] recording the publication:", recordErr.message);
    recorded = !recordErr;
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: "looks.published",
    target_id: outfitId,
    target_type: "outfit",
    metadata: { name, lookId },
  });

  revalidatePath("/");
  return NextResponse.json({ ok: true, outfitId, recorded });
}
