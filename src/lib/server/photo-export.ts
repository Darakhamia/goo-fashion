/**
 * The parts of the admin photo export that are not about ZIP structure:
 * turning a catalogue row into a file name, and getting the bytes politely.
 *
 * The export exists because the photos on the cards are scattered across our own
 * Storage bucket and a dozen retailer CDNs, and there is no way to get "the
 * pictures for these fifty pieces" out of the admin short of right-clicking
 * fifty cards. Everything here serves that: download what the card shows, name
 * it after the piece rather than after the CDN's hash, and be a good citizen
 * towards the hosts serving it.
 */
import { fetchImageBuffer } from "@/lib/server/storage/product-images";
import type { CropData } from "@/lib/types";

/**
 * Lanes per host, borrowed from the backdrop sampler for the same reason: one
 * rate-limited retailer CDN in the batch must not throttle the hundreds of
 * photos sitting in our own bucket, and hitting a retailer eight-wide is how a
 * catalogue export earns a 429 for everything else we do.
 */
export const OWN_HOST_LANES = 8;
export const OTHER_HOST_LANES = 2;

/** Longest a single name segment may get before the extension is put back. */
const MAX_SEGMENT = 80;

/**
 * Characters no common filesystem will take, plus the ones that would turn a
 * name into a path. Control characters go too — a product name pasted from a
 * retailer page has had stranger things in it.
 */
