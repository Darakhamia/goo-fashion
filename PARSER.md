# Universal Product Parser

Import products from **any** store URL (Farfetch, SSENSE, Mr Porter, a brand's
own site) straight into the catalog — one page, a whole category, or a whole
store — plus the shared import step the CSV feed importer also runs on.

Admin screen: **Goo Studio → Imports → Parser** (`/goo-studio/parser`), four tabs:
**Collect catalog** (opens first), **Parse URL**, **Site Recipes**, **Fetch & Anti-bot**.
The browser-extension receiver lives at `/goo-studio/parser/collect` (no menu item
of its own — see §1c).

### Which way in

| Situation | Use |
|---|---|
| One product, the store answers our server | **Parse URL** tab |
| A category or a whole store, the store answers our server | **Collect catalog** tab (§5) |
| One product, the store refuses our server | **Paste page** panel in Parse URL (§1b) |
| A category or a whole store, the store refuses our server | **Collect with the extension** (§1c) |
| An affiliate feed (CSV) | **Imports → Import** (`/goo-studio/import`), same import step (§7) |

---

## Why this design (and where `curl_cffi` fits)

`curl_cffi` and `cloakbrowser`/`playwright` are Python tools that defeat anti-bot
(Cloudflare / Akamai / DataDome) by impersonating a real browser's TLS/JA3
fingerprint and rendering JS. They **cannot run inside the Next.js app**, which is
a Node process (in production: a nixpacks build on our own Coolify server).

So the parser splits the job in two:

1. **Fetching** is *pluggable*. The heavy anti-bot work is delegated to whatever
   the admin configures — including a separate, self-hosted `curl_cffi`/playwright
   service. Whether such a service is deployed, and where, is not recorded in the
   repository — confirm with the CEO.
2. **Extraction + normalisation** runs in TypeScript, in-app, and is fully
   universal (no per-site code required for most stores).

The cheapest fetcher of all turned out to be the admin's own browser: it passes
the checks our server fails. The paste panel (one page) and the extension (a
whole catalogue) hand its rendered DOM to the same pipeline.

```
URL ─▶ Fetch layer ─▶ HTML ─▶ Universal extractor ─▶ Normalizer ─▶ preview ─▶ import
        (pluggable)     ▲       (JSON-LD/OG/microdata)                        (importParsedProduct,
                        │                                                      shared with CSV import)
   pasted page / extension snapshot (rendered DOM, no server fetch)
```

---

## 1. Fetch layer — "Fetch & Anti-bot" tab

| Provider | What it does |
|---|---|
| `direct` | Node `fetch` with realistic browser headers. Good for soft targets only. |
| `scrapingbee` / `scraperapi` / `zenrows` | Managed scraping APIs — TLS impersonation, residential proxies, optional JS render. |
| `custom` | **Your own `curl_cffi`/playwright/cloakbrowser microservice.** |

For `custom`, give a URL template with placeholders:

```
https://my-curl-cffi.fly.dev/fetch?token={key}&url={url}&render={render}
```

`{url}` → URL-encoded target (required — a template without it is refused),
`{key}` → API key, `{render}` → `true`/`false`, `{impersonate}` → the browser
profile picked in the UI (this is the argument a `curl_cffi` service passes to
`impersonate=`), `{timeout}` → the timeout in ms.

Options, and where each one actually reaches the store — the tab shows a field
only for the providers it applies to:

| Option | Shown for | What it does |
|---|---|---|
| **Impersonate** (chrome / safari / firefox / edge) | Direct, Custom | Direct: sets the User-Agent (and `sec-ch-ua` headers for chrome/edge); a 403 is retried once under another profile. Custom: substituted into `{impersonate}`. ScrapingBee / ScraperAPI / ZenRows never receive it. |
| **Render JS** | ScrapingBee, ScraperAPI, ZenRows, Custom | Forwarded as the provider's render flag, or into `{render}`. Direct mode has no browser, so the toggle is hidden there. |
| **Timeout** | all | Per request; stored clamped to 1–60 s (default 20 s). |

**Fetch settings are global.** Every page of every store is fetched with the
settings from this tab. Site recipes carry extraction overrides only; the old
per-site fetch override was unreachable and has been removed from the types and
the code.

The provider API key is stored server-side (masked in the UI) or set via the
`PARSER_FETCH_API_KEY` env var (env wins, like the OpenAI key). Every non-direct
provider refuses to run without a key — `custom` included, so a service that
needs none still gets some value for `{key}`.

> Example tiny `curl_cffi` service the `custom` provider can call:
> ```python
> from curl_cffi import requests
> from flask import Flask, request
> app = Flask(__name__)
> @app.get("/fetch")
> def fetch():
>     r = requests.get(request.args["url"], impersonate="chrome")
>     return r.text
> ```

---

## 1a. Before the HTML — the store's own data

Fetching a *page* is the expensive way to ask a shop what it sells, and the way
most likely to be refused: anti-bot sits in front of pages, because pages are
what a scraper is expected to want. Three platforms answer better, and all
three are asked before any markup is fetched — `storefront.ts` is the one door
the pipeline knocks on, so nothing downstream learns which one replied.

### Shopify JSON (`shopify.ts`)

Every Shopify storefront answers three addresses no theme can turn off:

| Address | Gives |
|---|---|
| `/products/<handle>.json` | one product, in full |
| `/collections/<handle>/products.json` | a page of a collection |
| `/products.json` | a page of the whole catalogue |

The product JSON lists **every** photo in `images[]`, every variant with its
price and compare-at price, and the colour and size options as data — the whole
job of the extractor and the gallery harvester, done exactly, with no identity
tests and nothing to guess. And being an API rather than a page, it is routinely
served 200 on a store whose HTML answers 403.

Any other store answers a `/products/<handle>.json` with a 404 or a page, so the
host is remembered as "not Shopify" for the rest of the run and the guess is
paid for once. Prices come as bare numbers, so the shop's currency is read once
from `/meta.json`; when that is missing the field is left empty rather than
guessed, because a wrong currency is a wrong price tag.

### WooCommerce Store API (`woocommerce.ts`)

The read-only half of Woo's REST surface — what its own block-based grids and
cart talk to — needs no key, no nonce and no account:

