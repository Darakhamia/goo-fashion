import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { checkNamedRateLimit } from "@/lib/server/rate-limit";

// ── Limits ────────────────────────────────────────────────────────────────────
// Any signed-in account (sign-up is open) could upsert any JSON into
// `stylist_chats`, under any surface and context it made up — so without these,
// one free account could write rows of megabytes without end, and the sessions
// list, which reads 30 rows whole, could be made to pull hundreds of MB into the
// server. The drawer saves the whole conversation after each reply, so the
// ceilings are set well above a real one.

/** The drawer's own surfaces (StylistDrawer's `surface` prop). */
const SURFACES = new Set(["builder", "browse", "product"]);
/** A product id, or "" — the drawer keys a conversation by the product in focus. */
const MAX_CONTEXT_ID_LENGTH = 128;
/** The most recent messages kept; older ones fall off the stored copy. */
const MAX_MESSAGES = 100;
// A reply is capped at 600 model tokens (stylist/chat), which is under this in
// any language, so a real message is never cut.
const MAX_TEXT_LENGTH = 4000;
const MAX_SUGGESTIONS = 12;
const MAX_ID_LENGTH = 100;
/** A body this size already holds far more than MAX_MESSAGES real messages. */
const MAX_BODY_BYTES = 200 * 1024;
/** Distinct conversations kept per user; the history panel lists 30. */
const MAX_CHATS_PER_USER = 50;
/** One save per reply, and the chat itself allows 10 replies a minute. */
const SAVES_PER_MINUTE = 30;

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Product ids; the drawer looks them up in the catalogue it has loaded. */
  suggestions?: string[];
}

/**
 * The stored form of a conversation: the last MAX_MESSAGES messages, each with
 * only the fields the drawer reads, text capped, suggestions as product ids.
 *
 * Rows saved before this held whole product objects in `suggestions` (which the
 * drawer then could not match by id, so a reloaded chat lost its products);
 * those are read as their ids, so old rows load and new ones stay small.
 */
function sanitizeMessages(raw: unknown): StoredMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredMessage[] = [];
  raw.slice(-MAX_MESSAGES).forEach((entry, i) => {
    if (!entry || typeof entry !== "object") return;
    const m = entry as Record<string, unknown>;
    if ((m.role !== "user" && m.role !== "assistant") || typeof m.text !== "string") return;
    const msg: StoredMessage = {
      id: typeof m.id === "string" && m.id ? m.id.slice(0, MAX_ID_LENGTH) : `msg-${i}`,
      role: m.role,
      // Never cut a character in half: jsonb refuses a lone surrogate.
      text: m.text.slice(0, MAX_TEXT_LENGTH).replace(/[\uD800-\uDBFF]$/, ""),
    };
    if (m.role === "assistant" && Array.isArray(m.suggestions)) {
      const ids = m.suggestions
        .map((s) =>
          typeof s === "string"
            ? s
            : s && typeof s === "object" && typeof (s as { id?: unknown }).id === "string"
              ? (s as { id: string }).id
              : null,
        )
        .filter((id): id is string => !!id && id.length <= MAX_ID_LENGTH)
        .slice(0, MAX_SUGGESTIONS);
      if (ids.length > 0) msg.suggestions = ids;
    }
    out.push(msg);
  });
  return out;
}

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

    // Through the same filter as a save, so a row written before the limits
    // comes back in the shape the drawer reads — ids, not product objects.
    return NextResponse.json({ messages: sanitizeMessages(data.messages) });
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

  const limit = await checkNamedRateLimit(req, {
    name: "stylist-history",
    requests: SAVES_PER_MINUTE,
    window: "1 m",
    key: userId,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many saves. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Chat history is too large." }, { status: 413 });
  }

  let body: { surface?: unknown; context_id?: unknown; messages?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const surface = typeof body?.surface === "string" ? body.surface : "";
  const contextId = typeof body?.context_id === "string" ? body.context_id : "";
  if (!SURFACES.has(surface) || contextId.length > MAX_CONTEXT_ID_LENGTH) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const messages = sanitizeMessages(body?.messages);

  try {
    // A conversation already stored can always be saved again; a new one only
    // while the user is under the ceiling. The drawer does not read the answer,
    // so a refusal costs nothing but that chat's place in the history.
    const { data: existing, error: lookupError } = await supabase
      .from("stylist_chats")
      .select("context_id")
      .eq("user_id", userId)
      .eq("surface", surface)
      .eq("context_id", contextId)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ ok: true });
    if (!existing) {
      const { count, error: countError } = await supabase
        .from("stylist_chats")
        .select("context_id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (countError) return NextResponse.json({ ok: true });
      if ((count ?? 0) >= MAX_CHATS_PER_USER) {
        return NextResponse.json({ error: "Chat history is full." }, { status: 403 });
      }
    }

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
