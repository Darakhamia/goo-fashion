import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { writeRowDroppingUnknown } from "@/lib/server/write-row";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("user_looks")
    .select("*")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const looks = (data ?? []).map((r) => ({
    id: r.id,
    savedAt: r.saved_at,
    name: r.look_name ?? undefined,
    description: r.look_description ?? undefined,
    pieces: r.pieces,
    totalPrice: r.total_price,
    styleKeywords: r.style_keywords,
    generatedImage: r.generated_image,
    generatedStyle: r.generated_style,
  }));

  return NextResponse.json(looks);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.pieces) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ ok: true });
  }

  // Ids may be minted client-side and can collide across users — never let one
  // user's sync overwrite another user's look.
  const { data: existing, error: lookupError } = await supabase
    .from("user_looks")
    .select("user_id")
    .eq("id", body.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (existing && existing.user_id !== userId) {
    return NextResponse.json({ error: "Look id belongs to another user" }, { status: 409 });
  }

  const row: Record<string, unknown> = {
    id: body.id,
    user_id: userId,
    saved_at: body.savedAt ?? new Date().toISOString(),
    look_name: body.name ?? null,
    look_description: body.description ?? null,
    pieces: body.pieces,
    total_price: body.totalPrice ?? null,
    style_keywords: body.styleKeywords ?? [],
    generated_image: body.generatedImage ?? null,
    generated_style: body.generatedStyle ?? null,
  };

  // If the optional name/description columns aren't present in this environment
  // (migration 009 not applied), persist the core look anyway rather than
  // failing the whole save — the look itself must never be lost.
  //
  // What changed: the previous version matched /look_name|look_description|column/
  // against ANY error and then answered `{ ok: true }`. Two things followed from
  // that. A rename against a database missing those columns was dropped and
  // reported as a success, so it stuck on the phone that made it and was gone
  // everywhere else — with nothing anywhere saying why. And any unrelated error
  // whose message happened to contain the word "column" stripped the name too.
  //
  // The shared writer drops only what it is told it may drop, and only on
  // PostgREST's unknown-column code, and it says what it dropped.
  const { error, dropped } = await writeRowDroppingUnknown<null>(
    row,
    ["look_name", "look_description"],
    (payload) => supabase!.from("user_looks").upsert(payload, { onConflict: "id" }).then(
      ({ error: e }) => ({ data: null, error: e }),
    ),
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (dropped.length) {
    console.warn(
      `[user/looks] saved without ${dropped.join(", ")} — run supabase/migrations/009_user_looks_share.sql; ` +
      "until then names and descriptions cannot follow a look between devices",
    );
  }

  // Reported rather than hidden: the caller asked to store a name, and it is
  // entitled to know the name did not reach the account.
  return NextResponse.json({ ok: true, dropped });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("user_looks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
