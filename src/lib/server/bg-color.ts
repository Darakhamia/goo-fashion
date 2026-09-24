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
import type { BaseColor } from "@/lib/server/product-fields";

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
  /**
   * Which copy was actually downloaded. Reported so a slow run can be explained
   * rather than guessed at: all-"original" means Storage is not serving
   * renditions and every photo arrived at full size.
   */
  via?: "thumbnail" | "original";
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
 * A unit of work tagged with the host it will talk to, and whether that host is
 * ours. `pooledByHost` needs nothing else about it.
 */
export interface HostJob {
  host: string;
  own: boolean;
}

/**
 * How many photos are in flight, per host.
 *
 * A single global number was the wrong shape. It has to be small enough for the
 * worst host in the batch — a retailer CDN that answers our server with 429 —
 * which then throttles the overwhelming majority of photos, the ones sitting in
 * our own Storage where parallel requests cost nothing. So the limit is per
 * host: our bucket gets a real lane count, every external host stays at two.
 *
 * Eight rather than more for our own host because with renditions enabled each
 * request makes the image transformer resize an 800 KB photo, which is CPU on
 * the same box that serves the site. Eight concurrent resizes is nothing; fifty
 * during a backfill would be felt by shoppers.
 */
export const OWN_HOST_LANES = 8;
export const OTHER_HOST_LANES = 2;
/** Ceiling across all hosts, so a batch spanning many CDNs stays sane. */
export const MAX_LANES = 16;

/**
 * Run `worker` over the jobs, never more than that host's lane count at a time.
 *
 * Every host gets one lane before any host gets a second, so a batch containing
 * one Farfetch straggler can never leave it starved behind three hundred of
 * ours. With more distinct hosts than MAX_LANES the ceiling gives way rather
 * than the guarantee — one lane each is still polite, and dropping a host
 * entirely would silently skip work.
 */
export async function pooledByHost<T extends HostJob>(
  jobs: T[],
  worker: (job: T) => Promise<void>,
): Promise<void> {
  const queues = new Map<string, T[]>();
  for (const job of jobs) {
    const queue = queues.get(job.host);
    if (queue) queue.push(job);
    else queues.set(job.host, [job]);
  }

  // Our own host first, so it gets the spare lanes when the budget is tight.
  const hosts = [...queues.values()].sort((a, b) => Number(b[0].own) - Number(a[0].own));
  let spare = Math.max(0, MAX_LANES - hosts.length);
  const lanes: Promise<void>[] = [];

  for (const queue of hosts) {
    const wanted = (queue[0].own ? OWN_HOST_LANES : OTHER_HOST_LANES) - 1;
    const extra = Math.max(0, Math.min(wanted, spare, queue.length - 1));
    spare -= extra;
    for (let i = 0; i <= extra; i++) {
      lanes.push((async () => {
        // `shift` off a queue shared between this host's lanes: safe because
        // nothing awaits between the read and the removal.
        for (let job = queue.shift(); job; job = queue.shift()) await worker(job);
      })());
    }
  }
  await Promise.all(lanes);
}

/**
 * Which of a product's photos to measure.
 *
 * Prefers a copy in our own storage. That is not only politeness towards
 * retailer CDNs — it is the copy that will still resolve in a month, and the one
 * that answers our server's fetch at all rather than with a 429. Falls back to
 * the primary photo, then to any photo, then to nothing.
 */
/**
 * Width of the rendition sampling asks Storage for.
 *
 * A catalogue photo is around 2000×3000 and 800 KB; the same photo at 600px is
 * 25 KB — thirty times fewer bytes for pixels that answer the same question,
 * since the corner statistics do not change and the decoder downscales to
 * DECODE_MAX_SIDE anyway. On a backfill of a few thousand products that is the
 * difference between hundreds of megabytes and a few.
 */
export const SAMPLE_WIDTH = 600;

/**
 * A small rendition of one of our own Storage objects, or null when the URL is
 * not one — a partner CDN, or a Storage path in a shape we don't recognise.
 *
 * Deliberately passes width only. A single dimension cannot letterbox, so the
 * corners of the rendition are the corners of the photo; adding a height could
 * introduce padding of the transformer's choosing and we would measure that
 * instead of the backdrop.
 */