| Address | Gives |
|---|---|
| `/wp-json/wc/store/v1/products?slug=<slug>` | one product, in full |
| `/wp-json/wc/store/v1/products?category=<id>` | a page of one category |
| `/wp-json/wc/store/v1/products?per_page=100` | a page of the whole catalogue |

It matters more than Shopify's in one way: a brand's own Woo store is the
archetype of the shop that ships no JSON-LD, no product OpenGraph tags and no
microdata — the case the AI fallback exists to rescue **at the cost of a model
call per product**. Read as data, those stores need no call at all, so this is
the one addition that makes the parser cheaper rather than merely wider.

Three details the endpoint forces:

- **Prices are minor units.** `"4200"` with `currency_minor_unit: 2` is 42.00.
  Older builds send a decimal and no minor unit, so the *presence* of that
  field decides how the number is read rather than its shape — guessing would
  put a price 100× off on a tag. A variable product's `price_range.min_amount`
  is shown, so a catalogue reads "from".
- **Two bases.** The API moved under `/v1` in 2021 and older installs still
  answer the unversioned path. WordPress replies to an unknown REST route with
  a 404 carrying `{"code":"rest_no_route"}` — that is WordPress saying "not
  here", and it is what tells a Woo store with the other base apart from a site
  that is not WordPress at all. Which base answered is remembered per host, so
  the second one is tried once and never again.
- **Categories are addressed by id.** A pasted `/product-category/…` costs one
  extra request to translate the slug. When that fails the walk stops rather
  than falling back to the whole catalogue: the admin pasted one category, and
  the entire store is not a smaller version of that answer.

Colour and size come from the named attribute terms (`pa_colour`, `pa_size` and
their localised labels), and the brand from `brands[]` where WooCommerce 9.4+
ships it, or from a plain Brand attribute where it does not.

### Squarespace (`squarespace.ts`)

Every Squarespace page answers its own address with `?format=json` — the payload
the site's front end is built from:

| Address | Gives |
|---|---|
| `/shop/<slug>?format=json` | `item` — one product, in full |
| `/shop?format=json` | `items` — a page of the store, plus `pagination.nextPageUrl` |

Which of the two keys comes back is the store telling us what the URL was, and
that is worth more than it sounds. Everywhere else "product or listing?" has to
be decided from the shape of the URL before anything is asked, and Squarespace's
prefixes (`/shop/`, `/store/`, or whatever the owner typed) carry no marker to
decide it by. Here the payload decides: a pasted product never comes back as a
catalogue, and a pasted category never as one product. Pagination is followed by
the payload's own `nextPageUrl` rather than a guessed page parameter.

Prices prefer `priceMoney.value`, the decimal Squarespace states outright, and
fall back to the bare `price` field (minor units) only where a payload has no
money object — a product with no price at all is not importable. `structuredContent`
also decides what counts as a product, so a blog post is not filed as one.

### What a wrong guess costs

Three probes on a store that is none of the three, once per host — the answer is
the same for every URL on it, so `store-json.ts` remembers it and a
hundred-product collect pays it once rather than a hundred times. Each probe has
8 seconds, and the whole chain is capped at 12 seconds, because a parse or crawl
request is meant to finish within the 60 seconds its route declares — fetching,
extraction and a model call included (see "Time limits"). Where the URL itself
gives the platform away (`/collections/…`, `/products/…` for Shopify;
`/product-category/…`, `/product/…`, `/wp-json/…` for WooCommerce), the platform
it points at is tried first; the other two are still asked, in order, if it
does not answer — unless the host is already remembered as "not that platform".

### Sitemaps (`sitemap.ts`)

A sitemap is the shop telling search engines what it sells — the one listing
meant to be read by a machine, and the one a defended store still serves,
because blocking it would cost the shop its Google traffic.

So a crawl reads it whenever the walk came back with **less than it was asked
for** — refused, empty, or simply short, which is the ordinary case for a grid
that loads the rest on scroll. `robots.txt` names the declared sitemaps first;
after them come the conventional locations, in the order they are worth trying:

| Guess | Whose |
|---|---|
| `/sitemap.xml`, `/sitemap_index.xml` | everyone |
| `/sitemap_products_1.xml` | Shopify |
| `/product-sitemap.xml` | Yoast / WooCommerce |
| `/wp-sitemap.xml` | WordPress core |
| `/sitemap/sitemap-index.xml` | Magento 2 |
| `/sitemap1.xml` | numbered split sitemaps |
| `/sitemap.xml.gz`, `/sitemap_index.xml.gz`, `/product-sitemap.xml.gz` | any large catalogue |

**Compressed sitemaps are read.** A catalogue of any size ships its sitemap
gzipped, because the protocol allows it and a 200k-URL file is mostly air.
`fetchHtml` would hand back a decoded string no unzip can recover, so `.gz` goes
through `fetchBinary` instead and is gunzipped from its own magic bytes — which
also catches a shop serving gzip from a plain `.xml` address. Only in `direct`
mode: a scraping provider answers with text it decided on, and a gzip stream run
through that is lost.

**A product sitemap is the store's own word.** A file the shop named
`product-sitemap.xml` is the shop declaring what is inside, and that outranks
our reading of a URL's shape — so its entries skip the product-path test and
only the flat refusals still apply (a `/cart` listed in a product sitemap is
still not a product). This is what makes a store addressing pieces as
`/shop/<slug>` work at all; before it, such a shop came back as "sitemap
readable, no products".

An index is followed one level down, product sitemaps first, up to ten children.
Budgets are two, not one: **twelve documents actually read** and **eighteen
requests spent looking**, because counting a guessed name that 404s as a
"document" let three wrong guesses use up the whole allowance before a real
sitemap was ever asked for. Both share the crawl's wall-clock deadline.

`<loc>` is read in both of its forms — bare, and wrapped in `CDATA`, which
WordPress and Magento both ship and which used to read as an empty sitemap.

This is also strictly better than the anchor walk where the HTML *does* work:
no pagination to follow, and an infinite-scroll grid that keeps its products in
a script has nothing to offer `<a href>` scraping anyway. A walk that already
filled its limit asks for nothing; anything short of that is topped up from the
sitemap and the screen says how many it added.

