/**
 * What the moderator can redo on a look waiting in the queue (Outfits →
 * Pending → review): draw its picture again, and write its name and
 * description again — for a look the AI put together and a shopper's alike
 * (CEO, 2026-10-27).
 *
 * The picture is drawn as the builder draws one (lib/server/outfit-image) and
 * replaces the look's own. The words come from the site's one copywriter
 * (write-copy.ts) and are only proposed: they fill the review dialog's fields,
 * and approval stores whatever the moderator keeps.
 */
import type { Product } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { getProductsByIds } from "@/lib/data/db";
import { generateOutfitImage, type ImageStyle, type OutfitImageResult } from "@/lib/server/outfit-image";
import { seasonsFromRow } from "@/lib/seasons";
import { normalizeGender } from "@/lib/outfit-gender";
import { writeOutfitCopy, type WrittenCopy } from "./write-copy";

export { takenOutfitNames } from "./write-copy";

export interface PendingRow {
  id: string;
  name: string | null;
  description: string | null;
  pieces: { slot?: string; productId?: string; imageUrl?: string; name?: string }[] | null;
  style_keywords: string[] | null;
  season?: string | null;
  seasons?: string[] | null;
  gender?: string | null;
  ai_meta?: Record<string, unknown> | null;
  generated_style?: string | null;
}

/** A look still waiting in the queue, with its pieces read from the catalogue. */
export async function loadPendingLook(id: string): Promise<{ look: PendingRow; products: Product[] } | { error: string; status: number }> {
  if (!supabase) return { error: "Database not configured.", status: 503 };
  const { data, error } = await supabase.from("pending_looks").select("*").eq("id", id).eq("status", "pending").maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!data) return { error: "This look is no longer pending — it was approved or rejected.", status: 404 };
  const look = data as PendingRow;
  const ids = (look.pieces ?? []).map((p) => p.productId).filter((x): x is string => typeof x === "string" && x.length > 0);
  const products = await getProductsByIds(ids);
  if (ids.length && !products.length) return { error: "None of this look's pieces could be read from the catalogue.", status: 500 };
  return { look, products };
}

// ── The picture ──────────────────────────────────────────────────────────────

export async function redrawPendingLook(
  look: PendingRow,
  products: Product[],
  style: Exclude<ImageStyle, "tryon">,
  owner: string,
  apiToken: string,
): Promise<OutfitImageResult> {
  const byId = new Map(products.map((p) => [p.id, p]));
  const pieces = (look.pieces ?? [])
    .map((piece) => {
      const p = piece.productId ? byId.get(piece.productId) : undefined;
      if (!p) return null;
      return {
        slot: piece.slot ?? p.category,
        name: p.name,
        brand: p.brand,
        category: p.category,
        material: p.material || undefined,
        colors: p.colors,
        styleKeywords: p.styleKeywords,
        // The colourway the look was saved with, when the piece carries its photo.
        imageUrl: piece.imageUrl || p.imageUrl,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const result = await generateOutfitImage({ apiToken, pieces, style, owner });
  if (!result.ok || !supabase) return result;

  // The new picture replaces the look's own; a generated look's note that its
  // picture failed goes with the old one.
  const meta = look.ai_meta ? { ...look.ai_meta } : null;
  if (meta) delete meta.imageError;
  const { error } = await supabase
    .from("pending_looks")
    .update({ generated_image: result.imageUrl, generated_style: style, ...(meta && { ai_meta: meta }) })
    .eq("id", look.id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message, failedUrls: [] };
  return result;
}

// ── The words ────────────────────────────────────────────────────────────────

/** A new name and description for a queued look, checked; nothing is stored (write-copy.ts). */
export async function rewritePendingCopy(
  look: PendingRow,
  products: Product[],
  apiKey: string,
  takenNames: Set<string>,
): Promise<WrittenCopy> {
  return writeOutfitCopy(
    {
      productIds: (look.pieces ?? []).map((p) => p.productId).filter((x): x is string => typeof x === "string" && x.length > 0),
      products,
      styles: look.style_keywords ?? [],
      seasons: seasonsFromRow(look),
      gender: normalizeGender(look.gender),
      current: { name: look.name ?? "", description: look.description ?? "" },
    },
    apiKey,
    takenNames,
  );
}
