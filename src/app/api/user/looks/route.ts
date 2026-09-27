import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { writeRowDroppingUnknown } from "@/lib/server/write-row";
import { checkNamedRateLimit } from "@/lib/server/rate-limit";
import {
  asFiniteNumber,
  asHttpUrl,
  asSavedAt,
  asTrimmedString,
  MAX_LOOK_DESCRIPTION_LENGTH,
  MAX_LOOK_NAME_LENGTH,
  sanitizeLookPieces,
  sanitizeStyleKeywords,
} from "@/lib/server/look-input";

// Sign-up is open, so "signed in" is not a cost barrier: every field below is
// held to the share route's rules (lib/server/look-input), and a user gets a
// bucket of writes and a ceiling on rows. Without them one free account could
// loop megabyte looks into user_looks until the database disk filled.
//
// A sync after sign-in pushes every look the device has that the account does
// not (the builder keeps at most 50 locally), so the hourly bucket leaves room
// for one of those plus ordinary editing.
const LOOK_WRITES_PER_HOUR = 60;
// Far above what anyone saves by hand. The cap refuses only new ids, so a user
// at it can still rename, edit and delete what they have.
const MAX_LOOKS_PER_USER = 500;

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

  const limit = await checkNamedRateLimit(req, {
    name: "user-looks",
    requests: LOOK_WRITES_PER_HOUR,
    window: "1 h",
    key: userId,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many saves. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  const id = asTrimmedString(body?.id, 100);
  // An empty list has always been accepted here, so a look saved that way
  // still syncs; a list that is not a builder's is refused.
  const pieces = sanitizeLookPieces(body?.pieces, { allowEmpty: true });
  if (!id || !pieces) {
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
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (existing && existing.user_id !== userId) {
    return NextResponse.json({ error: "Look id belongs to another user" }, { status: 409 });
  }

  if (!existing) {
    const { count, error: countError } = await supabase
      .from("user_looks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }
    // 403 rather than 409 or 429: the client mints a new id on 409 and retries
    // 429, and neither would help here.
    if ((count ?? 0) >= MAX_LOOKS_PER_USER) {
      return NextResponse.json(
        { error: `You can keep up to ${MAX_LOOKS_PER_USER} saved looks. Delete one to save another.` },
        { status: 403 },
      );
    }
  }

  const row: Record<string, unknown> = {
    id,
    user_id: userId,
    saved_at: asSavedAt(body.savedAt),
    look_name: asTrimmedString(body.name, MAX_LOOK_NAME_LENGTH),
    look_description: asTrimmedString(body.description, MAX_LOOK_DESCRIPTION_LENGTH),
    pieces,
    total_price: asFiniteNumber(body.totalPrice),
    style_keywords: sanitizeStyleKeywords(body.styleKeywords),
    generated_image: asHttpUrl(body.generatedImage),
    generated_style: asTrimmedString(body.generatedStyle, 40),
  };

  // Photos are stored by link: generate-outfit persists them to our storage.
  // A data URL (how the builder kept photos before that) or anything else that
  // is not a short http(s) link is not stored. On a look the account already
  // holds, the column is left out rather than cleared, so an edit made on a
  // device with an old data-URL copy does not wipe the photo the row has. A
  // new look is stored without one; its page shows the collage instead.
  const sentImage = typeof body.generatedImage === "string" && body.generatedImage.trim() !== "";
  if (existing && sentImage && !row.generated_image) delete row.generated_image;

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
