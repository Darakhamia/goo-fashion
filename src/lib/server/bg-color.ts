/**
 * Reads the colour a product photo was shot on, so the card can pad with that
 * instead of with its own background.
 *
 * The card renders photos `object-contain` inside a fixed 3:4 box. A photo of a
 * different aspect ratio therefore gets padding on two sides, and that padding
 * is the card's colour — so a jacket shot on a warm studio grey sits inside a
 * white frame with a seam down both edges. Every retailer shoots on its own
 * backdrop, so the seam moves around the catalog and cannot be fixed with one
 * constant.
 *
 * Why this is measured here and not in the browser: partner-CDN photos render
 * `unoptimized` and cross-origin, which taints a canvas that draws them — the
 * pixels cannot be read back. So the colour is measured server-side once per
 * product and stored on the row.
 *
 * The one design decision worth stating: this samples the FOUR CORNERS and only
 * answers when all four agree. It deliberately does not compute a dominant
 * colour. A dominant colour always returns something, including for photos that
 * have no backdrop at all — a lifestyle shot on a pavement, a full-bleed crop —
 * and tinting those pads the card with a colour that appears nowhere near the
 * edge, which looks worse than the seam it replaces. Four agreeing corners is
 * evidence that a backdrop exists; anything else returns null and keeps the
 * current behaviour.
 */
import { fetchImageBuffer, isAlreadyMirrored } from "@/lib/server/storage/product-images";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface CornerSample {
  /** Mean colour of the patch. */
  mean: Rgb;
  /** Largest per-channel standard deviation within the patch. */
  spread: number;
  /** Mean alpha 0–255; 255 for an image with no alpha channel. */
  alpha: number;
}

export interface BgColorResult {
  /** `#rrggbb`, or null unless `outcome` is "measured". */
  color: string | null;
  /**
   * What happened, as a value rather than as prose to be pattern-matched.
   *
   * The distinction that matters is the second one against the third. "declined"
   * is a judgement on a photo we looked at, and is worth storing so it is never
   * re-downloaded. "unavailable" means the photo was never seen — a 429, a dead
   * URL, a missing decoder — and storing that as a judgement would be a lie that
   * also stops the row from ever being retried.
   */
  outcome: "measured" | "declined" | "unavailable";
  /** Why — carried into the dry-run report so the numbers can be argued with. */
  reason: string;
}

/**
 * A corner patch whose own pixels vary more than this is not a backdrop: it has
 * the garment, a shadow or a watermark in it. Set against JPEG noise on a flat
 * studio wall, which measures 1–4 on an 8-bit channel.
 */
export const FLATNESS_MAX = 8;

/**
 * How far the four corner means may spread before we call it "not one colour".
 * A real backdrop is lit unevenly — a softbox on one side puts a few points
 * between the top and bottom of the frame — so this cannot be zero. Twelve
 * points is roughly the largest difference still invisible once the padding
 * strip sits next to the photo.
 */
export const AGREEMENT_MAX = 12;

/** Below this mean alpha the corner is a cutout, not a backdrop. */
export const MIN_ALPHA = 250;

/**
 * What `products.bg_color` holds for a photo that was measured and has no
 * single backdrop.
 *
 * It is a stored verdict, not a colour, and it exists so re-runs are cheap: with
 * null meaning both "not measured" and "measured, declined", every pass would
 * re-download every photo it had already judged. `photoBackdrop` rejects it
 * along with anything else that isn't a hex, so it can never reach a style
 * attribute.
 */
export const DECLINED = "none";

/** Patch side as a fraction of the shorter image side, and its bounds in px. */
export const PATCH_FRACTION = 0.02;
export const PATCH_MIN = 4;
export const PATCH_MAX = 24;

/**
 * Longest side the image is decoded at. Sampling does not need full resolution
 * — a 4000px photo raw-decodes to 48 MB of RGBA, and the corner statistics are
 * the same either way. Downscaling also errs in the safe direction: it pulls
 * neighbouring pixels into the edge, so a corner with the garment near it reads
 * as *less* flat and is more likely to be rejected.
 */
export const DECODE_MAX_SIDE = 800;

export function patchSize(width: number, height: number): number {
  const side = Math.round(Math.min(width, height) * PATCH_FRACTION);
  return Math.max(PATCH_MIN, Math.min(PATCH_MAX, side));
}

