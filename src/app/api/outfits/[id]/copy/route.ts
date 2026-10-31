import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { getOutfitById } from "@/lib/data/db";
import { normalizeGender } from "@/lib/outfit-gender";
import { takenOutfitNames, writeOutfitCopy } from "@/lib/server/ai-outfits/write-copy";

/**
 * POST — a new name and description for a published outfit (Outfits → Edit →
 * Rewrite name and description), from the site's one copywriter
 * (ai-outfits/write-copy), as a queued look's review has it. Only the review
 * could do this, so an outfit already on the site kept whatever words it was
 * approved with (CEO, 2026-10-31).
 *
 * The body is the editor as it stands — styles, seasons, who it is for, the
 * name and description in the fields — since the admin may have changed them
 * without saving. The pieces are the outfit's own, read from the catalogue.
 * Nothing is stored: the editor's fields are filled, and Save keeps them.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = await getOpenAIKey();
  if (!apiKey) return NextResponse.json({ error: "No OpenAI key: add one in Settings → OpenAI API Key." }, { status: 503 });

  const { id } = await params;
  const outfit = await getOutfitById(id);
  if (!outfit) return NextResponse.json({ error: "Outfit not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    description?: unknown;
    styleKeywords?: unknown;
    seasons?: unknown;
    gender?: unknown;
  };
  const list = (v: unknown, fallback: string[]) => (Array.isArray(v) ? v.map(String) : fallback);
  // Its stored name is its own, whatever the field now says.
  const taken = await takenOutfitNames();
  taken.delete(outfit.name.trim().toLowerCase());

  try {
    const result = await writeOutfitCopy(
      {
        productIds: outfit.items.map((i) => i.product.id),
        products: outfit.items.map((i) => i.product),
        styles: list(body.styleKeywords, outfit.styleKeywords),
        seasons: list(body.seasons, outfit.seasons),
        gender: normalizeGender(body.gender) ?? outfit.gender ?? null,
        current: {
          name: typeof body.name === "string" ? body.name : outfit.name,
          description: typeof body.description === "string" ? body.description : outfit.description,
        },
      },
      apiKey,
      taken,
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[outfits/copy] ${id}:`, message);
    return NextResponse.json({ error: `The model call failed: ${message}` }, { status: 502 });
  }
}
