# Universal Product Parser

Import a single product from **any** store URL (Farfetch, SSENSE, Mr Porter, a
brand's own site) straight into the catalog — the per-URL companion to the bulk
CSV importer.

Admin screen: **Goo Studio → Imports → Parser** (`/goo-studio/parser`).

---

## Why this design (and where `curl_cffi` fits)

`curl_cffi` and `cloakbrowser`/`playwright` are Python tools that defeat anti-bot
(Cloudflare / Akamai / DataDome) by impersonating a real browser's TLS/JA3
fingerprint and rendering JS. They **cannot run inside a Vercel/Next.js function**.

So the parser splits the job in two:

1. **Fetching** is *pluggable*. The heavy anti-bot work is delegated to whatever
   the admin configures — including a self-hosted `curl_cffi`/playwright service.
2. **Extraction + normalisation** runs in TypeScript, in-app, and is fully
   universal (no per-site code required for most stores).

```
URL ─▶ Fetch layer ─▶ HTML ─▶ Universal extractor ─▶ Normalizer ─▶ preview ─▶ import
        (pluggable)            (JSON-LD/OG/microdata)   (shared with CSV import)
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

`{url}` → URL-encoded target, `{key}` → API key, `{render}` → `true`/`false`.

Options: **impersonate** (chrome/safari/firefox/edge UA), **render JS** toggle,
**timeout**. The provider API key is stored server-side (masked in the UI) or set
via the `PARSER_FETCH_API_KEY` env var (env wins, like the OpenAI key).

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

## 2. Universal extractor

`src/lib/server/parser/extract.ts` reads structured data from raw HTML, highest
precedence first:

1. **Per-site recipe regex** (admin overrides) →
2. **JSON-LD** `schema.org/Product` (name, brand, `image[]`, `offers`, color,
   material, description) — Farfetch and most luxury retailers ship this →
3. **OpenGraph / product / twitter** meta tags →
4. **Microdata** (`itemprop=…`)

No DOM library — pure regex/JSON, so it runs in any serverless route. Handles
`@graph`, `Offer`/`AggregateOffer` arrays, nested `Brand`, and HTML entities.

### Gallery harvesting

Structured data is reliable but thin about photography: OpenGraph carries a
single `og:image`, and stores ship JSON-LD with one photo for a page showing
eight. So `src/lib/server/parser/gallery.ts` also scrapes `<img>` (including the
lazy-loading and zoom attributes: `data-src`, `data-zoom-image`,
`data-large_image`), `srcset`, `<link rel=preload as=image>`, CSS
`background-image` and inline JSON for the rest of the gallery.

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
`_600x600_crop_center`, `_grande`). Both are stripped to fetch the original —
measured 34 KB → 642 KB on Allbirds. The query is edited as text rather than
through `URLSearchParams`, which re-serialises the whole thing and turns
Scene7's `?$pdp$` preset into a rendition that does not exist. The same
normalisation is the dedupe key, so one photo offered at three sizes is stored
once instead of three times.

> JS-rendered galleries are still invisible to a plain fetch. Enable **Render JS**
> in Fetch & Anti-bot for those stores.

## 3. Normalizer

`src/lib/server/parser/normalize.ts` maps the raw fields to a `Product`, reusing
the **same** helpers as the CSV importer (`src/lib/server/product-fields.ts`):
price parsing (EU/US formats), currency, category & gender inference, color→hex.
Relative image URLs are resolved; results are deduped.

### Colour

Colour is the one field a product needs twice over: the catalogue prints the
store's own word for it, and the browse sidebar filters on `color_group_ids` —
database ids, not words. Both are filled on import, so a parsed product arrives
already under the right filter with the right swatch.

**Reading it.** Every layer is searched, in this order: a site recipe's regex →
JSON-LD (`color`, an `additionalProperty` named Colour, or the shown variant's
colour) → `product:color` meta → microdata → the markup itself (`data-color=`,
`"color":"…"` in a hydration payload, a "Colour: Black" line). What the page
says is kept **verbatim** — "Core Black" stays "Core Black".

When the page states no colour anywhere, the product title and then the URL's
last path segment are read for one, and the base colour is written as the label
("Black"). Both fallbacks are guarded by the vocabulary below, so "Nike Air
Force 1" contributes nothing. The markup patterns are guarded the same way,
because `"color":"#f5f5f5"` and "Colour: as pictured" both match the shape.

**Filing it.** `canonicalColor()` reduces a colourway to one of twelve base
colours — "Core Black", "Noir", "Nero", "чёрный" all read as black — which then
gives the swatch hex and the `color_groups` row. The **last** colour word wins,
because a colourway puts its qualifier first: "Natural Black" is a black shoe.
A label naming two colours across a separator ("Black/White", "Blue and Green")
is filed under both groups *and* Multicolor, which is the group
`lib/color-groups.ts` treats as the only truthful single label for such a piece.
"Natural Black" is one colour, "Natural/Black" is two.

A database that has not run the colour-filter migration still takes the product:
the write goes through `writeProductRow`, which drops the unknown column and
retries rather than failing the import.

---

## Site recipes — "Site Recipes" tab

Recipes match by hostname and add overrides on top of the generic extractor:

- **Brand / Category / Gender override** — e.g. tag every item from a
  single-brand store, or force a womenswear-only retailer.
- **Field regex overrides** — for the rare field the generic strategies miss; the
  first capture group becomes the value (e.g. sizes:
  `class="size-list">([^<]+)<`).

Ships with enabled recipes for Farfetch, SSENSE and Mr Porter (which all parse
out-of-the-box via JSON-LD) plus a disabled single-brand template.

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
  images**.
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
screen fills the catalog on its own:

```
discover ─▶ product URLs (incl. pagination) ─▶ batch(5) ─▶ parse ─▶ AI ─▶ mirror photos ─▶ upsert
```

- **discover** (`crawl.ts`) walks the listing, following `rel="next"` and
  page-numbered anchors up to the page cap, and returns product URLs. A pasted
  PDP is detected and collected on its own.
- **batch** parses and imports 5 URLs per request. The loop lives in the browser,
  so progress is live, **Stop** works immediately, and no request ever runs past
  the route's `maxDuration`.
- Re-running the same URL **updates** existing products (dedupe by `source_url`)
  rather than duplicating them, so a collection run is safe to repeat.

Per-product outcomes (`new` / `updated` / `skipped` / `failed`, with the reason
and whether AI was needed) stream into the screen as they land.

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

### When a listing comes back empty

An empty crawl has three different causes with three different fixes, so
`crawl.ts` reports what the page actually was rather than one blanket guess:

| What came back | Hint |
|---|---|
| An anti-bot interstitial (Akamai/Cloudflare/DataDome, often a `200`) | Set a scraping provider — a plain request can't get past it |
| A near-empty shell with almost no links | The grid is built in the browser; render it |
| A full page whose links don't look like products | Paste a single product URL |

The advice is mode-aware: **Render JS is only ever forwarded to a scraping
provider**, so in `direct` mode the hint never points at that toggle.

---

## 6. Photos live on our storage

Catalog rows must not hotlink retailer CDNs: those URLs rot, and Farfetch already
answers `429` to our image optimiser. On import,
`src/lib/server/storage/product-images.ts` downloads every photo with browser
headers and a per-site `Referer` — which also defeats hotlink protection — and
re-uploads it to the public `product-images` bucket.

- 3 downloads run in parallel; a photo already on our storage is skipped.
- A download that fails **keeps its original URL** instead of vanishing, so a
  rejected mirror degrades to a hotlink rather than a blank card.
- The background-removal tool (`/api/admin/image-tools`) shares these primitives.

Toggle: **Fetch & Anti-bot → AI & images → Copy product photos…**

---

## Importing

The **Parse URL** tab fetches → extracts → shows an **editable preview** (every
field, image picker, diagnostics: HTTP status, HTML size, which strategies hit,
which fields AI supplied). **Import** writes one product, deduped by `source_url`
(re-importing the same URL updates in place), and records an `import_jobs` row.

### Listing / category pages

Paste a category or search URL and the parser pulls **every** product it can:

- If the page embeds product data (a schema.org `ItemList`, or multiple
  `Product` nodes), each card becomes a row in a **selectable grid** — tweak
  category/gender/name inline, then **bulk-import** the selected ones.
- If the page only has links, the parser lists the discovered product URLs and
  **"Parse first N"** fetches each individually (using the same fetch provider),
  then drops them into the same grid.

### Image quality

`og:image` / JSON-LD thumbnails are often small. `upscaleImageUrl()` bumps the
width token in the URL to ~1000px for common CDNs (Farfetch `_NNN.jpg`,
`?w=`/`?width=` query params, AWIN proxy). It's a reversible heuristic — edit the
URL in the preview if a site uses a different scheme.

---

## Storage & schema

No new migration. Config lives in the existing `settings` key/value table:

| key | value |
|---|---|
| `parser_fetch_settings` | JSON `ParserFetchSettings` |
| `parser_fetch_key` | provider API key (secret) |
| `parser_site_configs` | JSON `ParserSiteConfig[]` |
| `parser_ai_settings` | JSON `ParserAiSettings` (AI mode + image mirroring) |

Imports use the `products.source_url` column and the `import_jobs` table from
migration `004_import_tables.sql`. Mirrored photos go to the public
`product-images` Storage bucket, created on first use.

---

## Files

```
src/lib/server/product-fields.ts            ← shared field normalisers (CSV + URL)
src/lib/server/storage/product-images.ts    ← download + mirror photos to our bucket
src/lib/server/parser/
├── types.ts                                ← config + result types
├── fetch.ts                                ← pluggable fetcher + SSRF guard
├── extract.ts                              ← JSON-LD / OG / microdata / recipe
├── ai-extract.ts                           ← AI fallback (condense → model → merge)
├── normalize.ts                            ← raw → Product
├── parse-page.ts                           ← one URL → products (shared pipeline)
├── crawl.ts                                ← listing → product URLs + pagination
├── import-product.ts                       ← ParsedProduct → catalog row
└── configs.ts                              ← settings-backed config + site match
src/app/api/admin/parser/
├── config/route.ts                         ← GET/POST fetch settings, key, recipes, AI
├── parse/route.ts                          ← POST { url } → preview (no write)
├── crawl/route.ts                          ← POST discover | batch → bulk collect
└── import/route.ts                         ← POST { product } → upsert product
src/app/goo-studio/parser/page.tsx          ← admin screen (4 tabs)
```

## Security

All routes are gated by `requireAdmin`. `direct` fetches block private/loopback/
link-local hosts (SSRF). The provider API key is never returned raw to the
browser — only a masked form; the OpenAI key is only ever reported as
configured/not configured.

Note on `finalUrl`: only a `direct` fetch reports a meaningful final URL. In
provider mode the response URL belongs to the **scraping service**, so
`fetch.ts` keeps the target URL — otherwise every relative link and image would
resolve against the provider's domain.