export function toHex({ r, g, b }: Rgb): string {
  const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

/**
 * Mean colour, mean alpha and per-channel spread of one rectangular patch of a
 * raw interleaved pixel buffer.
 *
 * Kept separate from the decoder so the thresholds above can be exercised
 * against hand-built pixels rather than against whatever a real JPEG happens to
 * contain.
 */
export function patchStats(
  data: Uint8Array,
  imageWidth: number,
  channels: number,
  left: number,
  top: number,
  size: number,
): CornerSample {
  let count = 0;
  const sum = [0, 0, 0];
  const sumSquares = [0, 0, 0];
  let alphaSum = 0;

  for (let y = top; y < top + size; y++) {
    for (let x = left; x < left + size; x++) {
      const at = (y * imageWidth + x) * channels;
      for (let c = 0; c < 3; c++) {
        const v = data[at + c] ?? 0;
        sum[c] += v;
        sumSquares[c] += v * v;
      }
      alphaSum += channels > 3 ? (data[at + 3] ?? 255) : 255;
      count++;
    }
  }

  if (!count) return { mean: { r: 0, g: 0, b: 0 }, spread: Infinity, alpha: 0 };

  const means = sum.map((s) => s / count);
  // Population variance, clamped at zero: the sum-of-squares form can land a
  // hair below it on a perfectly uniform patch through floating-point error,
  // and a NaN spread would sail past every threshold below.
  const spread = Math.max(
    ...sumSquares.map((sq, c) => Math.sqrt(Math.max(0, sq / count - means[c] * means[c]))),
  );

  return {
    mean: { r: means[0], g: means[1], b: means[2] },
    spread,
    alpha: alphaSum / count,
  };
}

/** The four corner patches of a raw interleaved buffer, clockwise from top-left. */
export function sampleCornersFromRaw(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  size = patchSize(width, height),
): CornerSample[] {
  const s = Math.max(1, Math.min(size, Math.floor(width / 2), Math.floor(height / 2)));
  return [
    [0, 0],
    [width - s, 0],
    [width - s, height - s],
    [0, height - s],
  ].map(([left, top]) => patchStats(data, width, channels, left, top, s));
}

/**
 * The colour the four corners agree on, or null and the reason they don't.
 *
 * Both rejections matter and mean different things. A busy corner says the
 * photo has content at the edge; disagreeing corners say it has a gradient or
 * two different surfaces. Either way there is no colour that is *the*
 * background, so we decline rather than pick one.
 */
export function agreedBackground(
  corners: CornerSample[],
  opts: { flatnessMax?: number; agreementMax?: number } = {},
): BgColorResult {
  const flatnessMax = opts.flatnessMax ?? FLATNESS_MAX;
  const agreementMax = opts.agreementMax ?? AGREEMENT_MAX;

  if (corners.length !== 4) {
    return { color: null, outcome: "declined", reason: "could not read four corners" };
  }

  const cutout = corners.find((c) => c.alpha < MIN_ALPHA);
  if (cutout) {
    return { color: null, outcome: "declined", reason: `transparent corner (alpha ${Math.round(cutout.alpha)})` };
  }

  const busy = corners.reduce((worst, c) => (c.spread > worst.spread ? c : worst));
  if (busy.spread > flatnessMax) {
    return { color: null, outcome: "declined", reason: `corner not flat (spread ${busy.spread.toFixed(1)})` };
  }

  const channelSpread = (["r", "g", "b"] as const).map((k) => {
    const values = corners.map((c) => c.mean[k]);
    return Math.max(...values) - Math.min(...values);
  });
  const worstChannel = Math.max(...channelSpread);
  if (worstChannel > agreementMax) {
    return { color: null, outcome: "declined", reason: `corners disagree (${worstChannel.toFixed(1)} apart)` };
  }

  const mean = (k: keyof Rgb) => corners.reduce((sum, c) => sum + c.mean[k], 0) / corners.length;
  return {
    color: toHex({ r: mean("r"), g: mean("g"), b: mean("b") }),
    outcome: "measured",
    reason: "corners agree",
  };
}

/**
 * Which of a product's photos to measure.
 *
 * Prefers a copy in our own storage. That is not only politeness towards
 * retailer CDNs — it is the copy that will still resolve in a month, and the one
 * that answers our server's fetch at all rather than with a 429. Falls back to
 * the primary photo, then to any photo, then to nothing.
 */
export function urlToSample(row: { image_url?: string | null; images?: string[] | null }): string {
  const candidates = [row.image_url, ...(row.images ?? [])].filter((u): u is string => !!u);
  return candidates.find((u) => isAlreadyMirrored(u)) ?? candidates[0] ?? "";
}

/**
 * Measure one product's photo and store the answer, for the import path.
 *
 * Best-effort by design: a product that imported correctly must not fail
 * because a CDN was slow, so every error is swallowed and the row is simply
 * left unmeasured for the batch job to pick up.
 */
export async function storeBackgroundColor(productId: string, url: string): Promise<string | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabase");
    if (!isSupabaseConfigured || !supabase) return null;

    const { color, outcome } = await sampleBackgroundColor(url);
    // A photo we never saw is not a verdict — leave the row null so the batch
    // job retries it, rather than recording 'none' for a 429.
    if (outcome === "unavailable") return null;

    const value = color ?? DECLINED;
    const { error } = await supabase.from("products").update({ bg_color: value }).eq("id", productId);
    return error ? null : value;
  } catch {
    return null;
  }
}

/**
 * Download one photo and measure it.
 *
 * `sharp` is loaded on demand: it is a native module, and a platform where the
 * binary failed to install should degrade to "this admin job reports it cannot
 * run" rather than to a route that throws on import.
 */
export async function sampleBackgroundColor(url: string): Promise<BgColorResult> {
  if (!url) return { color: null, outcome: "unavailable", reason: "no image" };

  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return { color: null, outcome: "unavailable", reason: "sharp is not available on this server" };
  }

  let bytes: Buffer;
  try {
    ({ buffer: bytes } = await fetchImageBuffer(url, 20_000));
  } catch (e) {
    return {
      color: null,
      outcome: "unavailable",
      reason: `download failed (${e instanceof Error ? e.message : "unknown"})`,
    };
  }

  try {
    // `failOn: "none"` because a truncated-but-decodable photo still has usable
    // corners, and a catalog of ten thousand imports has a few of those.
    const { data, info } = await sharp(bytes, { failOn: "none" })
      .resize({
        width: DECODE_MAX_SIDE,
        height: DECODE_MAX_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) {
      return { color: null, outcome: "unavailable", reason: "unreadable image" };
    }
    const corners = sampleCornersFromRaw(data, info.width, info.height, info.channels);
    return agreedBackground(corners);
  } catch (e) {
    return {
      color: null,
      outcome: "unavailable",
      reason: `decode failed (${e instanceof Error ? e.message : "unknown"})`,
    };
  }
}