**Not for a single product.** The catalogue-wide fallbacks — the sitemap, and
the Shopify and Woo catalogue endpoints — are skipped when the pasted URL is
itself product-shaped, because they answer with the whole store. Answering "the whole
store" to someone who pasted one sneaker is worse than answering nothing: a
refused product page on goat.com would otherwise have imported sixty unrelated
products out of the sitemap. The URL has to decide it, since both run exactly
when the page did not arrive.

### Cookies and soft walls (`fetch.ts`)

The cheapest bot check there is: answer a first, cookie-less request with a 403
and a `Set-Cookie`, and the same request carrying that cookie with the page.
Node's `fetch` keeps no cookies, so every request we made was that refused first
one, over and over.

There is now a per-host jar (in memory, 10 minutes, `direct` only). Every direct
response's cookies are kept and every direct request carries them, so a crawl
walking twenty pages of one store arrives as one visitor rather than twenty
strangers — which is also what a rate limiter reads. On a 403 the retry now
changes both things it can: the browser profile **and** the cookie. When the
refusal itself set one, that is all it takes; when it refused silently, the
store's front page is asked for once per host, purely for the `Set-Cookie` that
comes with it, and the answer is thrown away.

This passes a soft wall. It does not pass Cloudflare, Akamai or DataDome, which
read the TLS handshake rather than the cookie — those still need the admin's
browser (§1b, §1c) or a provider.

### Retries and pacing (`fetch.ts`, `crawl.ts`)

One retry, only where a retry is the fix: a 429/503 is repeated once after
`Retry-After` (capped at 3s), and a 403 in `direct` mode is repeated once under
a different browser profile — the only thing about the request we can change.
A timeout is never retried; it has already spent its budget once. Requests to
one store are spaced by a jittered 150–400 ms, in the listing walk and between
the products of an import batch: five page loads back to back from one address
is the traffic shape rate limiters are built to catch, and being caught costs
the whole run.

---

## 1b. When the store refuses us anyway — paste the page

Some stores refuse everything a server can send: not Shopify, sitemap behind
the same wall, bot management in front of every path. goat.com is one.

The block is not on the data, though — it is on the *requester*. An admin
opening that product page in their own browser passes the check by being a
person on a residential connection, and the page is then on their screen. The
**Paste page** panel in the Parse URL tab takes it from there:

1. open the product page, and scroll the gallery so every photo loads;
2. click the **Goo: copy page** bookmarklet (drag it to the bookmarks bar once,
   from the same panel, or copy it as text);
3. paste, and press **Parse pasted page**.

The panel opens by itself when a parse is refused (any hint from `blockHint`),
and a refusal in the Collect catalog tab offers **Paste page instead**, which
carries the address into Parse URL and opens the panel.

`POST /api/admin/parser/parse` accepts `html` beside `url`; when it is there,
`parsePage` skips the fetch and the storefront probe entirely — nothing is asked
of the store — and runs the *same* extractor, gallery harvester, colour reading
and import as any other page. `src/lib/parser-bookmarklet.ts` holds the script
and the reader for what lands on the clipboard.

Two things make this better than a fallback rather than merely cheaper:

- **It is the rendered DOM.** A gallery that lazy-loads on scroll is plain
  `<img src>` by the time it is copied, so a page a server fetch would have
  read as one photo arrives with all of them.
- **It costs nothing.** No proxy, no VPS, no scraping provider, no headless
  browser — the browser is one the admin already has open.

The bookmarklet strips scripts (except JSON-LD, the densest source of truth on
the page), styles, SVG, iframes and inline data-URIs before copying, which
takes a typical retail page from several MB to a couple of hundred KB —
comfortably under the 3 MB the route accepts (a larger body is answered 413).

The limit is honest: one product per click. For a catalogue from a store that
refuses us, use the extension (§1c).

---

## 1c. Collecting with the browser extension

The paste route with the clicking automated. **Goo Collect** (`extension/`, a
Chrome extension, version 1.0.3) opens the store's pages in real background tabs
on the admin's machine — their address, their cookies, the check their browser
already passed — and hands the rendered DOM to the same pipeline. Install and
day-to-day use: [`extension/README.md`](extension/README.md).

**When to use it:** the store refuses our server (403/401/429/503, or an
anti-bot page instead of the listing) and you want more than one product. For a
single product the paste panel is enough. Every refusal hint names the
extension before a paid provider, and the paste panel for a single piece.

**Where it is in the admin:** Collect catalog tab → the "Store blocks our
server?" block → **Collect with the extension**; the same button appears under
a refusal in both the Collect catalog and Parse URL tabs. It opens
`/goo-studio/parser/collect`, which shows the install steps until the extension
connects. The popup also opens that tab by itself (in the background) when none
is open.

### How it is wired

```
popup (on the store's tab) ──start──▶ background.js (service worker)
   robots.txt, sitemaps: fetched by the worker
   each product page: opened in a background tab → snapshot.js strips it and reads evidence → tab closed
background.js ──chrome.runtime──▶ bridge.js (content script on the collect tab)
bridge.js ──window.postMessage──▶ /goo-studio/parser/collect (admin's Clerk session)
collect page ──fetch──▶ POST /api/admin/parser/collect { action: "plan" | "ingest" }
   plan   → planCollection()                     (pure: never touches the network)
   ingest → parsePage(url, { html, evidence }) → importParsedProduct()
```

The extension never calls our API itself: our session is a Clerk cookie that
does not travel from a `chrome-extension://` origin, and a token shipped inside
an extension is a key under the doormat. So it asks the open collect tab, and
the tab makes the call as the signed-in admin. Both the bridge and the page
accept a message only when `event.source === window` and the origin is the
page's own.

