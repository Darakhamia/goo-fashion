/**
 * Mirror external product photos into our own Supabase Storage bucket.
 *
 * Catalog imports must not hotlink retailer CDNs: those URLs rot, rate-limit
 * (Farfetch answers 429 to our optimizer — see audit note Б0-3) and can be
 * pulled at any time. So on import we download every product photo with
 * browser-like headers (which also defeats hotlink protection) and re-upload it
 * to the public `product-images` bucket, then swap the URLs on the product.
 *
 * The download/upload primitives here are the single source of truth for
 * mirroring product photos into Storage.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { MAX_PRODUCT_IMAGES } from "@/lib/server/product-fields";
import { validateTargetUrl } from "@/lib/server/parser/fetch";

export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Hard cap on a single downloaded image (matches the bucket's file-size limit). */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * Create the public bucket once per server process; ignore "already exists".
 * Remembered so an import doesn't send a createBucket call before every photo.
 */
let bucketReady = false;
export async function ensureProductImagesBucket(): Promise<void> {
  if (bucketReady || !supabase) return;
  const { error } = await supabase.storage.createBucket(PRODUCT_IMAGES_BUCKET, {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
  });
  if (error && !error.message.includes("already exists")) {
    throw new Error(`Bucket error: ${error.message}`);
  }
  bucketReady = true;
}

/** Upload a buffer and return its public URL. */
export async function uploadToStorage(
  buffer: Buffer,
  ext: string,
  contentType: string,
): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  await ensureProductImagesBucket();
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Map a content-type to a file extension we store. */
function extFor(contentType: string): string {
  const t = contentType.toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("avif")) return "avif";
  if (t.includes("gif")) return "gif";
  return "jpg";
}

/** Redirect hops followed per download; CDNs use one or two. */
const MAX_REDIRECTS = 5;

/**
 * True when the URL is on the very origin of our Supabase (`SUPABASE_URL`).
 *
 * Stricter than `isAlreadyMirrored` on purpose: that one also accepts any host
 * whose path merely looks like our bucket, which is fine for "don't mirror it
 * again" but not for "skip the internal-address check" — a scraped page could
 * hand us `http://10.0.0.5/storage/v1/object/public/product-images/x.jpg`.
 */
