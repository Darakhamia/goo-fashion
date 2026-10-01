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

/**
 * Query parameters an ad click or a share adds to a link — never which page it
 * is. Kept narrow on purpose: a store's own parameters (`variant`, `color`)
 * and an affiliate's (`ref`, `aff_id`) are the link's business and stay.
 */
const CLICK_TRACKING =
  /^(?:utm_[a-z_]+|srsltid|gclid|gclsrc|gbraid|wbraid|dclid|fbclid|yclid|msclkid|ttclid|twclid|igshid|igsh|mc_cid|mc_eid|_ga|_gl|_hsenc|_hsmi)$/i;

/**
 * The product page an admin pasted, as the address to fetch and to keep.
 *
 * What gets pasted is rarely just the link: an app's "share" text carries it
 * among words ("Look at this on ZARA: https://…"), the address bar copies
 * "www.zara.com/…" without a scheme, a link from search results or Instagram
 * drags its click id along. Each of those was refused as an invalid URL — or,
 * worse, kept as the card's "where to buy" link with someone else's tracking
 * on it. So: the first http(s) link in the text, else the text itself read as
 * an https address when it looks like one; trailing punctuation off; click
 * tracking off. "" when there is no address in it.
 */
export function pastedUrl(text: string | null | undefined): string {
  const raw = (text ?? "").trim();
  if (!raw) return "";
  const linked = /https?:\/\/[^\s<>"'«»“”]+/i.exec(raw)?.[0];
  const bare = /^(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,}(?::\d+)?(?:[/?#]\S*)?$/u.test(raw) ? `https://${raw}` : "";
  let candidate = linked ?? bare;
  // Prose around a link ends a sentence after it: "…/am90." or "(…/am90)".
  candidate = candidate.replace(/[.,;:!?]+$/, "");
  if (candidate.endsWith(")") && !candidate.includes("(")) candidate = candidate.slice(0, -1);
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  const tracked = [...url.searchParams.keys()].filter((k) => CLICK_TRACKING.test(k));
  if (!tracked.length) return candidate;
  // Rebuilt only when there is something to drop, so an address is otherwise
  // kept exactly as pasted — the spelling an earlier import may have saved.
  const query = candidate.indexOf("?");
  const hash = candidate.indexOf("#", query);
  const head = candidate.slice(0, query);
  const fragment = hash >= 0 ? candidate.slice(hash) : "";
  const kept = candidate
    .slice(query + 1, hash >= 0 ? hash : undefined)
    .split("&")
    .filter((pair) => pair && !CLICK_TRACKING.test(paramName(pair)));
  return `${head}${kept.length ? `?${kept.join("&")}` : ""}${fragment}`;
}

/** A query pair's name, decoded where it can be. */
function paramName(pair: string): string {
  const name = pair.split("=")[0] ?? "";
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}