The route has two actions, and **neither opens the store's pages**. What our
server still downloads on this path, as on every import, is the product's
photos: all of them when photo copying is on (§6), and the main one to measure
its backdrop (and the garment's colour, when the page named none) — from our
copy, or from the store's CDN when copying is off:

| Action | In | Out |
|---|---|---|
| `plan` | start URL; the first page's rendered HTML (first round only); robots.txt text; sitemap documents the worker already fetched (≤12 per call, ≤5 MB each); URLs already seen (≤5 000); how many are still wanted (≤2 000) | product URLs — same host, deduped, robots-allowed, sitemap entries before page anchors; `delayMs` = the store's Crawl-delay, never under 1.5 s; up to 8 sitemap documents to fetch next round; a robots.txt summary for the screen |
| `ingest` | URL; stripped HTML (required, ≤3 MB — without it the route answers 400 rather than fall back to a server fetch); **page evidence**: image URLs (≤300), rendered price text, size labels (≤60), colour candidates with their origin (≤30), sibling-colour URLs (≤20), rendered description (≤5 000 chars), spec rows (≤40), breadcrumbs (≤12), brand text; the run's last 12 page titles | one outcome row: new / updated / skipped / failed, with notes |

Page evidence is what the rendered page said that the stripped markup no longer
does (hydration payloads, the price as a shopper reads it, the size buttons, the
selected swatch). It enters the extractor at the lowest precedence (§2): photos
still pass the gallery harvester's identity tests, colours go through
`colour-choice.ts`, sizes through `pickSizes`. The page titles let the server
work out the tail the store appends to every title (`commonTitleSuffix`) and cut
it off product names. Site recipes apply; the AI and photo-copy settings come
from **Fetch & Anti-bot → AI & images** (the extension sends no overrides).

### Pace and stopping

The rules live in `extension/background.js` and `plan-collection.ts`, and none
of them is a knob:

- robots.txt is obeyed — only the `*` group is read (`robots.ts`); disallowed
  URLs are dropped by `plan` and counted on the screen.
- Between pages: the store's Crawl-delay, never under 1.5 s, plus up to 40 %
  random spread; a 10-second rest every 20 pages.
- The first page answering 403/429 ends the run before anything else is asked;
  two refusals (403/429) in a row end it too. Other errors (404, 500) are
  stepped over.
- Up to 12 planning rounds (page anchors first, then sitemaps as the server asks
  for them).
- **Stop on the collect tab** is the hard stop: the tab refuses any further
  `plan` and `ingest`, so a page already in flight cannot land, and tells the
  worker to stop. **Stop in the popup** stops only the worker: pending pauses
  are cut short and no new page is opened, but a page whose snapshot or import
  is already under way can still land (the tab is not told, and shows
  "Finished" rather than "Stopped"). The worker says `hello` at the start of
  every run, which resets the tab (Stop, counters, titles) — the next run needs
  no reload.

Each outcome row says what the import did (photos, price conversion, brand read
off the name, where the colour filter / gender / style came from, colours
grouped, merged into an existing product), and an unsaved-columns warning is
shown once above the rows (§7). Every imported or updated product writes a
`parser.collect_ingest` entry to the admin action log.

**Address limit.** `bridge.js` is injected only on the addresses listed in
`extension/manifest.json` → `content_scripts.matches`: `localhost`, `127.0.0.1`,
`goo-fashion.com` and `www.goo-fashion.com`, path `/goo-studio/parser/collect*`.
If Goo Studio is served from any other host, the extension cannot reach it until
that host is added there. Which host production answers on — confirm with the
CEO.

---

## 2. Universal extractor

`src/lib/server/parser/extract.ts` reads structured data from raw HTML, highest
precedence first:

1. **Per-site recipe regex** (admin overrides) →
2. **JSON-LD** `schema.org/Product` (name, brand, `image[]`, `offers`, color,
   material, description, GTIN/MPN/SKU, `BreadcrumbList`) — Farfetch and most
   luxury retailers ship this →
3. **OpenGraph / product / twitter** meta tags (the page's `<h1>` sits between
   JSON-LD and OpenGraph for the name) →
4. **Microdata** (`itemprop=…`) →
5. **Page evidence** from the extension (§1c) — fills what the structured
   sources left empty. The one exception is the description: the rendered
   accordion text beats the truncated `og:description`.

No DOM library — pure regex/JSON, so it runs in any server route. Handles
`@graph`, `Offer`/`AggregateOffer` arrays, nested `Brand`, and HTML entities.

### Gallery harvesting

Structured data is reliable but thin about photography: OpenGraph carries a
single `og:image`, and stores ship JSON-LD with one photo for a page showing
eight. So `src/lib/server/parser/gallery.ts` also scrapes `<img>` (including the
lazy-loading and zoom attributes: `data-src`, `data-zoom-image`,
`data-large_image`), `srcset`, `<link rel=preload as=image>`, CSS
`background-image` and inline JSON for the rest of the gallery — and, on an
extension run, the image URLs the page evidence carries.

The hard part is that a product page is full of images that are *not* this
product — a recommendations carousel, nav banners, material icons, review photos
on a third-party host. A wrong photo is worse than a missing one, so a candidate
is kept only when it is on the same host as a trusted image **and** passes one
of four identity tests:

1. **Numbered sibling** — its filename shares ≥10 characters with a trusted
   image's and differs only by a short tail (`All-birds_0010` → `All-birds_0017`).
2. **Same frame, different number** — same length as a trusted filename and
   differing in at most two characters (`1204551_ivory_1` → `1204551_ivory_2`).
   Test 1 needs ten *leading* characters to agree, which a CDN addressing photos
   as `<sku><frame>` puts the difference too early for.
3. **Named after the product** — it contains two *adjacent* words of the product
   name or of the page URL's slug (`Classic Easy Tote` → `…_ClassicEasyToteV2_…`).
   Adjacency matters: scattered-word matching filed the separate "Classic Tote
   Insert" accessory under the tote.
4. **Carries the product code** — the ≥6-digit code the page URL is addressed by
   appears in the filename. Farfetch answers `…-item-27412345.aspx` with
   `…/27412345_18904371_1000.jpg`, which resembles nothing and is named after
   nothing, but says the SKU out loud.

Two rules sit on top of those. The furniture list (`banner`, `logo`, `payment`,
…) only judges candidates that got in on resemblance — applying it to a
name-matched file would drop the real photos of a "Star Print Shirt". And when
structured data yields **no** trusted image at all — a store with neither JSON-LD
nor `og:image` — tests 3 and 4 run on their own: there is no gallery to lose in
that case, only one to find.

Measured on live pages: Allbirds 1 → 5 photos, Cuyana 1 → 12, no foreign
products in either.

**Extension-less CDNs.** A photo does not have to end in `.jpg`. Scene7
(`/is/image/Retailer/SKU_1?$pdp$`), Zara (`/photo?ts=…`), imgix and Cloudinary
named transformations all address images with no file extension, and demanding
one threw those stores' galleries away — along with the primary photo their
structured data had handed us. Anything whose extension is positively *not* an
image (`.js`, `.css`, `.svg`, `.woff2`, …) is still rejected.

**Resolution.** Harvested URLs carry whatever size the page asked for
(`?width=300`, and the CDN dialects of it: `wid`/`hei` on Scene7, `sw`/`sh` on
Demandware, `imwidth` on Akamai), and CDNs serve renditions (`_1024x`,
`_600x600_crop_center`, `_grande`). `upgradeImageUrl()` strips both to fetch the
original — measured 34 KB → 642 KB on Allbirds. The query is edited as text rather than
through `URLSearchParams`, which re-serialises the whole thing and turns
Scene7's `?$pdp$` preset into a rendition that does not exist. The same
normalisation is the dedupe key, so one photo offered at three sizes is stored
once instead of three times.

> JS-rendered galleries are still invisible to a plain fetch. Use the extension,
> or enable **Render JS** with a provider in Fetch & Anti-bot.

## 3. Normalizer

`src/lib/server/parser/normalize.ts` maps the raw fields to a `ParsedProduct`,
reusing the **same** helpers as the CSV importer (`src/lib/server/product-fields.ts`):
price parsing (EU/US formats), currency, category & gender inference, color→hex.
Relative image URLs are resolved; results are deduped. On top of that:

- **Currency, when the page states none**, is inferred from the store's address
  or declared language and marked (`currencyBasis`, e.g. "the .ua address"), so
  the import note says why a price was read as hryvnia.
- **Subcategory** is resolved against the admin's category tree (from the name,
  then the breadcrumbs) and written only when the tree has such a label.
