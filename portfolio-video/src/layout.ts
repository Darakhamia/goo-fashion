// Framing for the two cuts. The rule for both: the subject fills ~70–80% of
// the frame, the type stays legible when the video plays in a card ~800 px
// wide, and nothing is cut at the edges except inside a deliberate viewport.
export type Format = "16x9" | "1x1";

export type Rect = { x: number; y: number; w: number; h: number };

export interface Layout {
  W: number;
  H: number;
  /** The "screen" the desktop pages play in. */
  panel: Rect;
  /** CSS px → video px inside the panel (so the page viewport is panel / scale). */
  panelScale: number;
  /** Hero and end card: the hero group's scale. */
  heroScale: number;
  /** Caption anchor: left edge and baseline. */
  caption: { x: number; y: number; size: number };
  /** Builder: the board and the "In this look" column. */
  builder: { board: Rect; boardScale: number; list: Rect; listScale: number };
  /** Stylist sheet. */
  sheet: Rect & { scale: number };
  /** Browse: how far the page scrolls (CSS px). */
  browseScroll: number;
  /** Product page: laid out at the desktop width the site uses, then the
   *  camera pushes in until "Where to buy" fills `fill` of the panel width. */
  product: { viewportW: number; fill: number; start: { scale: number; cx: number; cy: number } };
  /** Phone frame: top-left and scale of the 420×934 device. */
  phone: { x: number; y: number; scale: number };
  cursorSize: number;
}

export const LAYOUTS: Record<Format, Layout> = {
  "16x9": {
    W: 1920,
    H: 1080,
    panel: { x: 192, y: 64, w: 1536, h: 864 },
    panelScale: 1.6,
    heroScale: 2.5,
    caption: { x: 192, y: 1003, size: 34 },
    builder: {
      board: { x: 262, y: 84, w: 980, h: 840 },
      boardScale: 2,
      list: { x: 1298, y: 84, w: 360, h: 840 },
      listScale: 1.2,
    },
    sheet: { x: 1116, y: 80, w: 588, h: 832, scale: 1.4 },
    browseScroll: 560,
    product: { viewportW: 1440, fill: 0.84, start: { scale: 1536 / 1440, cx: 720, cy: 405 } },
    phone: { x: 769, y: 60, scale: 0.98 },
    cursorSize: 34,
  },
  "1x1": {
    W: 1080,
    H: 1080,
    panel: { x: 70, y: 70, w: 940, h: 840 },
    panelScale: 1.25,
    heroScale: 1.9,
    caption: { x: 70, y: 1001, size: 32 },
    builder: {
      board: { x: 84, y: 112, w: 560, h: 760 },
      boardScale: 1.5,
      list: { x: 676, y: 112, w: 320, h: 760 },
      listScale: 1.06,
    },
    sheet: { x: 404, y: 96, w: 572, h: 800, scale: 1.36 },
    browseScroll: 420,
    product: { viewportW: 1440, fill: 0.88, start: { scale: 0.7, cx: 720, cy: 499 } },
    phone: { x: 334, y: 58, scale: 0.98 },
    cursorSize: 30,
  },
};
