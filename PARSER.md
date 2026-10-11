# Universal Product Parser

Products come into the catalog from **any** store (Farfetch, SSENSE, Mr Porter, a
brand's own site) through **Goo Collect**, the Chrome extension: it opens the
store's pages in the admin's own browser and hands the rendered pages to our
server, which reads and imports them — one product or a whole catalogue. The
import step at the end is shared with the CSV feed importer.

Admin screen: **Goo Studio → Imports → Parser** (`/goo-studio/parser`): the
**Collect with the extension** button, which opens the receiver
`/goo-studio/parser/collect` (no menu item of its own — see §1), and two
settings tabs, **Site recipes** and **AI & images**.

> **Extension only (CEO decision, 2026-10-11).** Everything in the parser that
> was not part of the extension was removed: the server-side catalogue collect
> (Collect catalog tab), Parse URL with its listing grid, Paste page (the
> bookmarklet), the pluggable fetch layer with its scraping providers and API key
> (Fetch & anti-bot tab), and the probes our server made on its own — the
> Shopify / WooCommerce / Squarespace JSON endpoints, sitemaps, cookies and
> retries. Our server no longer opens a store's pages at all. The `settings` rows
> `parser_fetch_settings` and `parser_fetch_key` and the `PARSER_FETCH_API_KEY`
> env var are no longer read; old action-log entries `parser.crawl_batch` and
> `parser.product_imported` stay as history.

### Which way in

| Situation | Use |
|---|---|
| Products from a store — one or a whole catalogue | **The extension** (§1) |
| An affiliate feed (CSV) | **Imports → Import** (`/goo-studio/import`), same import step (§6) |

---

## Why this design

Luxury and brand stores sit behind anti-bot (Cloudflare / Akamai / DataDome),
which reads the TLS handshake and the requester's address, and a request from a
server fails it. An admin opening the same page in their own browser passes the
check by being a person on a residential connection — so the cheapest fetcher of
all is the admin's own browser. The extension drives it: real background tabs,
the admin's cookies, and the rendered DOM, in which a gallery that lazy-loads on
scroll is plain `<img src>`. Extraction and normalisation stay in TypeScript, on
our server, and are universal (no per-site code required for most stores).

```
store page (admin's Chrome) ─▶ snapshot.js: strip + page evidence ─▶ collect tab ─▶ POST /api/admin/parser/collect
   ─▶ universal extractor ─▶ store JSON ─▶ AI fallback ─▶ normalizer ─▶ importParsedProduct
      (JSON-LD/OG/microdata)  (Shopify)                                  (shared with CSV import)
```

---

## 1. Collecting with the browser extension

**Goo Collect** (`extension/`, a Chrome extension; its version is in
`manifest.json`) opens the store's pages in real background tabs on the admin's
machine — their address, their cookies, the check their browser already passed —
and hands the rendered DOM to the pipeline below. Install and day-to-day use:
[`extension/README.md`](extension/README.md).

**Where it is in the admin:** Parser → **Collect with the extension**. It opens
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
photos: all of them when photo copying is on (§5), and the main one to measure
its backdrop (and the garment's colour, when the page named none) — from our
copy, or from the store's CDN when copying is off:

| Action | In | Out |
|---|---|---|
| `plan` | start URL; the first page's rendered HTML (first round only); robots.txt text; sitemap documents the worker already fetched (≤12 per call, ≤5 MB each); URLs already seen (≤5 000); how many are still wanted (≤2 000) | product URLs — same host, deduped, robots-allowed, sitemap entries before page anchors; `delayMs` = the store's Crawl-delay, never under 1.5 s; up to 8 sitemap documents to fetch next round; a robots.txt summary for the screen |
| `ingest` | URL; stripped HTML (required, ≤3 MB — without it the route answers 400); the store's own product JSON when it is a Shopify store (≤400 KB, §1, "Shopify JSON"); **page evidence**: image URLs (≤300), rendered price text, size labels (≤60), colour candidates with their origin (≤30), sibling-colour URLs (≤20), rendered description (≤5 000 chars), spec rows (≤40), breadcrumbs (≤12), brand text; the run's last 12 page titles | one outcome row: new / updated / skipped / failed, with notes |

Page evidence is what the rendered page said that the stripped markup no longer
does (hydration payloads, the price as a shopper reads it, the size buttons, the
selected swatch). It enters the extractor at the lowest precedence (§2): photos
still pass the gallery harvester's identity tests, colours go through
`colour-choice.ts`, sizes through `pickSizes`. The page titles let the server
work out the tail the store appends to every title (`commonTitleSuffix`) and cut
it off product names. Site recipes apply; the AI and photo-copy settings come
from **Parser → AI & images** (the extension sends no overrides).

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
shown once above the rows (§6). Every imported or updated product writes a
`parser.collect_ingest` entry to the admin action log.

**Address limit.** `bridge.js` is injected only on the addresses listed in
`extension/manifest.json` → `content_scripts.matches`: `localhost`, `127.0.0.1`,
`goo-fashion.com` and `www.goo-fashion.com`, path `/goo-studio/parser/collect*`.
If Goo Studio is served from any other host, the extension cannot reach it until
that host is added there. Which host production answers on — confirm with the
CEO.

### Which anchors count as products

`plan` reads the page the extension sent with `extractProductLinks`, which takes schema.org `ItemList` urls as authoritative, then
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
the planner work on brand stores, which rarely use `/product/` in their URLs.

### Sitemaps

A sitemap is the shop telling search engines what it sells — the one listing
meant to be read by a machine, and one a defended store still serves, because
blocking it would cost the shop its Google traffic. The worker fetches
robots.txt and the sitemap documents in the admin's browser; `plan` reads them
(`sitemap.ts`, `plan-collection.ts`) and names the next ones worth fetching:
robots.txt's declared sitemaps first, then the conventional locations
(`/sitemap.xml`, `/sitemap_index.xml`, `/sitemap_products_1.xml` for Shopify,
`/product-sitemap.xml` for Yoast / WooCommerce, `/wp-sitemap.xml`,
`/sitemap/sitemap-index.xml` for Magento 2, `/sitemap1.xml`). An index is
followed down, product sitemaps first. `<loc>` is read bare and wrapped in
`CDATA`, which WordPress and Magento both ship.

**A product sitemap is the store's own word.** A file the shop named
`product-sitemap.xml` is the shop declaring what is inside, and that outranks
our reading of a URL's shape — so its entries skip the product-path test and
only the flat refusals still apply (a `/cart` listed in a product sitemap is
still not a product).

### Shopify JSON

Every Shopify storefront answers `/products/<handle>.json` with the product in
full: **every** photo in `images[]`, every variant with its price and compare-at
price, and the colour and size options as data. On a Shopify store the
extension fetches it from the page's own origin (with the currency from
`/meta.json`) and sends it with the page; `shopify.ts` checks its shape and
merges it into what the page said. The JSON wins where it states something: the
name, the brand, the price in the store's own currency, every photo, the sizes
and the colour option. The page keeps what the JSON has no field for: the
breadcrumbs, the spec rows, the material, a description the theme rendered in
full. Without the currency the page's own price and currency stay, because a
wrong currency is a wrong price tag.

---

## 2. Universal extractor

`src/lib/server/parser/extract.ts` reads structured data from the page's HTML, highest
precedence first:

1. **Per-site recipe regex** (admin overrides) →
2. **JSON-LD** `schema.org/Product` (name, brand, `image[]`, `offers`, color,
   material, description, GTIN/MPN/SKU, `BreadcrumbList`) — Farfetch and most
   luxury retailers ship this →
3. **OpenGraph / product / twitter** meta tags (the page's `<h1>` sits between
   JSON-LD and OpenGraph for the name) →
4. **Microdata** (`itemprop=…`) →
5. **Page evidence** from the extension (§1) — fills what the structured
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

## 3. Normalizer

`src/lib/server/parser/normalize.ts` maps the raw fields to a `ParsedProduct`,
reusing the **same** helpers as the CSV importer (`src/lib/server/product-fields.ts`):
price parsing (EU/US formats), currency, category & gender inference, color→hex.
Relative image URLs are resolved; results are deduped. On top of that:

- **Currency, when the page states none**, is inferred from the store's address
  or declared language and marked (`currencyBasis`, e.g. "the .ua address"), so
  the import note says why a price was read as hryvnia.
- **Subcategory** is resolved against the admin's category tree (from the name,
  then the spec table's "Type" / "Тип" / "Вид взуття" row, then the
  breadcrumbs) and written only when the tree has such a label. When none of
  them says which kind — a shoe named for its model ("Etnies Josl1n") and filed
  under "Shoes" — the page's address and then its description are read for a
  label **of the category already decided** (`garmentLabelIn`): "skate shoe" in
  the description files it under Sneakers, while "wear them with jeans" changes
  nothing. The spec row also decides the category when the name does not.
