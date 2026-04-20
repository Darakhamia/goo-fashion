/**
 * Render admin-authored blog body into HTML.
 *
 * Supports two authoring modes transparently:
 *   1. HTML — if the body contains block-level tags, we render as-is
 *      (admin is trusted via ADMIN_USER_IDS gate, so no sanitization).
 *   2. Plain text — split on blank lines into paragraphs, convert single
 *      line breaks to <br>, escape the rest.
 */

const HTML_BLOCK_RE =
  /<\/?(p|div|section|article|h[1-6]|ul|ol|li|br|blockquote|img|a|strong|em|code|pre|hr|figure|figcaption|table|thead|tbody|tr|td|th)\b/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderBlogBody(raw: string | null | undefined): string {
  const body = (raw ?? "").trim();
  if (!body) return "";

  if (HTML_BLOCK_RE.test(body)) return body;

  return body
    .split(/\n{2,}/)
    .map((block) => {
      const escaped = escapeHtml(block).replace(/\n/g, "<br>");
      return `<p>${escaped}</p>`;
    })
    .join("\n");
}

/**
 * Estimate reading time at ~200 WPM, rounded up to whole minutes.
 * Strips HTML tags first so tag noise doesn't inflate the count.
 */
export function estimateReadTime(body: string | null | undefined): string {
  const text = (body ?? "").replace(/<[^>]*>/g, " ").trim();
  if (!text) return "1 min";
  const words = text.split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min`;
}