- **Style keywords** are inferred from the name, description, material,
  subcategory and breadcrumbs.

### Colour

Colour is the one field a product needs twice over: the catalogue prints the
store's own word for it, and the browse sidebar filters on `color_group_ids` —
database ids, not words. Both are filled on import, so a parsed product arrives
already under the right filter with the right swatch.

**Reading it.** Every source offers a candidate, tagged with where it came from:
a site recipe's regex → JSON-LD / `product:color` meta / microdata → the
extension's candidates (selected swatch, the label beside the swatch row, the
store's selected-variant data, loose text) → a "Colour:" spec row → the markup
itself (`data-color=`, `"color":"…"` in a hydration payload). `colour-choice.ts`
then drops what is never a colour (badges, prices, the product's own name,
"Default Title") and takes the first candidate from a place that states colours
and names one; failing that, the first from such a place at all; failing that,
the first anywhere that names a colour. What the page says is kept
**verbatim** — "Core Black" stays "Core Black".

When the page states no colour anywhere, the product title and then the URL's
last path segment are read for one, and the base colour is written as the label
("Black"). Both fallbacks are guarded by the vocabulary below, so "Nike Air
Force 1" contributes nothing.

**Filing it.** `canonicalColor()` reduces a colourway to one of twelve base
colours — "Core Black", "Noir", "Nero", "чёрный" all read as black — which then
gives the swatch hex and the `color_groups` row. The **last** colour word wins,
because a colourway puts its qualifier first: "Natural Black" is a black shoe.
A label naming two colours across a separator ("Black/White", "Blue and Green")
is filed under both groups *and* Multicolor, which is the group
`lib/color-groups.ts` treats as the only truthful single label for such a piece.
"Natural Black" is one colour, "Natural/Black" is two. When the label names no
base colour at all, the import falls back to the name's colour words and then to
the photo (§7).

A database that has not run the colour-filter migration still takes the product:
the write goes through `writeProductRow`, which drops the unknown column,
retries, and reports it as an unsaved column (§7).

---

## Site recipes — "Site Recipes" tab

Recipes match by hostname (the domain or any subdomain of it) and add
**extraction** overrides on top of the generic extractor — they carry no fetch
settings:

- **Brand / Category / Gender override** — e.g. tag every item from a
  single-brand store, or force a womenswear-only retailer.
- **Field regex overrides** (name, brand, price, currency, image, sizes, color,
  material, description) — for the rare field the generic strategies miss; the
  first capture group becomes the value (e.g. sizes:
  `class="size-list">([^<]+)<`).

Ships with enabled recipes for Farfetch, SSENSE and Mr Porter (which all parse
out-of-the-box via JSON-LD) plus a disabled single-brand template. Unsaved edits
survive switching tabs and are marked "Unsaved changes".

---

## 4. AI fallback — stores with no structured data

A brand's own store (Shopify, Webflow, bespoke) often ships **no** JSON-LD, no
product OpenGraph tags and no microdata. The deterministic pass returns a name at
best, and the product is not importable.

`src/lib/server/parser/ai-extract.ts` closes that gap using the **OpenAI key the
site already has** (`getOpenAIKey()` — env `OPENAI_API_KEY`, else the `settings`
table, same as embeddings and the stylist).

- **When it runs.** `auto` (default) spends a call only when the deterministic
  pass is missing name, price *or* images — so Farfetch/SSENSE stay free.
  `always` runs it on every page. Both switchable in **Fetch & Anti-bot → AI &
  images**; the Collect catalog tab can switch AI off for one run.
- **What it gets.** `condenseHtml()` strips scripts, styles, SVG and data-URIs
  first — that is the bulk of a retail page and none of the facts. Typical
  reduction is large enough to keep a page inside one cheap `gpt-4o-mini` call.
- **Structured data always wins.** `mergeAiIntoRaw()` fills **only empty**
  fields. A real JSON-LD price is never overwritten by a model's reading.
- **No invented photos.** Any image URL the model returns must literally occur
  in the page HTML or it is dropped — a hallucinated photo would otherwise stay
  invisible until the catalog rendered a broken card.
- **Photos are the one field it may add to.** Everywhere else AI fills only
  empty fields; below two photos it also appends what it found behind whatever
  the deterministic pass got, because "one photo" is the same failure as "no
  photos" for a catalog. A page that already yielded a gallery is never diluted,
  and the primary photo never moves. This is also why `auto` counts a
  single-photo page as thin enough to be worth a call.
- **Degrades, never breaks.** No key, a malformed reply or an API error leaves
  the deterministic result untouched and reports the reason in diagnostics.

Products touched by AI carry an `ai` entry in `strategies`, and the admin screen
shows exactly which fields the model supplied.

---

## 5. Collecting a whole catalog — "Collect catalog" tab

