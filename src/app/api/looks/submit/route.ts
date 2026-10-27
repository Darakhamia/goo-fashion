import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { writeRowDroppingUnknown } from "@/lib/server/write-row";
import { seasonColumns } from "@/lib/data/db";
import { normalizeSeasons } from "@/lib/seasons";
import { normalizeGender } from "@/lib/outfit-gender";
import { requireAdmin } from "@/lib/server/admin-auth";
import { MAX_OUTFIT_ITEMS } from "@/lib/outfit-limits";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  // Every look reaches the catalogue through this queue, an admin's own too
  // (CEO, 2026-10-27; there used to be a straight-to-catalogue route for
  // admins). A shopper's look needs its picture; an admin's may come without
  // one and is published as a collage of its pieces.
  if (!body?.generatedImage && !(await requireAdmin())) {
    return NextResponse.json({ error: "generatedImage is required" }, { status: 400 });
  }
  if (!Array.isArray(body?.pieces) || body.pieces.length === 0) {
    return NextResponse.json({ error: "A look needs at least one piece." }, { status: 400 });
  }
  if (body.pieces.length > MAX_OUTFIT_ITEMS) {
    return NextResponse.json({ error: `An outfit takes up to ${MAX_OUTFIT_ITEMS} pieces.` }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    // Accept gracefully when DB not configured
    return NextResponse.json({ ok: true, id: null });
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
    generated_image: body.generatedImage || null,
    generated_style: body.generatedStyle ?? null,
    pieces: body.pieces ?? [],
    total_price: body.totalPrice ?? null,
    style_keywords: body.styleKeywords ?? [],
    status: "pending",
    look_id: body.lookId ?? null,
    name: text(body.name, 120),
    description: text(body.description, 2000),
    // The seasons it is for (migration 030), and the old single season beside
    // them. The occasion is no longer asked: styles cover it (CEO, 2026-10-27).
    ...seasonColumns(normalizeSeasons(body.seasons ?? [])),
    // Who it is for (migration 032); null = read from the pieces at approval.
    gender: normalizeGender(body.gender),
  };

  // Each of these arrived with a migration, so a database a step behind the
  // deploy drops the ones it lacks and still records the submission — the row
  // matters more than the label. Replaces a retry that dropped `look_id` on any
  // error at all, including real ones.
  const { data, error, dropped } = await writeRowDroppingUnknown<{ id: string }>(
    row,
    ["look_id", "name", "description", "season", "seasons", "gender"],
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
