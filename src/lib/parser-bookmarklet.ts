/**
 * The bookmarklet that imports a product from a store that refuses our server.
 *
 * The insight is that the block is not on the *data*, it is on the *requester*.
 * An admin opening goat.com in their own browser passes the anti-bot check by
 * being a person on a residential connection — the page is already on their
 * screen. This hands that page to our parser, and everything downstream is
 * unchanged: the same extractor, gallery harvester, colour reading and import.
 *
 * It is also a better source than a server fetch, not merely a fallback: the
 * copied markup is the RENDERED DOM, so a gallery that lazy-loads on scroll is
 * plain `<img src>` by the time it is read.
 *
 * Cost: nothing. No proxy, no VPS, no scraping provider, no headless browser.
 * Limit: one product per click — this is the answer for the handful of pieces
 * from a defended store, not for collecting its catalogue.
 *
 * The script strips what the parser never reads and what makes a retail page
 * megabytes — scripts (except JSON-LD, the densest source of truth we have),
 * styles, SVG paths, iframes and inline data-URIs — which takes a typical page
 * from several MB to a couple of hundred KB, comfortably under the request
 * body limit on the other end.
 */

/** Marks a clipboard payload as ours, so the paste box can tell it apart. */
export const BOOKMARKLET_MARKER = "goo-parser";

/** Shape the bookmarklet puts on the clipboard. */
export interface BookmarkletPayload {
  marker: typeof BOOKMARKLET_MARKER;
  url: string;
  html: string;
}

/**
 * Readable source of the bookmarklet. Kept as one expression so it survives
 * being squeezed onto a `javascript:` line, and deliberately written in ES5 —
 * a bookmarklet runs in whatever browser the admin has open, on a page whose
 * own scripts we have just removed.
 */
const SOURCE = `(function(){
  try {
    var root = document.documentElement.cloneNode(true);
    var drop = root.querySelectorAll('script:not([type="application/ld+json"]),style,link[rel=stylesheet],svg,noscript,iframe,template');
    for (var i = 0; i < drop.length; i++) drop[i].parentNode.removeChild(drop[i]);
    var inline = root.querySelectorAll('[src^="data:"]');
    for (var j = 0; j < inline.length; j++) inline[j].removeAttribute('src');
    var payload = JSON.stringify({ marker: '${BOOKMARKLET_MARKER}', url: location.href, html: '<html>' + root.innerHTML + '</html>' });
    var kb = Math.round(payload.length / 1024);
    var done = function(){ alert('Goo: page copied (' + kb + ' KB).\\nPaste it into Goo Studio -> Parser -> Paste page.'); };
    var fail = function(){
      var box = document.createElement('textarea');
      box.value = payload;
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(box);
      if (ok) done(); else alert('Goo: could not reach the clipboard on this site.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(payload).then(done, fail);
    else fail();
  } catch (e) {
    alert('Goo: ' + (e && e.message ? e.message : e));
  }
})()`;

/**
 * The `javascript:` URL to save as a bookmark.
 *
 * Encoded rather than merely whitespace-collapsed: a bookmark URL that carries
 * a raw `#` or `%` loses everything after it, and product pages are exactly
 * where those characters turn up.
 */
export function bookmarkletHref(): string {
  return `javascript:${encodeURIComponent(SOURCE.replace(/\s*\n\s*/g, " "))}`;
}

/**
 * Read what the admin pasted: either a bookmarklet payload, or raw markup they
 * copied by hand (View Source, DevTools), in which case the URL comes from the
 * field they filled in.
 */
export function readPastedPage(text: string): { url?: string; html: string } | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<BookmarkletPayload>;
      if (parsed?.marker === BOOKMARKLET_MARKER && typeof parsed.html === "string") {
        return { url: typeof parsed.url === "string" ? parsed.url : undefined, html: parsed.html };
      }
    } catch {
      // Not our payload — fall through and treat it as markup.
    }
  }
  return { html: trimmed };
}