Paste one URL — a category page, a brand's listing, or a single product — and the
screen fills the catalog on its own, fetching from **our server**:

```
discover ─▶ product URLs (incl. pagination) ─▶ batch(5) ─▶ parse ─▶ AI ─▶ mirror photos ─▶ import
```

- **discover** (`crawl.ts`) tries the store's own data first (`storefront.ts`:
  Shopify, WooCommerce or Squarespace), otherwise walks the listing, following
  `rel="next"` and page-numbered anchors up to the page cap, and tops the result
  up from the sitemap whenever the walk came back short of the limit — refused,
  empty or merely partial (see §1a). A pasted PDP is detected and collected on
  its own, and never answered with the whole store. Discovery has a 45-second
  wall-clock budget.
- **how many.** The ceiling is 2 000 products and 20 listing pages per run (the
  screen defaults to 100 over 3 listing pages), and a single listing page may
  yield its whole grid rather than the first 60 anchors. Reading 2 000 URLs out
  of a sitemap costs the same handful of requests as reading 500; what a long run
  does cost is the browser tab staying open, since the batch loop lives there.
- **batch** parses and imports 5 URLs per request. The loop lives in the browser,
  so progress is live, **Stop** takes effect before the next batch, and each
  request stays short (see "Time limits").
- Re-running the same URL **updates** existing products (dedupe by `source_url`)
  rather than duplicating them, so a collection run is safe to repeat (§7 says
  what an update keeps).

Per-product outcomes (`new` / `updated` / `skipped` / `failed`, with the reason
and whether AI was needed) stream into the screen as they land; an
unsaved-columns warning is shown once. Each batch that imported or updated
something writes a `parser.crawl_batch` entry to the admin action log.

**A store that refuses us** here gets two buttons under the error:
**Collect with the extension** (§1c) and **Paste page instead** (§1b).

### Which anchors count as products

`extractProductLinks` takes schema.org `ItemList` urls as authoritative, then
falls back to same-host anchors. Stores address products in three shapes, so a
path qualifies on any one of them (and is rejected outright if a segment is a
known non-product route — `cart`, `help`, `blog`, `size-guide`, …):

| Shape | Example | Store |
|---|---|---|
| An explicit product segment | `/en-us/women/product/gucci/loafer/1234567` | SSENSE, Shopify, ASOS (`/prd/`) |
| A short segment plus a product code | `/fr/t/chaussure-air-force-1-BpVzMs/CW2288-111` | Nike |
| A code as the last segment, no marker | `/fr/fr/veste-oversize-p04387400.html` | Zara, Adidas, Mytheresa, H&M |

A "product code" is a run of 5+ digits, or a 1–3 letter prefix on 4+ digits
(`EG4958`). Matching on the code — not just on a path keyword — is what makes
the crawler work on brand stores, which rarely use `/product/` in their URLs.
The extension's planner (`plan-collection.ts`) uses the same tests.

### When a listing comes back empty

An empty crawl has three different causes with three different fixes, so
`crawl.ts` reports what the page actually was rather than one blanket guess:

| What came back | Hint |
|---|---|
| An anti-bot interstitial (Akamai/Cloudflare/DataDome, often a `200`) | The extension first; a paid provider (or, in provider mode, a stronger one) second |
| A near-empty shell with almost no links | The grid is built in the browser. In `direct`: the extension, then a provider with Render JS. With a provider: turn on Render JS; if it is already on, the extension or a stronger provider |
| A full page whose links don't look like products | Paste a single product URL |

A refusal (`401`/`403`/`429`) is reported by what was tried *besides* the page,
because the three cases have three different owners:

| Situation | Hint |
|---|---|
| The pasted URL was a single product page | There is no listing or sitemap to read instead — but one product needs no provider: "Paste page instead" (§1b). For a catalogue: the extension, then a provider |
| The sitemap was refused too | Page, sitemap and every storefront JSON API gave nothing: the extension, then a provider; a single piece can be pasted |
| The sitemap was readable but held no product-shaped URLs | Names the count and says the product-path test needs teaching this store's URL shape — **our** fix, not a provider bill; meanwhile the extension or the paste panel |

The advice is mode-aware: **Render JS is only ever forwarded to a scraping
provider**, and an impersonation profile never reaches ScrapingBee/ScraperAPI/
ZenRows, so the hints never point at a setting that cannot help.

---

## 6. Photos live on our storage

Catalog rows must not hotlink retailer CDNs: those URLs rot, and Farfetch already
answers `429` to our image optimiser. On import,
`src/lib/server/storage/product-images.ts` downloads every photo with browser
headers and a per-site `Referer` — which also defeats hotlink protection — and
re-uploads it to the public `product-images` bucket.

- Up to 20 photos per product, 3 downloads in parallel, 20 MB per file; a photo
  already on our storage is skipped.
- Every download passes the internal-address check (see Security), and
  redirects are followed by hand so that every hop passes it too (at most 5
  hops). Our own Supabase origin is let through first, since in local
  development it lives on `localhost`.
- A download that fails **keeps its original URL** instead of vanishing, so a
  rejected mirror degrades to a hotlink rather than a blank card.
- The same primitives serve the admin's upload-by-URL (`/api/admin/upload-image`),
  backdrop sampling (`bg-color.ts`) and card export (`card-export.ts`).

Toggle: **Fetch & Anti-bot → AI & images → Copy product photos…** (default on;
the Collect catalog tab can switch it off for one run).

---

## 7. Importing

The **Parse URL** tab fetches → extracts → shows an **editable preview** (every
field, image picker, diagnostics: HTTP status, HTML size, provider or `pasted`,
matched recipe, which strategies hit, which fields AI supplied). **Import
product** writes one product through `POST /api/admin/parser/import`, deduped by
`source_url` (re-importing the same URL updates in place), shows the
unsaved-columns warning if there is one, and writes a `parser.product_imported`
entry to the admin action log.

### Listing / category pages

Paste a category or search URL and the parser pulls **every** product it can:

- If the page embeds product data (a schema.org `ItemList`, or multiple
  `Product` nodes), each card becomes a row in a **selectable grid** — tweak
  category/gender/name inline, then **bulk-import** the selected ones.
- If the page only has links, the parser lists the discovered product URLs and
  **"Parse first N"** (at most 24) fetches each individually (using the same
  fetch provider), reports how many failed, then drops the rest into the same
  grid.

