/**
 * Reading a response body we do not control, with a ceiling.
 *
 * `res.text()` and `res.arrayBuffer()` buffer the whole body before a caller
 * can look at its size, and fetch decodes gzip and brotli on the fly: a 200 KB
 * gzip of zeros becomes hundreds of megabytes in memory, and the site runs as
 * one Node process. So a fetch of an address someone else chose reads through
 * here: a declared Content-Length over the cap is refused before reading, and
 * the stream is cut off as soon as the count passes it.
 */

export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Response is larger than ${Math.round(maxBytes / 1024 / 1024)} MB`);
    this.name = "BodyTooLargeError";
  }
}

/** The body as bytes, or `BodyTooLargeError` once it passes `maxBytes`. */
export async function readCappedBytes(res: Response, maxBytes: number): Promise<Buffer> {
  // Content-Length counts the encoded bytes, so it can only refuse early; the
  // decoded count below is what holds the line.
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    res.body?.cancel().catch(() => undefined);
    throw new BodyTooLargeError(maxBytes);
  }
  if (!res.body) return Buffer.alloc(0);

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

/** The body as UTF-8 text — what `res.text()` decodes to — with the same ceiling. */
export async function readCappedText(res: Response, maxBytes: number): Promise<string> {
  return new TextDecoder().decode(await readCappedBytes(res, maxBytes));
}

/**
 * The raster type the bytes really are, read from their first bytes — or null.
 *
 * A server's Content-Type is its word only. An "image/*" answer can be SVG,
 * which is a document that runs script, and a mirrored copy lands in a public
 * bucket on our own site. What is stored is what the bytes say.
 */
export function sniffRasterImage(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/avif" | null {
  const at = (i: number) => bytes[i];
  const ascii = (from: number, text: string) =>
    text.split("").every((ch, i) => bytes[from + i] === ch.charCodeAt(0));
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && at(0) === 0x89 && ascii(1, "PNG") && at(4) === 0x0d && at(5) === 0x0a) return "image/png";
  if (bytes.length >= 6 && (ascii(0, "GIF87a") || ascii(0, "GIF89a"))) return "image/gif";
  if (bytes.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  // ISO-BMFF: a box size, then "ftyp", then the brand — avif, or avis for a sequence.
  if (bytes.length >= 12 && ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return "image/avif";
  return null;
}
