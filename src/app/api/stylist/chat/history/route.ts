import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ── GET /api/stylist/chat/history ─────────────────────────────────────────────
// Returns the saved chat messages for the current user + surface + context.
// Unauthenticated users receive an empty array (drawer still works, no history).

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ messages: [] });
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ messages: [] });
  }

  const { searchParams } = new URL(req.url);
  const surface = searchParams.get("surface") ?? "";
  const contextId = searchParams.get("context_id") ?? "";

  try {
    const { data, error } = await supabase
      .from("stylist_chats")
      .select("messages")
      .eq("user_id", userId)
      .eq("surface", surface)
      .eq("context_id", contextId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ messages: [] });
    }

    return NextResponse.json({ messages: Array.isArray(data.messages) ? data.messages : [] });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}

// ── POST /api/stylist/chat/history ────────────────────────────────────────────
// Upserts the chat messages for the current user + surface + context.
// Unauthenticated or Supabase-unconfigured: silently no-ops (returns 200).

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: true });
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ ok: true });
  }

  let body: { surface?: string; context_id?: string; messages?: unknown[] } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const surface = typeof body?.surface === "string" ? body.surface : "";
  const contextId = typeof body?.context_id === "string" ? body.context_id : "";
  const messages = Array.isArray(body?.messages) ? body.messages : [];

  try {
    await supabase.from("stylist_chats").upsert(
      {
        user_id: userId,
        surface,
        context_id: contextId,
        messages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,surface,context_id" }
    );
  } catch {
    // Silently ignore DB errors — chat still works, just won't be persisted
  }

  return NextResponse.json({ ok: true });
}