Photo resolution is handled during extraction (§2, `upgradeImageUrl()`).
`upscaleImageUrl()` in `src/lib/image.ts` is a display-time helper for
`ProductImage`, not part of the import.

### What an import writes — `importParsedProduct`

One function (`src/lib/server/parser/import-product.ts`) writes every product
that comes in: Parse URL (`/parser/import`), Collect catalog (`/parser/crawl`),
the extension (`/parser/collect`) and the CSV import (`/api/admin/csv-import`).
In order:

1. **Checks.** A name is required; a category outside the 15 known ones becomes
   `accessories`; the gender is kept only if it is one of women / men / unisex.
2. **Price in dollars.** A non-USD price is converted with `toUsd` (`fx.ts`).
   The store's own price and currency stay on its retailer entry and in
   `source_price` / `source_currency` / `fx_rate` / `fx_date`; `price_min_usd` /
   `price_max_usd` are set for the search RPCs. A currency with no rate is kept
   as stated; a page that stated no currency is taken as dollars — both are said
   in the price note.
3. **Refresh path** (CSV only, see the table below) — decided here, before any
   photo is downloaded.
4. **Photos** are mirrored (§6) when the toggle is on.
5. **Brand and store.** A brand is taken off the product name when the page gave
   none or gave the shop's own name (`brand-from-name.ts`, matched only against
   the Brands list and brands already in the catalogue). The store's name and
   "official" flag come from the admin's domain rules (`retailer-domains.ts`),
   else from the link.
6. **Colour filter** (`color_group_ids`): from the colour label, else the name's
   colour words, else the photo (a studio shot only, `bg-color.ts`).
7. **Gender and style**, when the page said nothing: the store's default gender
   rule, then the brand's and the store's habit in the catalogue
   (`catalogue-profile.ts`); style tags are proposed from the page's words and the
   brand's history.
8. **Write.**
   - A row with this `source_url` exists → it is updated (see the table).
   - None → is this the same item another store already sold us? By GTIN, or
     brand + MPN; otherwise by brand + the same piece name + the same colour at a
     price within ×3 (`same-item.ts`, `piece-name.ts`). If so, the page **joins**
     that product: a new retailer entry, and only empty fields filled
     (`merged`).
   - Otherwise a new row is inserted.
9. **After the write** (an insert or an update — not after a merge, and not on
   the refresh path): the photo backdrop colour is sampled (`bg_color`), and
   the row is grouped with its other colourways (`variant_group_id`) — by the
   sibling URLs the page or feed named, else by brand + the same piece name in a
   different colour (`variant-group.ts`).

#### Re-import: `replace` vs `refresh`

| | `replace` — default: Parse URL, Collect catalog, extension | `refresh` — CSV import (`onExisting: "refresh"`) |
|---|---|---|
| Written on the existing row | The whole row from the page: name, brand, category, subcategory (when read), description, photos, colours, colour filter, sizes, material, price and currency columns, codes (when read), this store's retailer entry; `is_new` is set to true again | Only what a feed is the authority on: `price_min` / `price_max` (+ `_usd`), `currency`, `source_price` / `source_currency` / `fx_rate` / `fx_date` (non-USD feeds), `retailers` (the feed's stores), `sizes` (only when the feed has any) |
| Kept as it was | `style_keywords` and `gender` when the row already has them; other stores' retailer entries (when the price is in dollars, the range is recomputed over all stores); `crop_data`. Redone after the write rather than kept: `bg_color` (re-sampled) and `variant_group_id` (re-linked when siblings are found) | Everything else: name, brand, category, subcategory, description, material, photos (none are downloaded), colours and colour filter, gender, style tags, codes, grouping, backdrop colour; other stores' retailer entries (range recomputed as on the left) |
| No row with that `source_url` | Insert, or join the same item from another store | Same as `replace` — a full import |

#### Unsaved columns — `droppedColumnsWarning`

`writeProductRow` drops a column the database does not have (a migration not
run), retries, and returns the dropped names. The product **is** saved; the
caller shows one warning naming the columns and the migration that adds each:

| Column | Migration |
|---|---|
| `subcategory` | `010_product_subcategory.sql` |
| `bg_color` | `015_product_bg_color.sql` |
| `price_min_usd`, `price_max_usd` | `019_product_price_usd.sql` |
| `source_price`, `source_currency`, `fx_rate`, `fx_date` | `019_product_source_price.sql` |
| `gtin`, `mpn`, `sku` | `020_product_codes.sql` |
| `color_group_ids` | `021_color_groups.sql` |
| `crop_data` | `023_product_crop_data.sql` |
| anything else (`color_images`, the variant columns) | "add as in `supabase-schema.sql`" |

The warning is shown by the Parse URL editor and grid, the Collect catalog tab,
the extension's collect tab and the CSV import screen.

### CSV import (`/goo-studio/import`)

Formerly `/goo-studio/brightdata` (a permanent redirect remains in
`next.config.ts`). The feed is parsed, mapped and grouped in the browser
(`src/lib/csv-import.ts`); the server only answers and writes:

- `POST /api/admin/csv-import` — which of these links (≤200 per request) are
  already a product's `source_url`, so the preview can say how many will be
  created and how many updated.
