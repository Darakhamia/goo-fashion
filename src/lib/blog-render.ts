/**
 * Render admin-authored blog body into HTML.
 *
 * Supports two authoring modes transparently:
 *   1. HTML — if the body contains block-level tags, we sanitize it with an
 *      allowlist before rendering. Admins are trusted, but sanitizing guards
 *      against a compromised admin account or AI-generated content smuggling
 *      <script>/event handlers into a public page (stored XSS).
 *   2. Plain text — split on blank lines into paragraphs, convert single
 *      line breaks to <br>, escape the rest.
 */
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "div", "section", "article", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "br", "blockquote", "img", "a", "strong", "em", "b", "i",
    "code", "pre", "hr", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "td", "th", "span",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    "*": ["class"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  // Force rel on links so target=_blank can't be used for tab-nabbing.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

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

  if (HTML_BLOCK_RE.test(body)) return sanitizeHtml(body, SANITIZE_OPTIONS);

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