- **Style keywords** are inferred from the name, description, material,
  subcategory and breadcrumbs: the words that name one of the five styles
  (casual, minimal, classic, streetwear, sporty) and the words that say what the
  piece is for ("for the office" classic, "hiking" sporty, "for walks" casual).

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
the photo (§6).

A database that has not run the colour-filter migration still takes the product:
the write goes through `writeProductRow`, which drops the unknown column,
retries, and reports it as an unsaved column (§6).

---

## Site recipes — "Site recipes" tab

Recipes match by hostname (the domain or any subdomain of it) and add
**extraction** overrides on top of the generic extractor, on every page the
extension imports:

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
  `always` runs it on every page. Both switchable in **Parser → AI & images**.
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

## 5. Photos live on our storage

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

Toggle: **Parser → AI & images → Copy product photos…** (default on).

---

## 6. Importing

**What the import says.** Each outcome row on the collect tab names what
happened — a new card, an updated one, or *added as a store to an existing
product* (the page was another store's listing of a card we had) — and under it
the colours it was grouped with, why it got a card of its own rather than
joining one, and what the price became.

Photo resolution is handled during extraction (§2, `upgradeImageUrl()`).
`upscaleImageUrl()` in `src/lib/image.ts` is a display-time helper for
`ProductImage`, not part of the import.

### What an import writes — `importParsedProduct`

One function (`src/lib/server/parser/import-product.ts`) writes every product
that comes in: the extension (`/parser/collect`) and the CSV import
(`/api/admin/csv-import`).
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
4. **Photos** are mirrored (§5) when the toggle is on.
5. **Brand and store.** A brand is taken off the product name when the page gave
   none or gave the shop's own name (`brand-from-name.ts`, matched only against
   the Brands list and brands already in the catalogue). The store's name and
   "official" flag come from the admin's domain rules (`retailer-domains.ts`),
   else from the link. A brand the Brands list does not have under any spelling
   ("Levi's" = "LEVIS") is **added to it** once the card is written (an insert
   or an update — not a merge or a links-only page), and the run's row says
   "added to Brands". Not added: a value that names no brand ("Unknown"), and
   the store's own name where a domain rule says the store is not the brand's
   own shop.