- `PUT /api/admin/csv-import` — a batch of up to 25 grouped products. Each group
  becomes one `importParsedProduct` call with `onExisting: "refresh"`, its
  retailer entries resolved per store (domain rule, else the feed's merchant
  column, else the link's host; the lowest in-stock price per store) and the
  sibling colours' links as `variantUrls`. A group sold out everywhere is
  skipped unless it already exists (then it is refreshed). One `import.csv`
  entry per batch goes to the admin action log.

Batches are sent one after another with progress and **Stop**; photos follow the
same "Copy product photos" setting.

---

## Storage & schema

Config lives in the `settings` key/value table (migration `024_settings.sql`):

| key | value |
|---|---|
| `parser_fetch_settings` | JSON `ParserFetchSettings` (provider, endpoint, renderJs, impersonate, timeoutMs) |
| `parser_fetch_key` | provider API key (secret) |
| `parser_site_configs` | JSON `ParserSiteConfig[]` |
| `parser_ai_settings` | JSON `ParserAiSettings` (AI on/off, mode, image mirroring) |

Imports key on `products.source_url` (unique where not null) from migration
`004_import_tables.sql`. That migration also creates `import_jobs`; nothing
writes to it any more. The optional product columns are listed under "Unsaved
columns" above. Mirrored photos go to the public `product-images` Storage bucket,
created on first use.

## Time limits

The routes declare `maxDuration` — 60 s for parse, crawl, collect and import,
300 s for the CSV import. That value is read by Vercel; a self-hosted `next start`
does not enforce it, so on the Coolify server a long request is cut only by the
reverse proxy's timeout, if one is set (confirm with the CEO). What keeps every
request short is the design itself: 5 URLs per crawl batch, one page per ingest,
25 groups per CSV batch, the 12-second storefront cap and the 45-second discovery
budget.

---

## Files

```
src/lib/server/product-fields.ts            ← shared field normalisers (CSV + URL)
src/lib/server/storage/product-images.ts    ← download + mirror photos to our bucket
src/lib/server/parser/
├── types.ts                                ← config, PageEvidence, result types
├── configs.ts                              ← settings-backed config + site match
├── fetch.ts                                ← pluggable fetcher, cookie jar, retries, internal-address guard
├── storefront.ts                           ← one door: try each platform's JSON before any page
├── store-json.ts                           ← shared probe, budget, per-host platform memory
├── shopify.ts                              ← Shopify storefront JSON: whole gallery, no HTML
├── woocommerce.ts                          ← WooCommerce Store API (no key, no JSON-LD needed)
├── squarespace.ts                          ← Squarespace `?format=json` (payload says product vs listing)
├── sitemap.ts                              ← product URLs from the store's sitemaps
├── robots.ts                               ← robots.txt: Allow/Disallow, Crawl-delay, Sitemap (`*` group)
├── extract.ts                              ← JSON-LD / OG / microdata / recipe / page evidence
├── gallery.ts                              ← gallery harvesting + original-resolution URLs
├── colour-choice.ts                        ← which of the page's strings is the colour
├── ai-extract.ts                           ← AI fallback (condense → model → merge)
├── normalize.ts                            ← raw → ParsedProduct
├── parse-page.ts                           ← one URL (or pasted/collected HTML) → products; refusal hints
├── crawl.ts                                ← server-side listing walk + pagination + sitemap top-up
├── plan-collection.ts                      ← extension runs: what to open next (pure, no network)
├── import-product.ts                       ← importParsedProduct: one product → catalogue row
├── brand-from-name.ts                      ← brand read off the product name
├── piece-name.ts                           ← name reduced to the piece, for grouping and merging
├── variant-group.ts                        ← same piece, other colour → one variant group
└── same-item.ts                            ← same item, other store → one product, two retailers
src/app/api/admin/parser/
├── config/route.ts                         ← GET/POST fetch settings, key, recipes, AI
├── parse/route.ts                          ← POST { url, html? } → preview (no write)
├── crawl/route.ts                          ← POST discover | batch → server-side collect
├── collect/route.ts                        ← POST plan | ingest → extension collect (never fetches the store)
└── import/route.ts                         ← POST { product, sourceUrl } → write one product
src/app/api/admin/csv-import/route.ts       ← POST known links | PUT a batch of feed groups
src/lib/csv-import.ts                       ← CSV parsing, mapping, grouping (runs in the browser)
src/lib/parser-bookmarklet.ts               ← bookmarklet + clipboard reader (paste page)
src/app/goo-studio/parser/page.tsx          ← admin screen (4 tabs)
src/app/goo-studio/parser/collect/page.tsx  ← extension receiver: session bridge, progress, Stop
src/app/goo-studio/import/page.tsx          ← CSV import screen
extension/                                  ← Goo Collect, the Chrome extension (extension/README.md)
```

## Security

All parser routes and the CSV import route are gated by `requireAdmin` (401
otherwise); the `/goo-studio` pages themselves are gated in `src/proxy.ts`
(signed in, and listed in `ADMIN_USER_IDS` or `isAdmin` in Clerk metadata). The
provider API key is never returned raw to the browser — only a masked form; the
OpenAI key is only ever reported as configured/not configured.

**Internal addresses.** `validateTargetUrl()` in `fetch.ts` accepts only
`http(s)` and, in `direct` mode, refuses any host `isBlockedDirectHost()` calls
internal. The name is normalised first — brackets off an IPv6 literal, trailing
dots removed (`localhost.`), lower-cased, an IPv6 zone id (`%eth0`) ignored —
because one internal address has many spellings:

| Form | Refused |
|---|---|
| Names | `localhost`, `*.localhost`, `ip6-localhost`, `ip6-loopback`, `*.localdomain`, `*.internal`, `*.local`, `*.home.arpa`, and any name without a dot (`kong`, `supabase-db` — a machine on our own network) |
| IPv4 in any `inet_aton` spelling (`127.0.0.1`, `127.1`, `2130706433`, `0x7f.1`, `0177.0.0.1`) | `0/8`, `10/8`, `127/8`, `100.64/10` (carrier-grade NAT), `169.254/16` (link-local, cloud metadata), `172.16/12`, `192.168/16`, `224/4` and above; an all-numeric name that is no valid address |
| IPv6 | `::`, `::1`, IPv4-compatible `::a.b.c.d`; IPv4-mapped `::ffff:a.b.c.d` and IPv4-translated `::ffff:0:a.b.c.d`, NAT64 `64:ff9b::/96` and 6to4 `2002::/16` — judged by the IPv4 address inside; `fc00::/7` (unique-local), `fe80::/10` (link-local), `fec0::/10` (site-local), `ff00::/8` (multicast); a literal that does not parse |

The same check guards every download through `fetchImageBuffer` (the photo
mirror, backdrop sampling, card export — on every redirect hop), the admin's
upload-by-URL and the outfit generator's reference images. Provider modes are
not checked — the provider fetches from its own network, not ours.

Known limits: DNS is not resolved, so a public name that points at a private
address passes; and `fetchHtml` / `fetchBinary` let `fetch` follow redirects
(`redirect: "follow"`) without re-checking where they lead — only the photo
mirror follows redirects by hand.

Note on `finalUrl`: only a `direct` fetch reports a meaningful final URL. In
provider mode the response URL belongs to the **scraping service**, so
`fetch.ts` keeps the target URL — otherwise every relative link and image would
resolve against the provider's domain.
