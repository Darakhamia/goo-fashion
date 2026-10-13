// The promo's beats, in frames at 30 fps (STORYBOARD.md §2).
export const FPS = 30;

export const BEATS = {
  every: { from: 0, dur: 75 }, // "Every store. / One wardrobe."
  catalogue: { from: 75, dur: 120 }, // product shots fly into the real grid
  build: { from: 195, dur: 54 }, // "Build the look."
  builder: { from: 249, dur: 135 }, // pieces snap onto the board, the total counts up
  ask: { from: 384, dur: 54 }, // "Ask the AI stylist."
  stylist: { from: 438, dur: 150 }, // a typed question, a look in the chat
  find: { from: 588, dur: 66 }, // "Find where to buy / every piece."
  product: { from: 654, dur: 105 }, // the product page and its stores
  end: { from: 759, dur: 96 }, // GOO · Build your look · goo-fashion.com
} as const;

export const DURATION = BEATS.end.from + BEATS.end.dur; // 855 = 28.5 s

/** Frames of the key beats, for the approval stills and the poster. */
export const STILLS = {
  every: BEATS.every.from + 50,
  catalogue: BEATS.catalogue.from + 112,
  builder: BEATS.builder.from + 128,
  stylist: BEATS.stylist.from + 146,
  product: BEATS.product.from + 98,
  end: BEATS.end.from + 76,
} as const;

/** The poster: the builder with the board filled and the total settled. */
export const POSTER_FRAME = STILLS.builder;