export function thumbnailUrl(url: string): string | null {
  if (!url || !isAlreadyMirrored(url)) return null;
  const OBJECT = "/storage/v1/object/public/";
  const RENDER = "/storage/v1/render/image/public/";
  try {
    const u = new URL(url);
    const at = u.pathname.indexOf(OBJECT);
    if (at === -1) return null;
    u.pathname = u.pathname.slice(0, at) + RENDER + u.pathname.slice(at + OBJECT.length);
    u.searchParams.set("width", String(SAMPLE_WIDTH));
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Whether this process has seen Storage's image-transform endpoint work.
 * `null` = not tried yet, `false` = it answered a hard no, so stop asking.
 */
let transformsWork: boolean | null = null;

/** Reset between tests; also lets a deploy re-probe without a restart. */
export function forgetTransformSupport(): void {
  transformsWork = null;
}

/** A status that means "this endpoint will never serve me", not "try later". */
function isPermanentFailure(e: unknown): boolean {
  const message = e instanceof Error ? e.message : "";
  return /HTTP 4\d\d/.test(message) || /Not an image/.test(message);
}

/**
 * The bytes to measure: the small rendition when Storage will make one, the
 * original otherwise.
 *
 * The fallback is per-process rather than per-photo on purpose. An instance with
 * image transforms turned off would otherwise pay a doomed request for every
 * product in the catalogue; one hard failure is enough to learn from. A timeout
 * is not treated as an answer, because it isn't one.
 */
async function fetchForSampling(url: string): Promise<{ buffer: Buffer; via: "thumbnail" | "original" }> {
  const thumb = transformsWork === false ? null : thumbnailUrl(url);
  if (thumb) {
    try {
      const { buffer } = await fetchImageBuffer(thumb, 20_000);
      transformsWork = true;
      return { buffer, via: "thumbnail" };
    } catch (e) {
      if (isPermanentFailure(e)) transformsWork = false;
    }
  }
  const { buffer } = await fetchImageBuffer(url, 20_000);
  return { buffer, via: "original" };
}

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
 * Download one photo and measure its backdrop.
 */
export async function sampleBackgroundColor(url: string): Promise<BgColorResult> {
  const decoded = await decodeForSampling(url, DECODE_MAX_SIDE);
  if ("reason" in decoded) return { color: null, outcome: "unavailable", reason: decoded.reason };
  const { data, width, height, channels, via } = decoded;
  const corners = sampleCornersFromRaw(data, width, height, channels);
  return { ...agreedBackground(corners), via };
}

interface DecodedImage {
  data: Uint8Array;
  width: number;
  height: number;
  channels: number;
  via: "thumbnail" | "original";
}

/**
 * Download one photo and decode it to raw RGBA no larger than `maxSide`, or
 * say why that could not be done.
 *
 * `sharp` is loaded on demand: it is a native module, and a platform where the
 * binary failed to install should degrade to "this admin job reports it cannot
 * run" rather than to a route that throws on import.
 */
async function decodeForSampling(url: string, maxSide: number): Promise<DecodedImage | { reason: string }> {
  if (!url) return { reason: "no image" };

  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return { reason: "sharp is not available on this server" };
  }

  let bytes: Buffer;
  let via: "thumbnail" | "original";
  try {
    ({ buffer: bytes, via } = await fetchForSampling(url));
  } catch (e) {
    return { reason: `download failed (${e instanceof Error ? e.message : "unknown"})` };
  }

  try {
    // `failOn: "none"` because a truncated-but-decodable photo still has usable
    // corners, and a catalog of ten thousand imports has a few of those.
    const { data, info } = await sharp(bytes, { failOn: "none" })
      .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (!info.width || !info.height) return { reason: "unreadable image" };
    return { data, width: info.width, height: info.height, channels: info.channels, via };
  } catch (e) {
    return { reason: `decode failed (${e instanceof Error ? e.message : "unknown"})` };
  }
}

// ── The piece's own colour ────────────────────────────────────────────────────
// For the colour filter, when the page names no colour the filter can use: a
// store that calls its colourway "Babymetal Storm", or whose only colour text
// was its swatch's file name. The photo is then the one witness left.
//
// Same caution as the backdrop above, for the same reason. This only answers
// for a studio shot — four corners agreeing on a backdrop, or a cut-out — where
// "not the backdrop" is the piece. A lifestyle photo has a street, a model and
// a second garment in it, and the most common colour there is anybody's guess,
// so it gets no answer at all rather than a confident wrong one.

/** Longest side decoded for the piece's colour. Colour share needs no detail. */
export const GARMENT_DECODE_SIDE = 160;

/**
 * How far (RGB distance) a pixel must sit from the backdrop to count as the
 * piece. Below this is the backdrop's own grain and the soft shadow under it.
 */
export const GARMENT_MIN_DISTANCE = 48;

/** Least share of the frame the piece must fill; less is a speck, not a garment. */
export const GARMENT_MIN_SHARE = 0.03;

/** A second colour covering at least this much of the piece makes it two-coloured. */
export const SECOND_COLOUR_SHARE = 0.25;

/**
 * The catalogue's base colour for one pixel.
 *
 * Deliberately coarse: it answers which filter a shopper would look under, not
 * what the colourway is called. Hue decides, with lightness and chroma splitting
 * the hues whose names change with them — dark orange is brown, pale muted
 * orange is beige, dark yellow is olive and so green, light red is pink.
 */
export function baseColourOfPixel(r: number, g: number, b: number): BaseColor {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const l = (max + min) / 2 / 255;

  if (chroma < 24) return l < 0.22 ? "black" : l > 0.86 ? "white" : "grey";
  if (l < 0.12) return "black";

  let h: number;
  if (max === r) h = ((g - b) / chroma) % 6;
  else if (max === g) h = (b - r) / chroma + 2;
  else h = (r - g) / chroma + 4;
  h = (h * 60 + 360) % 360;

  if (h < 15 || h >= 345) return l > 0.7 ? "pink" : "red";
  if (h < 45) {
    if (chroma < 70 && l > 0.55) return "beige";
    return l < 0.42 ? "brown" : "orange";
  }
  if (h < 70) {
    if (chroma < 70 && l > 0.55) return "beige";
    return l < 0.4 ? "green" : "yellow";
  }
  if (h < 170) return "green";
  if (h < 255) return "blue";
  if (h < 290) return "violet";
  return l > 0.6 ? "pink" : "violet";
}

export interface GarmentColours {
  /** Base colours, most of the piece first; two when a second covers a quarter. */
  colours: BaseColor[];
  outcome: "measured" | "declined" | "unavailable";
  reason: string;
}

/**
 * The piece's base colours from a raw interleaved buffer, or a decline.
 * Kept apart from the decoder so it can be fed hand-built pixels.
 */
export function garmentColoursFromRaw(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
): GarmentColours {
  const corners = sampleCornersFromRaw(data, width, height, channels);
  // A cut-out: the backdrop is transparency, and the piece is what is opaque.
  const cutout = corners.every((c) => c.alpha < 128);
  let backdrop: Rgb | null = null;
  if (!cutout) {
    const agreed = agreedBackground(corners);
    if (agreed.outcome !== "measured" || !agreed.color) {
      return { colours: [], outcome: "declined", reason: `not a studio shot (${agreed.reason})` };
    }
    const hex = agreed.color;
    backdrop = {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  const tally = new Map<BaseColor, number>();
  let piece = 0;
  for (let i = 0; i < width * height; i++) {
    const at = i * channels;
    const r = data[at] ?? 0;
    const g = data[at + 1] ?? 0;
    const b = data[at + 2] ?? 0;
    const alpha = channels > 3 ? (data[at + 3] ?? 255) : 255;
    if (alpha < 200) continue;
    if (backdrop) {
      const distance = Math.hypot(r - backdrop.r, g - backdrop.g, b - backdrop.b);
      if (distance < GARMENT_MIN_DISTANCE) continue;
    }
    const base = baseColourOfPixel(r, g, b);
    tally.set(base, (tally.get(base) ?? 0) + 1);
    piece++;
  }

  const frame = width * height;
  if (!frame || piece / frame < GARMENT_MIN_SHARE) {
    // A white shirt on a white sweep lands here too — a piece the camera cannot
    // separate from its backdrop is a piece this cannot colour.
    return { colours: [], outcome: "declined", reason: "the piece does not stand out from the backdrop" };
  }

  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const colours: BaseColor[] = [ranked[0][0]];
  if (ranked[1] && ranked[1][1] / piece >= SECOND_COLOUR_SHARE) colours.push(ranked[1][0]);
  const shares = ranked
    .slice(0, 3)
    .map(([c, n]) => `${c} ${Math.round((n / piece) * 100)}%`)
    .join(", ");
  return { colours, outcome: "measured", reason: shares };
}

/** Download one photo and read the piece's colours off it. Never throws. */
export async function sampleGarmentColours(url: string): Promise<GarmentColours> {
  const decoded = await decodeForSampling(url, GARMENT_DECODE_SIDE);
  if ("reason" in decoded) return { colours: [], outcome: "unavailable", reason: decoded.reason };
  try {
    return garmentColoursFromRaw(decoded.data, decoded.width, decoded.height, decoded.channels);
  } catch (e) {
    return { colours: [], outcome: "unavailable", reason: e instanceof Error ? e.message : "unknown" };
  }
}
