import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { clerkClient } from "@clerk/nextjs/server";

// Returns a masked version of the key — never returns the raw value to the browser.
function maskKey(key: string): string {
  if (key.length <= 12) return "•".repeat(key.length);
  return key.slice(0, 8) + "•".repeat(Math.max(4, key.length - 12)) + key.slice(-4);
}

// GET /api/admin/settings?key=openai_api_key
// Returns: { configured: boolean, source: "env" | "database" | null, maskedKey?: string }
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (key !== "openai_api_key") {
    return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
  }

  // Env var takes priority — managed outside this UI
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) {
    return NextResponse.json({ configured: true, source: "env", maskedKey: maskKey(envKey) });
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ configured: false, source: null });
  }

  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "openai_api_key")
    .maybeSingle();

  const stored = (data as { value: string } | null)?.value?.trim();
  if (!stored) {
    return NextResponse.json({ configured: false, source: null });
  }

  return NextResponse.json({ configured: true, source: "database", maskedKey: maskKey(stored) });
}

// POST /api/admin/settings
// Body: { key: "openai_api_key", value: "sk-proj-..." }
// Returns: { ok: true, maskedKey: string }
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.key || typeof body.value !== "string") {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
  }
  if (body.key !== "openai_api_key") {
    return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
  }

  const value = body.value.trim();
  if (!value.startsWith("sk-")) {
    return NextResponse.json({ error: "Invalid API key format — must begin with sk-" }, { status: 400 });
  }

  const { error } = await supabase
    .from("settings")
    .upsert(
      { key: "openai_api_key", value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log — fire-and-forget
  try {
    const cc = await clerkClient();
    const adminUser = await cc.users.getUser(admin.userId);
    void logAdminAction({
      admin_id: admin.userId,
      admin_email: adminUser.emailAddresses[0]?.emailAddress,
      action: "settings.api_key_updated",
      target_type: "settings",
      metadata: { key: body.key },
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true, maskedKey: maskKey(value) });
}

// DELETE /api/admin/settings?key=openai_api_key
// Returns: { ok: true }
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (key !== "openai_api_key") {
    return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
  }

  const { error } = await supabase
    .from("settings")
    .delete()
    .eq("key", "openai_api_key");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit log — fire-and-forget
  try {
    const cc = await clerkClient();
    const adminUser = await cc.users.getUser(admin.userId);
    void logAdminAction({
      admin_id: admin.userId,
      admin_email: adminUser.emailAddresses[0]?.emailAddress,
      action: "settings.api_key_deleted",
      target_type: "settings",
      metadata: { key },
    });
  } catch { /* non-critical */ }

  return NextResponse.json({ ok: true });
}
