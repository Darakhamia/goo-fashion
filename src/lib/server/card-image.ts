/**
 * Draw a catalogue card as a picture: the photo, the brand, the piece's name
 * and its price, inside the card's own frame.
 *
 * The export hands back what an admin would otherwise screenshot one card at a
 * time — the card as the site draws it, not the bare photo behind it. So this
 * module is a re-implementation of `ProductCard`/`OutfitCard` in pixels: the
 * same 3:4 photo box, the same 20px gutters, the same three lines of type in the
 * same weights and colours, on the dark theme the studio runs in. The numbers
 * here are the CSS pixels those components are written in, multiplied by SCALE
 * on the way out, so a change in the components can be followed literally.
 *
 * Type is the awkward part of drawing a card outside a browser. Text is laid out
 * by librsvg through fontconfig, which on a serverless host has no fonts at all
 * and would silently render nothing — so the three weights of Inter Tight the
 * site uses are committed under src/assets/fonts and pointed at by a fontconfig
 * file this module writes into the temp directory on first use.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** How many image pixels one CSS pixel of the card becomes. */
const SCALE = 3;

// ── Geometry, in the CSS pixels the card components are written in ───────────

/** Width of a catalogue card in a desktop grid; everything else follows it. */
const CARD_W = 320;
/** The photo box: `aspect-[3/4]`. */
const PHOTO_H = Math.round((CARD_W * 4) / 3);
/** The info block's `px-5 pt-4 pb-5`. */
const PAD_X = 20;
const PAD_TOP = 16;
const PAD_BOTTOM = 20;

// ── Dark-theme tokens, copied from globals.css ───────────────────────────────

const BACKGROUND = "#0A0A0A";
const SURFACE = "#141414";
const FOREGROUND = "#F0EEE8";
const FOREGROUND_MUTED = "#888884";
const FOREGROUND_SUBTLE = "#6E6E6A";
const BORDER = "#222220";
/** `bg-white` behind a contained product photo whose backdrop was never measured. */
const PHOTO_BACKDROP = "#FFFFFF";

// ── Type ─────────────────────────────────────────────────────────────────────

const FONT_DIR = path.join(process.cwd(), "src/assets/fonts");

/**
 * The three weights the cards use. Each static Inter Tight file names itself
 * both "Inter Tight" and "Inter Tight <Style>"; the second is what a Pango font
 * description has to say to get that exact file rather than the family default.
 */
const WEIGHTS = {
  400: { file: "InterTight-Regular.ttf", pango: "Inter Tight" },
  500: { file: "InterTight-Medium.ttf", pango: "Inter Tight Medium" },
  600: { file: "InterTight-SemiBold.ttf", pango: "Inter Tight SemiBold" },
} as const;

type Weight = keyof typeof WEIGHTS;

/**
 * Inter Tight's own ascent and descent, in ems (hhea: 1984/-494 per 2048).
 * A CSS line box centres the two inside `line-height`, which is what puts a
 * baseline where the browser puts it.
 */
const ASCENT = 1984 / 2048;
const DESCENT = 494 / 2048;

let fontsReady = false;

/**
 * Point fontconfig at the fonts we ship, once per process.
 *
 * The system config is included rather than replaced, so a host that does have
 * fonts keeps them as fallback for a character Inter Tight cannot set — and a
 * host that has none (the usual serverless image) simply gets ours. Both the
 * config and the cache go to the temp directory because it is the only writable
 * path on such a host.
 */
