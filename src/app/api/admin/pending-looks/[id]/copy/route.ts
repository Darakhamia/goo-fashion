import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { loadPendingLook, rewritePendingCopy, takenOutfitNames } from "@/lib/server/ai-outfits/review";

/**
 * POST — a new name and description for a queued look, written by the model
 * in the house style and checked like a generated outfit's (Outfits → Pending
 * → review → Rewrite). Nothing is stored: the review dialog's fields are
 * filled, and approval keeps whatever the moderator leaves there.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = await getOpenAIKey();
  if (!apiKey) return NextResponse.json({ error: "No OpenAI key: add one in Settings → OpenAI API Key." }, { status: 503 });

  const { id } = await params;
  const loaded = await loadPendingLook(id);
  if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  try {
    const result = await rewritePendingCopy(loaded.look, loaded.products, apiKey, await takenOutfitNames());
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pending-looks/copy] ${id}:`, message);
    return NextResponse.json({ error: `The model call failed: ${message}` }, { status: 502 });
  }
}
