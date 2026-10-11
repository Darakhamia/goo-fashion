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
 * URL slug for a blog post: lowercase ASCII words joined by hyphens, capped at
 * 90 chars. The one copy shared by the admin editor and the AI draft route, so
 * a hand-typed slug and a generated one follow the same rules.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
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

/** A catalogue page — a brand, a category, a brand's kind of thing — as `linkCatalogMentions` links it. */
export interface CatalogLink {
  name: string;
  path: string;
}

/** At most this many catalogue links in one post: a link on every name reads as spam. */
const MAX_CATALOG_LINKS = 8;

/**
 * The first mention of each catalogue page's name in a rendered post — a brand,
 * a category, a brand's kind of thing — linked to that page (docs/SEO_PLAN.md,
 * SEO-23): the journal wrote about Prada, sneakers and Timberland boots and
 * linked to nothing the reader could buy.
 *
 * Works on the sanitized HTML from `renderBlogBody`, text between tags only —
 * never inside an existing link or a heading. Longer names go first, so
 * "Timberland Boots" links to that page rather than to the brand, and
 * "adidas Originals" is not taken for "adidas". Names of five letters or more
 * match in any case; shorter ones ("COS", "Nike", "Hats") only as written, so
 * an ordinary word is not mistaken for a name.
 */
export function linkCatalogMentions(html: string, brands: CatalogLink[]): string {
  const pending = [...brands]
    .filter((b) => b.name.trim().length >= 3)
    .sort((a, b) => b.name.length - a.name.length);
  if (!pending.length) return html;

  const linked = new Set<string>();
  let skipDepth = 0; // inside <a> or a heading
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith("<")) {
        if (/^<(a|h[1-6])\b/i.test(part)) skipDepth++;
        else if (/^<\/(a|h[1-6])>/i.test(part)) skipDepth = Math.max(0, skipDepth - 1);
        return part;
      }
      if (skipDepth > 0) return part;

      // The text as pieces; a piece that became a link is never searched again.
      let pieces: { html: string; link: boolean }[] = [{ html: part, link: false }];
      for (const brand of pending) {
        if (linked.size >= MAX_CATALOG_LINKS) break;
        if (linked.has(brand.path)) continue;
        const name = escapeHtml(brand.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`(?<![\\p{L}\\p{N}])${name}(?![\\p{L}\\p{N}])`, brand.name.length >= 5 ? "iu" : "u");
        const next: typeof pieces = [];
        let done = false;
        for (const piece of pieces) {
          const match = !done && !piece.link ? re.exec(piece.html) : null;
          if (!match) {
            next.push(piece);
            continue;
          }
          done = true;
          next.push(
            { html: piece.html.slice(0, match.index), link: false },
            { html: `<a href="${brand.path}">${match[0]}</a>`, link: true },
            { html: piece.html.slice(match.index + match[0].length), link: false },
          );
        }
        if (done) linked.add(brand.path);
        pieces = next;
      }
      return pieces.map((p) => p.html).join("");
    })
    .join("");
}
