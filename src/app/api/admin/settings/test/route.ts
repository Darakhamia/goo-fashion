import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { requireAdmin } from "@/lib/server/admin-auth";

// POST /api/admin/settings/test
// Validates the stored OpenAI key by listing models (cheap, no generation cost).
// Returns: { ok: boolean, error?: string }
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = await getOpenAIKey();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "No API key configured" });
  }

  try {
    const openai = new OpenAI({ apiKey });
    await openai.models.list();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Key validation failed";
    return NextResponse.json({ ok: false, error: msg });
  }
}