const UNSAFE = /[/\\:*?"<>|]|[\u0000-\u001f\u007f]/g;

/**
 * One path segment of an archive entry, safe to write on Windows and macOS.
 *
 * Unicode survives — the archive marks its names UTF-8 — so a Cyrillic piece
 * name arrives as itself rather than as a row of underscores. Only what a
 * filesystem genuinely refuses is replaced.
 *
 * Three of the rules are about what a name must not become rather than what it
 * must not contain. Dropping the separators is what makes a piece called
 * "../../etc/passwd" one file rather than a path. Runs of dots go with them:
 * a name left reading `.. .. etc passwd` unpacks safely but makes extractors
 * that scan for traversal shout, and a leading dot would hide the file
 * outright. Trailing dots and spaces are trimmed because Windows silently drops
 * them, and two names differing only there would collide on unpacking.
 */
export function safeSegment(raw: string, fallback = "untitled"): string {
  const cleaned = raw
    .replace(UNSAFE, " ")
    .replace(/\.{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEGMENT)
    .replace(/^[. ]+/, "")
    .replace(/[. ]+$/, "");
  return cleaned || fallback;
}

/** Short, stable, human-typable tail that keeps two same-named pieces apart. */
export function shortId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "0";
}

/** The extension to save under: what the server served, or what the URL claims. */
export function extensionFor(contentType: string, url: string): string {
  const type = contentType.toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("avif")) return "avif";
  if (type.includes("gif")) return "gif";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  const fromUrl = /\.(jpe?g|png|webp|avif|gif)(?:$|[?#])/i.exec(url)?.[1]?.toLowerCase();
  if (fromUrl) return fromUrl === "jpeg" ? "jpg" : fromUrl;
  return "jpg";
}

/** True once the URL points at our own Supabase Storage, which we may hit harder. */
function isOwnHost(host: string): boolean {
  const configured = process.env.SUPABASE_URL ?? "";
  if (!configured) return false;
  try {
    return new URL(configured).host === host;
  } catch {
    return false;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

/**
 * A counting semaphore per host.
 *
 * A finished job hands its slot straight to the next waiter for that host
 * rather than releasing and re-acquiring, so the count can never drift above the
 * limit between the two.
 */
export function createHostGate() {
  const active = new Map<string, number>();
  const waiting = new Map<string, (() => void)[]>();

  return async function withHostSlot<R>(host: string, run: () => Promise<R>): Promise<R> {
    const limit = isOwnHost(host) ? OWN_HOST_LANES : OTHER_HOST_LANES;
    const running = active.get(host) ?? 0;
    if (running >= limit) {
      await new Promise<void>((resolve) => {
        const queue = waiting.get(host) ?? [];
        queue.push(resolve);
        waiting.set(host, queue);
      });
    } else {
      active.set(host, running + 1);
    }
    try {
      return await run();
    } finally {
      const next = waiting.get(host)?.shift();
      if (next) next();
      else active.set(host, (active.get(host) ?? 1) - 1);
    }
  };
}

/**
 * Run `work` over the items with at most `limit` in flight, yielding results in
 * the order the items were given.
 *
 * Order matters because the results go straight into a ZIP, where entry order is
 * the order they are written — an archive whose files come out in whatever order
 * the CDNs answered would be a worse artefact than one that is alphabetical.
 * Holding results back to restore that order is what bounds memory here: at most
 * `limit` photos exist at once, however many thousand are queued.
 *
 * `work` must not reject. A rejection would surface only when its result is
 * awaited, by which time the other in-flight promises are unhandled — so a
 * failure has to come back as a value the caller can put in its report.
 */
export async function* mapOrdered<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): AsyncGenerator<R> {
  const inFlight: Promise<R>[] = [];
  let next = 0;
  const startOne = () => {
    if (next < items.length) inFlight.push(work(items[next++]));
  };

  for (let i = 0; i < limit; i++) startOne();
  while (inFlight.length) {
    const result = await inFlight.shift()!;
    startOne();
    yield result;
  }
}

/**
 * Cut the photo down to the region the card shows.
 *
 * A piece with a crop is displayed zoomed into that fraction of the photo
 * (ProductCard scales the image and offsets it); exporting the untouched
 * original would hand back a picture nobody has seen on the site. The crop is
 * best-effort — a format sharp cannot re-encode gives back the original bytes,
 * which is still the right photo, just uncropped.
 */
export async function applyCrop(bytes: Buffer, crop: CropData): Promise<Buffer> {
  let sharp: typeof import("sharp");
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return bytes; // native module missing on this platform — ship the original
  }

  try {
    const image = sharp(bytes, { failOn: "none" });
    const { width, height } = await image.metadata();
    if (!width || !height) return bytes;

    // Clamp into the image: a crop stored against a photo that has since been
    // replaced by a differently-sized one would otherwise throw.
    const left = Math.min(Math.max(0, Math.round(crop.x * width)), width - 1);
    const top = Math.min(Math.max(0, Math.round(crop.y * height)), height - 1);
    const cropWidth = Math.min(Math.max(1, Math.round(crop.width * width)), width - left);
    const cropHeight = Math.min(Math.max(1, Math.round(crop.height * height)), height - top);
    if (cropWidth === width && cropHeight === height) return bytes;

    return await image.extract({ left, top, width: cropWidth, height: cropHeight }).toBuffer();
  } catch {
    return bytes;
  }
}

export interface PhotoJob {
  /** Path inside the archive, minus the extension. */
  path: string;
  url: string;
  /** Applied after download when set, so the file matches the card. */
  crop?: CropData;
  /** Shown in the report when this one fails. */
  label: string;
}

export type PhotoResult =
  | { ok: true; job: PhotoJob; name: string; data: Buffer }
  | { ok: false; job: PhotoJob; reason: string };

/** Download one photo, crop it if the card is cropped, and name the file. */
export async function fetchPhoto(job: PhotoJob, timeoutMs = 25_000): Promise<PhotoResult> {
  try {
    const { buffer, contentType } = await fetchImageBuffer(job.url, timeoutMs);
    const data = job.crop ? await applyCrop(buffer, job.crop) : buffer;
    return { ok: true, job, name: `${job.path}.${extensionFor(contentType, job.url)}`, data };
  } catch (e) {
    return { ok: false, job, reason: e instanceof Error ? e.message : "unknown error" };
  }
}

// ── Packing ──────────────────────────────────────────────────────────────────

/** When to stop starting new downloads, leaving room to finish the archive. */
export const TIME_BUDGET_MS = 240_000;
/** Photos in flight at once, across all hosts. The per-host lanes are stricter. */
export const WINDOW = 8;
/** Ceilings that keep the archive inside plain ZIP's 32-bit fields. */
export const MAX_ENTRIES = 5_000;
export const MAX_TOTAL_BYTES = 1_500 * 1024 * 1024;

/** What the archive's own `_export.txt` is written from. */
export interface ExportReport {
  kind: "products" | "outfits";
  /** Cards in the selection, including those that had no photo to fetch. */
  asked: number;
  packed: number;
  bytes: number;
  /** One line per card that could not be delivered, in the order they were tried. */
  failures: string[];
  /** Why the archive stopped short, or null if it did not. */
  truncated: string | null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function reportText(report: ExportReport, now = new Date()): string {
  const lines = [
    `Goo Fashion — ${report.kind === "products" ? "product" : "outfit"} card photos`,
    `Exported ${now.toISOString()}`,
    "",
    `Cards asked for : ${report.asked}`,
    `Photos packed   : ${report.packed}`,
    `Archive size    : ${formatBytes(report.bytes)}`,
  ];
  if (report.truncated) {
    lines.push("", `STOPPED EARLY: ${report.truncated}`, "Re-run on a smaller selection to get the rest.");
  }
  if (report.failures.length) {
    lines.push("", `Could not be downloaded (${report.failures.length}):`, ...report.failures);
  } else if (!report.truncated) {
    lines.push("", "Every card in the selection was exported.");
  }
  return lines.join("\n") + "\n";
}

/**
 * Fetch the photos and hand them to the ZIP writer one entry at a time.
 *
 * This is the only place the budgets are enforced, and it always reaches its
 * final yield: whatever stopped it — time, size, a CDN refusing every request —
 * the report goes into the archive, because by then the response has long since
 * been answered 200 and there is no status code left to say it with.
 *
 * `report` is mutated as the archive grows so the caller can read the totals
 * after the stream drains.
 */
export async function* packPhotos(
  jobs: PhotoJob[],
  report: ExportReport,
  fetchOne: (job: PhotoJob) => Promise<PhotoResult> = fetchPhoto,
): AsyncGenerator<{ name: string; data: Buffer }> {
  const withHostSlot = createHostGate();
  const startedAt = Date.now();
  const taken = new Set<string>();
  const download = (job: PhotoJob) => withHostSlot(hostOf(job.url), () => fetchOne(job));

  for await (const result of mapOrdered(jobs, WINDOW, download)) {
    if (!result.ok) {
      report.failures.push(`${result.job.label} — ${result.reason}`);
      continue;
    }
    if (report.packed >= MAX_ENTRIES) {
      report.truncated = `hit the ${MAX_ENTRIES}-file ceiling for one archive`;
      break;
    }
    if (report.bytes + result.data.length > MAX_TOTAL_BYTES) {
      report.truncated = `hit the ${formatBytes(MAX_TOTAL_BYTES)} ceiling for one archive`;
      break;
    }

    // Two ids can end in the same eight characters; a suffix is cheaper than
    // silently overwriting one card's photo with another's on unpacking.
    let name = result.name;
    for (let n = 2; taken.has(name); n++) {
      name = result.name.replace(/(\.[^.]+)$/, `-${n}$1`);
    }
    taken.add(name);

    report.packed += 1;
    report.bytes += result.data.length;
    yield { name, data: result.data };

    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      report.truncated = "ran out of time before the whole selection was fetched";
      break;
    }
  }

  yield { name: "_export.txt", data: Buffer.from(reportText(report), "utf8") };
}
