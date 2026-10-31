import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkNamedRateLimit } from "@/lib/server/rate-limit";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { getProductsByIds } from "@/lib/data/db";
import { normalizeGender } from "@/lib/outfit-gender";
import { MAX_OUTFIT_ITEMS } from "@/lib/outfit-limits";
import { takenOutfitNames, writeOutfitCopy } from "@/lib/server/ai-outfits/write-copy";

/** Suggestions a shopper may ask for in an hour: a few looks' worth of second tries. */
const SUGGESTIONS_PER_HOUR = 30;

/**
 * POST — a name and description for a shopper's look: Suggest in the Builder's
 * Save look and in My looks → Edit info. The same copywriter as the studio's
 * (ai-outfits/write-copy), so a look reads the same wherever it was written up;
 * Suggest used to fill a template from the brands and the price (CEO,
 * 2026-10-31).
 *
 * Signed-in only, and counted per account: it is a model call. The pieces are
 * product ids, read from the catalogue here — nothing about them is taken from
 * the request. Nothing is stored: the dialog's fields are filled, and saving
 * the look keeps what the shopper leaves there.
 */
export async function POST(req: Request) {
  const { userId } = await auth().catch(() => ({ userId: null as string | null }));
  if (!userId) return NextResponse.json({ error: "Sign in to get a suggestion." }, { status: 401 });

  const limit = await checkNamedRateLimit(req, {
    name: "look-copy",
    requests: SUGGESTIONS_PER_HOUR,
    window: "1 h",
    key: userId,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That's a lot of suggestions for one hour. Try again a little later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    productIds?: unknown;
    name?: unknown;
    description?: unknown;
    styleKeywords?: unknown;
    seasons?: unknown;
    gender?: unknown;
  } | null;
  const productIds = Array.isArray(body?.productIds)
    ? [...new Set(body.productIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 100))]
    : [];
  if (!productIds.length || productIds.length > MAX_OUTFIT_ITEMS) {
    return NextResponse.json({ error: `A look has 1 to ${MAX_OUTFIT_ITEMS} pieces.` }, { status: 400 });
  }
  const strings = (v: unknown, max: number) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : [];
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

  const apiKey = await getOpenAIKey();
  if (!apiKey) return NextResponse.json({ error: "Suggestions are not available right now." }, { status: 503 });

  const products = await getProductsByIds(productIds);
  if (!products.length) return NextResponse.json({ error: "This look's pieces could not be found." }, { status: 404 });

  try {
    const result = await writeOutfitCopy(
      {
        productIds,
        products,
        styles: strings(body?.styleKeywords, 10),
        seasons: strings(body?.seasons, 4),
        gender: normalizeGender(body?.gender),
        current: { name: text(body?.name, 200), description: text(body?.description, 2000) },
      },
      apiKey,
      await takenOutfitNames(),
    );
    // The shopper gets the words; the notes and the cost are the studio's business.
    return NextResponse.json({ name: result.name, description: result.description });
  } catch (err) {
    console.error("[looks/copy]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't write a suggestion right now. Try again." }, { status: 502 });
  }
}
