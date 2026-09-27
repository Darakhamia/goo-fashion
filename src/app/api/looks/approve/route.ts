import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getProductsByIds } from "@/lib/data/db";
import { toUsd } from "@/lib/server/fx";

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

  // Map builder pieces → outfit items (first = hero, second = secondary, rest = accent)
  const roles = ["hero", "secondary", "accent"] as const;
  const pieces = (Array.isArray(look.pieces) ? look.pieces : []) as { productId?: string }[];
  const items = pieces.map((p, i) => ({
    product_id: p.productId,
    role: roles[Math.min(i, 2)],
  }));

  // The price is the catalogue's, not the submission's: `total_price` was sent
  // by the shopper's browser, and an outfit approved on it would advertise
  // whatever number arrived. Summed in dollars, as the builder does.
  const productIds = pieces
    .map((p) => p.productId)
    .filter((pid): pid is string => typeof pid === "string" && pid.length > 0);
  const products = await getProductsByIds(productIds);
  // getProductsByIds reports a failed read as an empty list. Publishing on that
  // would put the look in the catalogue at $0, so none found is an error here.
  if (productIds.length > 0 && products.length === 0) {
    return NextResponse.json(
      { error: "None of this look's products could be read from the catalogue, so it cannot be priced. Try again; if it persists, its products may have been removed." },
      { status: 500 }
    );
  }
  const inUsd = async (amount: number, currency: string) =>
    (await toUsd(amount, currency || "USD"))?.usd ?? amount;
  let totalPriceMin = 0;
  let totalPriceMax = 0;
  for (const p of products) {
    totalPriceMin += await inUsd(p.priceMin, p.currency);
    totalPriceMax += await inUsd(p.priceMax, p.currency);
  }
  const cents = (n: number) => Math.round(n * 100) / 100;

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

  // Create an outfit from the pending look
  const { data: outfit, error: insertErr } = await supabase
    .from("outfits")
    .insert({
      name: pick("name", "Community Look"),
      description: pick("description", ""),
      occasion: pick("occasion", "casual"),
      season: pick("season", "all"),
      image_url: look.generated_image,
      items,
      total_price_min: cents(totalPriceMin),
      total_price_max: cents(totalPriceMax),
      currency: "USD",
      style_keywords: styleKeywords,
      is_ai_generated: true,
      is_saved: false,
      source: "community",
    })
    .select("id")
    .single();

  if (insertErr || !outfit) {
    console.error("[looks/approve] insert outfit error:", insertErr);
    return NextResponse.json({ error: insertErr?.message ?? "Failed to create the outfit." }, { status: 500 });
  }

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