function isOwnStorageOrigin(url: string): boolean {
  const supaUrl = process.env.SUPABASE_URL ?? "";
  if (!supaUrl) return false;
  try {
    return new URL(url).origin === new URL(supaUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Throw unless the server may download this address: our own storage (which in
 * local development lives on localhost, so it is let through first) or a public
 * http(s) host — never loopback, private, link-local or cloud metadata.
 */
function assertFetchable(url: string): void {
  if (isOwnStorageOrigin(url)) return;
  const valid = validateTargetUrl(url, "direct");
  if ("error" in valid) throw new Error(valid.error);
}

/**
 * Download an image with browser-like headers and a per-site Referer, which gets
 * past CDN hotlink protection. Rejects non-image responses and anything over the
 * size cap.
 *
 * Redirects are followed by hand, so every hop passes the same address check as
 * the first URL — otherwise a public URL answering "302 → http://169.254.169.254/"
 * would walk straight past it. The timeout covers the whole chain.
 */
export async function fetchImageBuffer(
  url: string,
  timeoutMs = 30_000,
): Promise<{ buffer: Buffer; contentType: string }> {
  let referer = "https://www.google.com/";
  try {
    const { origin, hostname } = new URL(url);
    if (hostname.includes("farfetch")) referer = "https://www.farfetch.com/";
    else if (hostname.includes("ssense")) referer = "https://www.ssense.com/";
    else if (hostname.includes("mytheresa")) referer = "https://www.mytheresa.com/";
    else if (hostname.includes("mrporter") || hostname.includes("net-a-porter")) referer = "https://www.mrporter.com/";
    else referer = origin + "/";
  } catch {
    /* keep default referer */
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: referer,
    "Sec-Fetch-Dest": "image",
    "Sec-Fetch-Mode": "no-cors",
    "Sec-Fetch-Site": "cross-site",
  };
  const signal = AbortSignal.timeout(timeoutMs);

  let current = url;
  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertFetchable(current);
    const r = await fetch(current, { headers, signal, redirect: "manual" });
    const location = r.status >= 300 && r.status < 400 ? r.headers.get("location") : null;
    if (!location) {
      res = r;
      break;
    }
    r.body?.cancel().catch(() => undefined); // free the socket of the hop left behind
    current = new URL(location, current).toString();
  }
  if (!res) throw new Error("Too many redirects");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`Not an image (${contentType})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0) throw new Error("Empty response");
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("Image exceeds size limit");
  return { buffer, contentType };
}

/** Download one URL and re-upload it, returning the new public URL. */
export async function mirrorImageUrl(url: string): Promise<string> {
  const { buffer, contentType } = await fetchImageBuffer(url);
  return uploadToStorage(buffer, extFor(contentType), contentType);
}

/**
 * True once a URL already points at our own storage — nothing to mirror.
 * Matches on the full origin (not just the host) so a CDN that happens to share
 * a hostname on another port is still treated as external.
 */
export function isAlreadyMirrored(url: string): boolean {
  const supaUrl = process.env.SUPABASE_URL ?? "";
  if (supaUrl) {
    try {
      if (new URL(url).origin === new URL(supaUrl).origin) return true;
    } catch {
      /* fall through */
    }
  }
  return /\/storage\/v1\/object\/public\/product-images\//.test(url);
}

export interface MirrorResult {
  /** Primary image after mirroring (falls back to the original on failure). */
  imageUrl: string;
  /** Gallery images after mirroring, in the original order. */
  images: string[];
  mirrored: number;
  failed: number;
  /** Whether Supabase Storage was available at all. */
  attempted: boolean;
}

/**
 * Mirror a product's primary + gallery photos into our storage.
 *
 * - Downloads each distinct URL at most once (primary shares the map).
 * - Runs a few in parallel to keep imports snappy without hammering the CDN.
 * - Never drops a photo: if a download/upload fails, the original URL is kept,
 *   so a rejected mirror degrades to a hotlink instead of a blank card.
 */
export async function mirrorProductImages(input: {
  imageUrl: string;
  images: string[];
  max?: number;
}): Promise<MirrorResult> {
  const imageUrl = (input.imageUrl ?? "").trim();
  const gallery = (input.images ?? []).map((u) => (u ?? "").trim()).filter(Boolean);
  // Shared with the extractor and the importer. A mirror ceiling below theirs
  // is the quiet kind of bug: the photos are found, stored as URLs, and then
  // simply never downloaded, so the product looks complete until the retailer
  // CDN stops serving it.
  const max = Math.max(1, Math.min(input.max ?? MAX_PRODUCT_IMAGES, MAX_PRODUCT_IMAGES));

  if (!isSupabaseConfigured || !supabase) {
    return { imageUrl, images: gallery, mirrored: 0, failed: 0, attempted: false };
  }

  // Distinct, order-preserving list of every URL the product references.
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const u of [imageUrl, ...gallery]) {
    if (!u || seen.has(u)) continue;
    if (!/^https?:\/\//.test(u)) continue;
    seen.add(u);
    ordered.push(u);
  }
  const targets = ordered.slice(0, max);

  const mapping = new Map<string, string>();
  let mirrored = 0;
  let failed = 0;

  // Small worker pool — 3 concurrent downloads.
  const CONCURRENCY = 3;
  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const url = targets[cursor++];
      if (isAlreadyMirrored(url)) {
        mapping.set(url, url);
        continue;
      }
      try {
        mapping.set(url, await mirrorImageUrl(url));
        mirrored++;
      } catch {
        mapping.set(url, url); // keep original — never lose the photo
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

  const remap = (u: string) => mapping.get(u) ?? u;
  const newGallery = gallery.map(remap);
  const newPrimary = imageUrl ? remap(imageUrl) : newGallery[0] ?? "";

  return {
    imageUrl: newPrimary,
    images: newGallery,
    mirrored,
    failed,
    attempted: true,
  };
}
