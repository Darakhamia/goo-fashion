import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { supabase } from "@/lib/supabase";
import { PROMPT_META, missingPlaceholders } from "@/lib/server/prompt-defaults";

// Own keys only: `"constructor" in PROMPT_META` is true too, and its "meta"
// would crash the placeholder check.
function isPromptKey(key: unknown): key is string {
  return typeof key === "string" && Object.hasOwn(PROMPT_META, key);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const keys = Object.keys(PROMPT_META);
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", keys);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const saved: Record<string, string> = {};
  for (const row of data ?? []) saved[row.key] = row.value;

  // A blank row is not an override: getPrompt falls back to the default on it,
  // so report it as "no custom value" rather than an empty custom prompt.
  const result = keys.map((key) => ({
    key,
    ...PROMPT_META[key],
    value: saved[key]?.trim() ? saved[key] : null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { key, value } = await req.json().catch(() => ({}));
  if (!isPromptKey(key)) return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  if (typeof value !== "string") return NextResponse.json({ error: "value must be a string" }, { status: 400 });

  const text = value.trim();

  // An empty prompt already runs as the default (getPrompt falls back on an
  // empty value), so store it as exactly that — no override — instead of a row
  // the studio would label as custom.
  if (!text) {
    const { error } = await supabase.from("settings").delete().eq("key", key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAdminAction({
      admin_id: admin.userId,
      action: "settings.prompt_reset",
      target_id: key,
      target_type: "settings",
      metadata: { key },
    });
    return NextResponse.json({ ok: true, reset: true });
  }

  const missing = missingPlaceholders(PROMPT_META[key], text);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required placeholder${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("settings")
    .upsert({ key, value: text, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction({
    admin_id: admin.userId,
    action: "settings.prompt_updated",
    target_id: key,
    target_type: "settings",
    metadata: { key },
  });
  return NextResponse.json({ ok: true, reset: false });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!isPromptKey(key)) return NextResponse.json({ error: "Invalid key" }, { status: 400 });

  const { error } = await supabase.from("settings").delete().eq("key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction({
    admin_id: admin.userId,
    action: "settings.prompt_reset",
    target_id: key,
    target_type: "settings",
    metadata: { key },
  });
  return NextResponse.json({ ok: true });
}