6. **Colour filter** (`color_group_ids`): from the colour label, else the name's
   colour words, else the photo (a studio shot only, `bg-color.ts`).
7. **Gender and style**, when the page said nothing: the store's default gender
   rule, then the brand's and the store's habit in the catalogue
   (`catalogue-profile.ts`). Style: the description leads, the brand fills in —
   two styles or more from the words are the answer, one gets the brand's style
   beside it, none leaves the brand's alone. The brand's style comes from the
   built-in list (`taxonomy/brand-styles.ts`: Adidas sporty, Gucci classic),
   else from how the editor tags that brand, else — for a new brand — from the
   store's habit.
8. **Write.**
   - A row with this `source_url` exists → it is updated (see the table).
   - None → is this the same item another store already sold us? By GTIN, or
     brand + MPN; otherwise by the same maker (any spelling of the brand) + the
     same piece name + the same colour, **at any price** (`same-item.ts`,
     `piece-name.ts`): one item sells at several prices — a sale, a resale
     platform — and a price test split it into two cards. Only a match where
     one side names no brand must also be priced within ×4. If so, the page
     **joins** that product: a new retailer entry, the price range widened, and
     only empty fields filled (`merged`).
   - Otherwise a new row is inserted.
9. **After the write** (an insert or an update — not after a merge, and not on
   the refresh path): the photo backdrop colour is sampled (`bg_color`), and
   the row is grouped with its other colourways (`variant_group_id`) — by the
   sibling URLs the page or feed named (every spelling of each address), and,
   on every import, by the same maker + the same piece name **in any colour**
   (`isSamePieceByName` in `variant-group.ts`). The colour used to have to
   differ, so two colourways whose pages state no colour — both read off their
   photos as "White" — and a listing the merge refused on price stayed as cards
   of their own beside their model. The maker is matched under any spelling the
   stores use ("adidas" / "adidas Originals", "Carhartt" / "Carhartt WIP",
   Jordan / Nike, a card saved without a brand whose name carries it), the
   cards are read the same way the same-item search reads them, and the price
   never enters it — one colourway often costs more than another. Every colour
   group the found cards already sit in is folded into one, keeping the lead
   card of the group that has one (`planColourGroup`, written by
   `lib/server/colour-group.ts`), so a piece collected from two stores ends up
   as one card with all its colours. Cards imported before this can be grouped
   from **Duplicates → One model's colours shown as separate cards**.

