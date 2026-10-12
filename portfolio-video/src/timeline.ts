// 24 s at 30 fps. Scenes overlap by a few frames so each hand-off is a
// cross-dissolve rather than a cut. Frame 719 (the last) draws the same picture
// as frame 0: the end card at rest.
export const DURATION = 720;

export const SCENES = {
  hero: { from: 0, to: 96 },
  browse: { from: 84, to: 216 },
  builder: { from: 204, to: 351 },
  stylist: { from: 339, to: 471 },
  product: { from: 459, to: 640 },
  phone: { from: 560, to: 651 },
  end: { from: 640, to: 720 },
} as const;

export const CAPTIONS = [
  { text: "Browse every store", from: 98, to: 208 },
  { text: "Build the look", from: 220, to: 340 },
  { text: "Ask the AI stylist", from: 354, to: 462 },
  { text: "Best price, found", from: 476, to: 566 },
];

/** Builder: when each piece lands (scene-local frames). */
export const BUILDER_PICKS = [22, 40, 58, 76, 94];
/** The builder frame used for the poster: every piece in, total settled. */
export const POSTER_LOCAL_FRAME = 134;