function ensureFonts(): void {
  if (fontsReady) return;
  // Said out loud, because the alternative is silent: a renderer with no font to
  // set the type in draws the photo and simply leaves the brand, the name and
  // the price off the card, and nothing downstream can tell that apart from a
  // card that had nothing to say. Missing here means the deploy did not carry
  // src/assets/fonts — see `outputFileTracingIncludes` in next.config.ts.
  for (const weight of Object.values(WEIGHTS)) {
    const file = path.join(FONT_DIR, weight.file);
    if (!existsSync(file)) throw new Error(`Card font is missing from this deploy: ${file}`);
  }
  const cacheDir = path.join(tmpdir(), "goo-fontconfig-cache");
  const configPath = path.join(tmpdir(), "goo-fonts.conf");
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(
    configPath,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${escapeXml(FONT_DIR)}</dir>
  <cachedir>${escapeXml(cacheDir)}</cachedir>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
</fontconfig>
`,
  );
  // Read by fontconfig when it first initialises, which is inside the first
  // render below — nothing in this process draws text before that.
  process.env.FONTCONFIG_FILE = configPath;
  fontsReady = true;
}

/** sharp is a native module; a platform without it cannot draw a card at all. */
async function loadSharp(): Promise<typeof import("sharp")> {
  try {
    return (await import("sharp")).default;
  } catch {
    throw new Error("sharp is not available on this server");
  }
}

/** Text safe to drop into SVG content and into Pango markup alike. */
function escapeXml(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * How wide a string renders, in CSS pixels.
 *
 * Measured by rendering it: there are no font metrics to consult here, and the
 * alternative — counting characters — is what makes an exported card show half a
 * word. The measurement is of inked pixels, so it comes out a hair narrower than
 * the advance width the SVG will use; callers leave a margin for that.
 */
async function inkWidth(text: string, size: number, weight: Weight): Promise<number> {
  if (!text) return 0;
  const sharp = await loadSharp();
  const font = WEIGHTS[weight];
  const { info } = await sharp({
    text: {
      text: escapeXml(text),
      font: `${font.pango} ${Math.round(size * SCALE)}px`,
      fontfile: path.join(FONT_DIR, font.file),
      rgba: true,
      dpi: 72,
      wrap: "none",
    },
  })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return info.width / SCALE;
}

/**
 * The `truncate` of the cards: the string if it fits, else as much of it as fits
 * with an ellipsis.
 *
 * The first cut is proportional — a string 30% too wide loses roughly 30% of its
 * characters — and then it walks back until it fits, which is one or two more
 * renders for a name that overflows and none at all for the many that don't.
 * Code points rather than UTF-16 units, so a cut never lands inside an emoji.
 */
async function fitText(text: string, maxWidth: number, size: number, weight: Weight): Promise<string> {
  const clean = text.trim();
  if (!clean) return "";
  const width = await inkWidth(clean, size, weight);
  if (width <= maxWidth) return clean;

  const chars = Array.from(clean);
  let cut = Math.max(1, Math.floor(chars.length * (maxWidth / width)));
  for (let guard = 0; guard < 12 && cut > 1; guard++) {
    const candidate = `${chars.slice(0, cut).join("").trimEnd()}…`;
    if ((await inkWidth(candidate, size, weight)) <= maxWidth) return candidate;
    cut -= Math.max(1, Math.round(cut * 0.08));
  }
  return `${chars[0]}…`;
}

// ── The card ─────────────────────────────────────────────────────────────────

export interface CardSpec {
  /** Which recipe to draw: a piece's card, or a look's. */
  kind: "product" | "look";
  /** First line, semibold: the brand on a piece, the name on a look. */
  title: string;
  /** Second line, muted: the piece's name. A look has none. */
  subtitle?: string;
  /** Price line, already written in the card's own currency. */
  price: string;
  /** The "· 3 colors" tail a piece with colour variants carries. */
  colors?: string;
  /** The corner flag, "New" on a piece that has one. */
  badge?: string;
  /**
   * The focal point of the admin's crop, when the piece has one. Its presence is
   * what switches the photo from `object-contain` to the `object-cover` a
   * cropped card uses; a look's photo covers either way.
   */
  focal?: { x: number; y: number };
  /** The backdrop measured from a piece's photo, where one was measured. */
  backdrop?: string | null;
}

/** `rounded-xl` on a piece, `rounded-2xl` on a look. */
function radiusOf(spec: CardSpec): number {
  return spec.kind === "product" ? 12 : 16;
}

/** How the photo fills its box, in the terms `object-fit` uses. */
function fitOf(spec: CardSpec): "contain" | "cover" {
  return spec.kind === "look" || spec.focal ? "cover" : "contain";
}

/** The colour of the photo box itself: `bg-white` on a piece, the surface on a look. */
function boxColor(spec: CardSpec): string {
  if (spec.kind === "look") return SURFACE;
  return spec.backdrop && HEX.test(spec.backdrop) ? spec.backdrop : PHOTO_BACKDROP;
}

/** One line of the info block, positioned the way its CSS classes position it. */
interface Line {
  text: string;
  size: number;
  weight: Weight;
  color: string;
  /** `leading-snug` is 1.375; the price line keeps the body's own leading. */
  leading: number;
  /** The `mt-*` above this line. */
  marginTop: number;
  /** The smaller, subtler run after the text, on a piece's price line only. */
  tail?: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Where a line's baseline sits below the top of its line box. */
function baselineIn(line: Line): number {
  const box = line.size * line.leading;
  return (box - line.size * (ASCENT + DESCENT)) / 2 + line.size * ASCENT;
}

/** The lines of the info block, in the order the card stacks them. */
async function layOutLines(spec: CardSpec): Promise<Line[]> {
  const inner = CARD_W - PAD_X * 2;
  // The measurement runs on inked pixels, so leave a little room for the side
  // bearings the renderer will add back.
  const room = inner * 0.98;
  // A look's price sits under its name as a second muted line; a piece's is set
  // in the card's own weight, with the colour count trailing it.
  const isLook = spec.kind === "look";

  const lines: Line[] = [
    {
      text: await fitText(spec.title, room, 15, 600),
      size: 15,
      weight: 600,
      color: FOREGROUND,
      leading: 1.375,
      marginTop: 0,
    },
  ];

  if (!isLook) {
    lines.push({
      text: await fitText(spec.subtitle ?? "", room, 13, 400),
      size: 13,
      weight: 400,
      color: FOREGROUND_MUTED,
      leading: 1.375,
      marginTop: 2,
    });
  }

  lines.push({
    text: await fitText(spec.price, spec.colors ? room * 0.6 : room, isLook ? 13 : 14, isLook ? 400 : 500),
    size: isLook ? 13 : 14,
    weight: isLook ? 400 : 500,
    color: isLook ? FOREGROUND_MUTED : FOREGROUND,
    leading: isLook ? 1.375 : 1.4,
    marginTop: isLook ? 4 : 8,
    tail: spec.colors,
  });

  return lines;
}

/** Total card height in CSS pixels: the photo box plus the info block. */
function cardHeight(lines: Line[]): number {
  const info = lines.reduce((sum, line) => sum + line.marginTop + line.size * line.leading, 0);
  return Math.round(PHOTO_H + PAD_TOP + info + PAD_BOTTOM);
}

/** The type, the corner flag and the card's border, as one vector layer. */
function overlaySvg(spec: CardSpec, lines: Line[], height: number, badgeWidth: number): string {
  const parts: string[] = [];

  if (spec.badge) {
    // `top-3 left-3`, `px-2.5 py-1`, `rounded-sm`, 9px on 0.18em tracking. The
    // class is `font-bold`, set here in the heaviest weight the export ships;
    // at nine pixels of uppercase the two are indistinguishable.
    const badgeHeight = 21;
    const baseline = (badgeHeight - 9 * (ASCENT + DESCENT)) / 2 + 9 * ASCENT;
    parts.push(
      `<rect x="12" y="12" width="${round(badgeWidth)}" height="${badgeHeight}" rx="2" fill="${FOREGROUND}"/>`,
      `<text x="22" y="${round(12 + baseline)}" font-family="Inter Tight" font-weight="600"` +
        ` font-size="9" letter-spacing="${round(9 * 0.18)}" fill="${BACKGROUND}">` +
        `${escapeXml(spec.badge.toUpperCase())}</text>`,
    );
  }

  let top = PHOTO_H + PAD_TOP;
  for (const line of lines) {
    top += line.marginTop;
    if (line.text) {
      // `items-baseline gap-1.5`: the colour count sits on the price's baseline.
      const tail = line.tail
        ? `<tspan dx="6" font-size="12" font-weight="400" fill="${FOREGROUND_SUBTLE}">·</tspan>` +
          `<tspan dx="6" font-size="12" font-weight="400" fill="${FOREGROUND_SUBTLE}">${escapeXml(line.tail)}</tspan>`
        : "";
      parts.push(
        `<text x="${PAD_X}" y="${round(top + baselineIn(line))}" font-family="Inter Tight"` +
          ` font-weight="${line.weight}" font-size="${line.size}" fill="${line.color}">` +
          `${escapeXml(line.text)}${tail}</text>`,
      );
    }
    top += line.size * line.leading;
  }

  parts.push(
    `<rect x="0.5" y="0.5" width="${CARD_W - 1}" height="${height - 1}" rx="${radiusOf(spec) - 0.5}"` +
      ` fill="none" stroke="${BORDER}" stroke-width="1"/>`,
  );

  return svgDocument(height, parts.join(""));
}

/** The rounded outline, painted white — composited to cut the card's corners. */
function maskSvg(radius: number, height: number): string {
  return svgDocument(height, `<rect width="${CARD_W}" height="${height}" rx="${radius}" fill="#fff"/>`);
}

/**
 * A card-sized SVG whose coordinates are the card's CSS pixels: the viewBox does
 * the scaling, so every number above stays the number in the component.
 */
function svgDocument(height: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W * SCALE}" height="${height * SCALE}"` +
    ` viewBox="0 0 ${CARD_W} ${height}">${body}</svg>`
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The photo, filling the card's photo box the way the card fills it: contained
 * on its backdrop for a piece, covering for a look or for a photo the admin has
 * cropped, centred on that crop's focal point.
 */
async function photoLayer(
  sharp: typeof import("sharp"),
  photo: Buffer,
  spec: CardSpec,
): Promise<{ data: Buffer; width: number; height: number }> {
  const width = CARD_W * SCALE;
  const height = PHOTO_H * SCALE;
  const backdrop = boxColor(spec);
  const image = sharp(photo, { failOn: "none" }).flatten({ background: backdrop });

  if (fitOf(spec) === "contain") {
    const data = await image
      .resize(width, height, { fit: "contain", background: backdrop })
      .removeAlpha()
      .raw()
      .toBuffer();
    return { data, width, height };
  }

  // `object-cover` with an `object-position`: scale until both sides are
  // covered, then take the window the focal point sits in the middle of.
  const meta = await sharp(photo, { failOn: "none" }).metadata();
  const source = { w: meta.width ?? width, h: meta.height ?? height };
  const scale = Math.max(width / source.w, height / source.h);
  const scaled = {
    w: Math.max(width, Math.round(source.w * scale)),
    h: Math.max(height, Math.round(source.h * scale)),
  };
  const focal = spec.focal ?? { x: 0.5, y: 0.5 };
  const data = await image
    .resize(scaled.w, scaled.h, { fit: "fill" })
    .extract({
      left: clamp(Math.round((scaled.w - width) * focal.x), 0, scaled.w - width),
      top: clamp(Math.round((scaled.h - height) * focal.y), 0, scaled.h - height),
      width,
      height,
    })
    .removeAlpha()
    .raw()
    .toBuffer();
  return { data, width, height };
}

/**
 * Draw one card and return it as a JPEG.
 *
 * JPEG rather than PNG because an export is hundreds of these at once and a
 * photographic PNG is several times the size for no visible gain; the quality
 * and the full chroma are what keep the small type crisp. The rounded corners
 * are cut and then filled with the page's own background, which is what a card
 * looks like on the site.
 */
export async function renderCard(photo: Buffer, spec: CardSpec): Promise<Buffer> {
  ensureFonts();
  const sharp = await loadSharp();

  const lines = await layOutLines(spec);
  const height = cardHeight(lines);
  const badge = spec.badge?.toUpperCase() ?? "";
  // The tracking is added after every character, including the last, the way CSS
  // letter-spacing does; the 20 is the badge's own `px-2.5`.
  const badgeWidth = badge ? (await inkWidth(badge, 9, 600)) + 9 * 0.18 * badge.length + 20 : 0;
  const layer = await photoLayer(sharp, photo, spec);

  return sharp({
    create: { width: CARD_W * SCALE, height: height * SCALE, channels: 4, background: SURFACE },
  })
    .composite([
      { input: layer.data, raw: { width: layer.width, height: layer.height, channels: 3 }, top: 0, left: 0 },
      { input: Buffer.from(overlaySvg(spec, lines, height, badgeWidth)), top: 0, left: 0 },
      { input: Buffer.from(maskSvg(radiusOf(spec), height)), blend: "dest-in", top: 0, left: 0 },
    ])
    .flatten({ background: BACKGROUND })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
}

/** The extension the bytes from `renderCard` should be saved under. */
export const CARD_EXTENSION = "jpg";
