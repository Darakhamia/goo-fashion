import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { writeRowDroppingUnknown } from "@/lib/server/write-row";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.generatedImage) {
    return NextResponse.json({ error: "generatedImage is required" }, { status: 400 });
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
    generated_image: body.generatedImage,
    generated_style: body.generatedStyle ?? null,
    pieces: body.pieces ?? [],
    total_price: body.totalPrice ?? null,
    style_keywords: body.styleKeywords ?? [],
    status: "pending",
    look_id: body.lookId ?? null,
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