#### Re-import: `replace` vs `refresh`

| | `replace` — default: the extension | `refresh` — CSV import (`onExisting: "refresh"`) |
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

The warning is shown by the extension's collect tab and the CSV import screen.

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

### After the import: the AI check

Both routes above (`collect`, `csv-import`) end with
`after(() => checkPendingProducts(...))`. Once the answer has gone, a cheap OpenAI
model reads the imported record whole — next to the catalogue's brand spellings
and category tree — and fixes what contradicts it: the store's name stored as the
brand, a size or a file name stored as the colour, a price block stored as the
material, a hoodie filed under Sneakers. The model never writes to the database:
the server writes only what the record itself backs, journals every change and
can undo it. Admin screen: **Goo Studio → AI check** (`/goo-studio/catalogue-check`);
design and safeguards in `AI_ARCHITECTURE.md` §8.1. Needs migration
`025_catalogue_check.sql`; until it runs, nothing happens.

---

## Storage & schema

Config lives in the `settings` key/value table (migration `024_settings.sql`):

| key | value |
|---|---|
| `parser_site_configs` | JSON `ParserSiteConfig[]` |
| `parser_ai_settings` | JSON `ParserAiSettings` (AI on/off, mode, image mirroring) |

`parser_fetch_settings` and `parser_fetch_key` may still sit in the table from
before 2026-10-11; nothing reads them, and they can be deleted.

Imports key on `products.source_url` (unique where not null) from migration
`004_import_tables.sql`. That migration also creates `import_jobs`; nothing
writes to it any more. The optional product columns are listed under "Unsaved
columns" above. Mirrored photos go to the public `product-images` Storage bucket,
created on first use.

## Time limits

The routes declare `maxDuration` — 60 s for collect, 300 s for the CSV import.
That value is read by Vercel; a self-hosted `next start` does not enforce it, so
on the Coolify server a long request is cut only by the reverse proxy's timeout,
if one is set (confirm with the CEO). What keeps every request short is the
design itself: one page per ingest (fetching nothing from the store), a pure
`plan`, and 25 groups per CSV batch.

---

## Files

