/**
 * Take the rendered page and hand back markup small enough to post.
 *
 * This is the bookmarklet in `src/lib/parser-bookmarklet.ts`, with the clicking
 * automated. The strip list is deliberately identical — scripts except JSON-LD,
 * styles, stylesheet links, SVG, noscript, iframes, templates, and inline
 * data-URIs — because the server runs the very same extractor over what comes
 * out of here as over a pasted page. Diverging here would mean a product
 * imported by the extension could differ from the same product pasted by hand,
 * and there would be no way to tell which was right.
 *
 * What the strip is for: a retail page is several megabytes, almost all of it
 * script and style the parser never reads, and the route on the other end takes
 * 3 MB. Stripping takes a typical page to a couple of hundred kilobytes.
 *
 * Why JSON-LD survives: it is the densest source of truth on a retail page —
 * name, brand, every image, price, currency, colour and material as data rather
 * than as markup to mine.
 *
 * Before reading anything it scrolls the page. That is the whole reason a real
 * tab is worth its cost over a server fetch: a gallery that lazy-loads on
 * scroll is a spinner in the markup until something scrolls past it, and plain
 * `<img src>` afterwards.
 *
 * Injected with `chrome.scripting.executeScript`, so the completion value of
 * the last statement is what the worker receives.
 */

(async () => {
  /** Nodes the parser never reads, and that account for nearly all the weight. */
  const DROP =
    'script:not([type="application/ld+json"]),style,link[rel=stylesheet],svg,noscript,iframe,template';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Currency symbols and codes worth recognising in a printed price. */
  const MONEY =
    /(?:[$\u20ac\u00a3\u20b4\u00a5\u20ba]|z\u0142|K\u010d|\bkr\b|\b(?:USD|EUR|GBP|UAH|PLN|CZK|TRY|JPY|SEK|CHF|CAD|AUD|DKK|NOK|RON|HUF|BGN)\b)/i;

  /**
   * The price exactly as the page prints it, e.g. "4 000 \u20b4".
   *
   * This is the one thing a rendered page knows that its markup does not. A
   * store's structured data carries the amount as a bare number — JSON-LD gives
   * `"price": "4000"`, og gives `product:price:amount` — so when the store also
   * omits `priceCurrency`, nothing in the markup says which currency it is, and
   * the importer used to call it dollars. The symbol only exists in the text a
   * shopper reads, which is exactly what this tab has and a server fetch does
   * not.
   *
   * Only a hint: the server still takes the amount from the page's own fields.
   * Nothing is converted here — see the note in background.js.
   */
  function visiblePrice() {
    const candidates = [
      '[itemprop="price"]',
      '[data-price]',
      '[class*="price" i]',
      '[id*="price" i]',
    ];
    for (const sel of candidates) {
      let nodes;
      try {
        nodes = document.querySelectorAll(sel);
      } catch {
        continue;
      }
      for (const n of nodes) {
        // Skip anything the shopper cannot see: crossed-out originals are often
        // hidden rather than removed, and a hidden node is not what the page
        // says this product costs.
        if (!n.offsetParent && n !== document.body) continue;
        const text = (n.textContent || "").replace(/\s+/g, " ").trim();
        if (!text || text.length > 60) continue;
        if (MONEY.test(text) && /\d/.test(text)) return text.slice(0, 60);
      }
    }
    return "";
  }

  try {
    // Walk the page so lazy images commit to a real `src`. Four steps is enough
    // for the galleries this is aimed at without turning a snapshot into a
    // visible scroll animation the admin has to wait through.
    const height = document.body ? document.body.scrollHeight : 0;
    if (height > window.innerHeight) {
      for (let i = 1; i <= 4; i++) {
        window.scrollTo(0, (height / 4) * i);
        await sleep(220);
      }
      window.scrollTo(0, 0);
      await sleep(150);
    }

    const root = document.documentElement.cloneNode(true);
    root.querySelectorAll(DROP).forEach((n) => n.remove());
    // An inline data-URI is a whole image encoded in the attribute. The parser
    // cannot use one and it can be megabytes on its own, so the attribute goes
    // and the element stays.
    root.querySelectorAll('[src^="data:"]').forEach((n) => n.removeAttribute("src"));

    // Read from the live document, not the stripped clone: `offsetParent` is
    // only meaningful for nodes that are actually laid out.
    const priceDisplay = visiblePrice();

    return {
      ok: true,
      url: location.href,
      html: `<html>${root.innerHTML}</html>`,
      priceDisplay,
      // The store's own title, for working out the furniture it appends to
      // every page. Sent raw; the server decides what of it is a product name.
      pageTitle: (document.title || "").replace(/\s+/g, " ").trim().slice(0, 200),
    };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
})();
