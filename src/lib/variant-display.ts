import type { Product, ProductSwatch } from "@/lib/types";

/**
 * What a card should actually show for a product, once a colour has been picked.
 *
 * A colour variant is a *separate product row* with its own name, price and
 * photos, so switching swatches changes more than the picture. The builder was
 * swapping the photo and leaving the name and price of the row the card started
 * on — a striped jacket labelled "Black Bomber Jacket" at the black one's price.
 *
 * Kept here because four places in the builder and the catalogue card all have
 * to answer the same question, and they were each answering part of it.
 */
export interface DisplayedProduct {
  name: string;
  priceMin: number;
  priceMax: number;
  /** Every photo to show, in order. Never empty unless the row has none. */
  images: string[];
  /** The first of `images`, for the places that show only one. */
  imageUrl: string | undefined;
  /** The backdrop measured for whichever photo is on screen. */
  bgColor: string | null | undefined;
}

export function displayedProduct(
  product: Product,
  options: {
    /** A colour variant — a different product row. */
    variant?: ProductSwatch | null;
    /**
     * Photos for a colourway *within this row* (`product.colorImages`). These
     * override the pictures but not the name or price, because the row — and so
     * what it is called and costs — has not changed.
     */
    colorImages?: string[] | null;
  } = {},
): DisplayedProduct {
  const { variant, colorImages } = options;

  const fallback = (list: string[] | undefined, single: string | undefined) =>
    list?.length ? list : single ? [single] : [];

  const images = colorImages?.length
    ? colorImages
    : variant
    ? fallback(variant.images, variant.imageUrl)
    : fallback(product.images, product.imageUrl);

  return {
    name: variant?.name ?? product.name,
    priceMin: variant?.priceMin ?? product.priceMin,
    priceMax: variant?.priceMax ?? product.priceMax,
    images,
    imageUrl: images[0],
    // A colourway from this row was shot for this row, so it keeps the row's
    // backdrop; a variant is its own row and carries its own.
    bgColor: colorImages?.length ? product.bgColor : variant?.bgColor ?? product.bgColor,
  };
}
