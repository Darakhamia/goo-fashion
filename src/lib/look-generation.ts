import type { Product } from "@/lib/types";
import type { SavedLook } from "@/lib/looks-storage";

/**
 * The pieces of a saved look, in the shape `/api/generate-outfit` reads.
 *
 * A saved look stores only what it needs to be displayed and re-opened — a slot,
 * a product id, sometimes a variant and a thumbnail. The generator needs what
 * the *catalogue* knows: brand, category, material, colours, the style words,
 * and the photo of the right colour variant. So the two are joined here.
 *
 * Kept out of the page so it can be tested against real products rather than
 * only looked at. The builder does the same join from its own selection state;
 * this is the version for a look that has already been saved.
 */
export interface GenerationPiece {
  slot: string;
  name: string;
  brand: string;
  category: string;
  material?: string;
  colors?: string[];
  colorName?: string;
  styleKeywords?: string[];
  imageUrl?: string;
}

export function generationPieces(
  pieces: SavedLook["pieces"],
  allProducts: Product[],
): GenerationPiece[] {
  const byId = new Map(allProducts.map((p) => [p.id, p]));

  return pieces.map((piece) => {
    const product = byId.get(piece.productId);
    // The look may name a colour variant. Its photo and colour are what the
    // generator must see — regenerating in the wrong colourway is not a
    // regeneration of this look.
    const variant = piece.variantId
      ? product?.variants?.find((v) => v.id === piece.variantId)
      : undefined;

    return {
      slot: piece.slot,
      // A product missing from the catalogue (delisted, or the list not loaded)
      // still contributes what the look itself remembers, rather than dropping
      // out of the shot.
      name: product?.name ?? piece.name ?? piece.slot,
      brand: product?.brand ?? "",
      category: product?.category ?? "",
      material: product?.material || undefined,
      colors: product?.colors?.length ? product.colors : undefined,
      colorName: variant?.colorName || undefined,
      styleKeywords: product?.styleKeywords?.length ? product.styleKeywords : undefined,
      // Variant, then the catalogue, then whatever the look kept. The order
      // matters: the catalogue's photo is the one we mirror and maintain, while
      // the look's is a snapshot that can be a merchant URL which has since gone
      // dead — and a reference the generator cannot fetch drops that piece out
      // of the shot silently. The builder resolves it the same way; the look's
      // own copy is the last resort, for a product no longer in the catalogue.
      imageUrl: variant?.imageUrl || product?.imageUrl || piece.imageUrl || undefined,
    };
  });
}