```
src/lib/server/product-fields.ts            ← shared field normalisers (CSV + extension)
src/lib/server/colour-group.ts              ← writes a colour group, folding the groups its cards were in
src/lib/server/duplicates.ts                ← catalogue-wide finders: duplicates, mixed groups, ungrouped colours
src/lib/url.ts                              ← pastedUrl: the address in pasted text, click tracking off (product form)
src/lib/server/storage/product-images.ts    ← download + mirror photos to our bucket
src/lib/server/parser/
├── types.ts                                ← recipes, AI settings, PageEvidence, result types
├── configs.ts                              ← settings-backed config + site match
├── fetch.ts                                ← internal-address guard for every server-side download
├── shopify.ts                              ← Shopify product JSON the extension sent → merged into the page
├── sitemap.ts                              ← reading sitemap documents the extension fetched
├── robots.ts                               ← robots.txt: Allow/Disallow, Crawl-delay, Sitemap (`*` group)
├── extract.ts                              ← JSON-LD / OG / microdata / recipe / page evidence
├── gallery.ts                              ← gallery harvesting + original-resolution URLs
├── colour-choice.ts                        ← which of the page's strings is the colour
├── ai-extract.ts                           ← AI fallback (condense → model → merge)
├── normalize.ts                            ← raw → ParsedProduct
├── page-guards.ts                          ← a bot check or a category page shown in the product's place
├── parse-page.ts                           ← one collected page → one product
├── plan-collection.ts                      ← extension runs: what to open next (pure, no network)
├── catalogue-match.ts                      ← links-only runs: which store pages name our cards
├── import-product.ts                       ← importParsedProduct: one product → catalogue row
├── brand-from-name.ts                      ← brand read off the product name
├── piece-name.ts                           ← name reduced to the piece, for grouping and merging
├── variant-group.ts                        ← same piece, other colour → one variant group (and its write plan)
└── same-item.ts                            ← same item, other store → one product, two retailers
src/app/api/admin/parser/
├── config/route.ts                         ← GET/POST site recipes, AI & images
└── collect/route.ts                        ← POST plan | ingest → extension collect (never fetches the store)
src/app/api/admin/csv-import/route.ts       ← POST known links | PUT a batch of feed groups
src/lib/csv-import.ts                       ← CSV parsing, mapping, grouping (runs in the browser)
src/app/goo-studio/parser/page.tsx          ← admin screen: the way to the extension, Site recipes, AI & images
src/app/goo-studio/parser/collect/page.tsx  ← extension receiver: session bridge, progress, Stop
src/app/goo-studio/import/page.tsx          ← CSV import screen
extension/                                  ← Goo Collect, the Chrome extension (extension/README.md)
```

## Security

All parser routes and the CSV import route are gated by `requireAdmin` (401
otherwise); the `/goo-studio` pages themselves are gated in `src/proxy.ts`
(signed in, and listed in `ADMIN_USER_IDS` or `isAdmin` in Clerk metadata). The
OpenAI key is only ever reported as configured/not configured.

**Internal addresses.** The parser no longer fetches store pages, but our
server still downloads photos and pictures by address. `validateTargetUrl()` in
`fetch.ts` accepts only `http(s)` and refuses any host `isBlockedDirectHost()`
calls internal. The name is normalised first — brackets off an IPv6 literal, trailing
dots removed (`localhost.`), lower-cased, an IPv6 zone id (`%eth0`) ignored —
because one internal address has many spellings:

| Form | Refused |
|---|---|
| Names | `localhost`, `*.localhost`, `ip6-localhost`, `ip6-loopback`, `*.localdomain`, `*.internal`, `*.local`, `*.home.arpa`, and any name without a dot (`kong`, `supabase-db` — a machine on our own network) |
| IPv4 in any `inet_aton` spelling (`127.0.0.1`, `127.1`, `2130706433`, `0x7f.1`, `0177.0.0.1`) | `0/8`, `10/8`, `127/8`, `100.64/10` (carrier-grade NAT), `169.254/16` (link-local, cloud metadata), `172.16/12`, `192.168/16`, `224/4` and above; an all-numeric name that is no valid address |
| IPv6 | `::`, `::1`, IPv4-compatible `::a.b.c.d`; IPv4-mapped `::ffff:a.b.c.d` and IPv4-translated `::ffff:0:a.b.c.d`, NAT64 `64:ff9b::/96` and 6to4 `2002::/16` — judged by the IPv4 address inside; `fc00::/7` (unique-local), `fe80::/10` (link-local), `fec0::/10` (site-local), `ff00::/8` (multicast); a literal that does not parse |

The same check guards every download through `fetchImageBuffer` (the photo
mirror, backdrop sampling, card export — on every redirect hop), the admin's
upload-by-URL and the outfit generator's reference images. `assertPublicUrl()`
and the outfit generator also resolve the name (`isBlockedResolvedHost`) and
refuse one that points at an internal address; the address `fetch()` then dials
is not pinned, so DNS rebinding is not covered by this alone.
