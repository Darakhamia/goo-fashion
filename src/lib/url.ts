/**
 * URL helpers with no dependencies, for the server and the browser alike.
 */

/**
 * The store a link points at, as a bare host: hostname without a leading
 * "www.", lowercase. "" for a missing or unparseable URL.
 *
 * "www." is stripped before lowercasing, as the copies this replaced did. For
 * http(s) links the URL parser has already lowercased the hostname, so the
 * order only shows on an exotic scheme ("foo://WWW.X.com" → "www.x.com").
 */
export function bareHost(url: string | null | undefined): string {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "").toLowerCase() : "";
  } catch {
    return "";
  }
}
