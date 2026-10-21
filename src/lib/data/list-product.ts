/**
 * A product as a catalogue list carries it: what a card, the filters and the
 * builder read, and nothing else.
 *
 * /browse, /builder and the stylist drawer each take the whole catalogue —
 * about 4,000 pieces — so that filtering and paging are instant. They took it
 * as the database holds it: every description (up to 5,000 characters), every
 * size, every photo of every colourway, the product codes and the exchange
 * rate. None of that is read by a card or a filter. The product page reads its
 * product in full on its own, so a list item only has to get there.
 *
 * Dropped, as empty values where the type requires one: description, sizes
 * (the piece's and each colourway's), gtin/mpn/sku, the store's own price and
 * its exchange rate, updatedAt. Photos are kept to the four a card cycles
 * through on hover. Everything else — price, stores, colours, styles, gender,
 * crop, backdrop, the material the builder's image prompt names — stays.
 */
import type { Outfit, Product, ProductSwatch } from "@/lib/types";

/**
 * Photos a list keeps per piece and per colourway. A card cycles through them
 * on hover, and four make that cycle; the product page has all of them. Photo
 * addresses were most of what a list carried once descriptions were gone.
 */
export const LIST_PHOTOS = 4;

const firstPhotos = (list: string[] | undefined): string[] => (list ?? []).slice(0, LIST_PHOTOS);

function listSwatch(s: ProductSwatch): ProductSwatch {
  return { ...s, images: firstPhotos(s.images), sizes: [] };
}

export function toListProduct(p: Product): Product {
  const kept: Product = {
    ...p,
    description: "",
    sizes: [],
    images: firstPhotos(p.images),
    ...(p.colorImages && {
      colorImages: Object.fromEntries(
        Object.entries(p.colorImages).map(([colour, photos]) => [colour, firstPhotos(photos)]),
      ),
    }),
    ...(p.variants && { variants: p.variants.map(listSwatch) }),
  };
  delete kept.gtin;
  delete kept.mpn;
  delete kept.sku;
  delete kept.sourcePrice;
  delete kept.sourceCurrency;
  delete kept.fxRate;
  delete kept.fxDate;
  delete kept.updatedAt;
  return kept;
}

/**
 * An outfit as a list carries it. Its pieces are full products in the database
 * read; an outfit card shows how many there are, so they travel as list items.
 */
export function toListOutfit(o: Outfit): Outfit {
  return { ...o, items: o.items.map((item) => ({ ...item, product: toListProduct(item.product) })) };
}
