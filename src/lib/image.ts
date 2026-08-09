/**
 * Client-safe image URL helpers.
 *
 * `upscaleImageUrl` tries to request a higher-resolution variant of a product
 * image by bumping the size token many CDNs encode in the URL. It is a
 * best-effort *heuristic*: some CDNs won't serve the rewritten size, so callers
 * that render the result must be able to fall back to the original URL (see
 * `components/product/ProductImage`). It never rewrites URLs whose dimensions
 * are cryptographically signed, because changing them invalidates the signature
 * and the CDN returns 403/404 — the exact way product photos "disappear".
 */

export const MIN_WIDTH = 1000;

/**
 * Hosts we own or pay for, and are therefore allowed through Next's image
 * optimizer. Everything else — partner CDNs like Farfetch or the AWIN proxy —
 * is served straight to the browser instead.
 *
 * The reason is not cost, it's that the optimizer *cannot fetch* some of them.
 * The optimizer pulls the source image server-side, from a datacenter IP with
 * no browser headers, and Farfetch's CDN rate-limits exactly that: it answered
 * 429 to 6/6 optimizer requests while serving the same file to a direct request
 * with 200. Our own downloader already works around this by faking a browser
 * User-Agent and Referer (see api/admin/image-tools), which the optimizer has
 * no way to do. So partner images go direct — the browser is the one client
 * those CDNs are happy to serve.
 *
 * Keep this list in sync with `images.remotePatterns` in next.config.ts: a host
 * that reaches the optimizer without a matching pattern gets a hard 400.
 */
const OWN_IMAGE_HOSTNAME = /(^|\.)(supabase\.co|replicate\.delivery)$/i;

/**
 * Whether `src` may be routed through `/_next/image`. Local paths ("/hero.png")
 * and our own storage are optimized; partner CDNs, `blob:` previews and `data:`
 * URIs are not. A src we can't parse is treated as foreign — failing towards
 * "render it directly" keeps a broken URL from turning into a missing image.
 */
export function shouldOptimizeImage(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    const { protocol, hostname } = new URL(src);
    if (protocol !== "https:" && protocol !== "http:") return false;
    return OWN_IMAGE_HOSTNAME.test(hostname);
  } catch {
    return false;
  }
}

// Query strings that sign or lock a URL to a specific rendition. Rewriting the
// width/height on any of these breaks the signature (imgix `s=`, AWS presigned,
// CloudFront `Key-Pair-Id`, and generic signed CDNs) — so leave them untouched.
const SIGNED_OR_LOCKED =
  /[?&](s|sig|sign|signature|hmac|token|expires|policy|key-pair-id|x-amz-signature|x-amz-credential|x-amz-security-token)=/i;

// Shopify's CDN generates `_<width>x.<ext>` renditions on demand, so rewriting a
// filename size suffix to `_1000x.jpg` is safe there. On any other host a file
// literally named `_medium.jpg` is a real filename and rewriting it 404s.
function isShopifyImage(url: string): boolean {
  return /cdn\.shopify\.com/i.test(url) || /\/cdn\/shop\//i.test(url) || /\/s\/files\//i.test(url);
}

// Request a higher-resolution variant of a product image URL. Many CDNs encode
// the width in the URL; og:image / JSON-LD thumbnails are often small, so
// bumping the obvious size token to ~1000px yields a sharper catalog image.
export function upscaleImageUrl(url: string): string {
  if (!url || !/^https?:\/\//.test(url)) return url;
  // Signed/expiring URLs are locked to their rendition — never rewrite them.
  if (SIGNED_OR_LOCKED.test(url)) return url;
  let out = url;

  // Width-style query params: ?w=300, &width=200, &sw=150, &imwidth=250, &wid=…
  // (sw/dw = Salesforce/Demandware, wid = Adobe Scene7, imwidth = Farfetch)
  out = out.replace(
    /([?&](?:w|width|sw|dw|wid|imwidth|mw|maxwidth|fit-width)=)(\d{2,4})\b/gi,
    (_m, prefix: string, n: string) => prefix + Math.max(Number(n), MIN_WIDTH),
  );

  // Height-style query params (sh/dh = Demandware, hei = Scene7). Bumped in
  // lock-step with width so square-cropped CDNs don't return a tiny image.
  out = out.replace(
    /([?&](?:h|height|sh|dh|hei|imheight|mh|maxheight|fit-height)=)(\d{2,4})\b/gi,
    (_m, prefix: string, n: string) => prefix + Math.max(Number(n), MIN_WIDTH),
  );

  // Cloudinary / imgix-style transform tokens in the path: .../w_100,h_100/...
  // or .../w_100/... — bump any width/height token that's below the target.
  out = out.replace(
    /([,/](?:w|h)_)(\d{2,4})\b/gi,
    (m, prefix: string, n: string) => (Number(n) < MIN_WIDTH ? prefix + MIN_WIDTH : m),
  );

  // Path-segment dimensions: .../300x400/..., .../300x/... (Thumbor, many shops).
  out = out.replace(
    /\/(\d{2,4})x(\d{0,4})\//g,
    (m, w: string, h: string) =>
      Number(w) < MIN_WIDTH ? `/${MIN_WIDTH}x${h ? MIN_WIDTH : ""}/` : m,
  );

  // Shopify filename size suffixes — only on Shopify's CDN, where `_1000x.jpg`
  // is a valid generated rendition. Elsewhere the suffix is a literal filename.
  if (isShopifyImage(out)) {
    // Numeric suffix: _100x.jpg, _100x100.jpg, _100x150_crop_center.jpg
    out = out.replace(
      /_(\d{2,4})x(\d{0,4})((?:_[a-z_]+)?\.(?:jpg|jpeg|png|webp|avif))(?=$|\?)/i,
      (m, w: string, h: string, tail: string) =>
        Number(w) < MIN_WIDTH ? `_${MIN_WIDTH}x${h ? MIN_WIDTH : ""}${tail}` : m,
    );
    // Named preset: _small.jpg, _medium.jpg, _large.jpg, _grande.jpg, _thumb.jpg…
    out = out.replace(
      /_(pico|icon|thumb|thumbnail|tiny|mini|small|compact|medium|large|grande|preview)(\.(?:jpg|jpeg|png|webp|avif))(?=$|\?)/i,
      (_m, _size: string, ext: string) => `_${MIN_WIDTH}x${ext}`,
    );
  }

  // Farfetch CDN encodes width as a trailing _NNN before the extension.
  if (/farfetch/i.test(out)) {
    out = out.replace(
      /_(\d{2,4})\.(jpg|jpeg|png|webp)(?=$|\?)/i,
      (m, n: string, ext: string) => (Number(n) < MIN_WIDTH ? `_${MIN_WIDTH}.${ext}` : m),
    );
  }

  // AWIN / productserve proxy uses w=/h= params (kept square).
  if (/productserve\.com|awin1\.com/i.test(out)) {
    out = out.replace(/([?&]w=)\d+/i, `$1${MIN_WIDTH}`).replace(/([?&]h=)\d+/i, `$1${MIN_WIDTH}`);
  }

  return out;
}
