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

## 3. Normalizer

`src/lib/server/parser/normalize.ts` maps the raw fields to a `Product`, reusing
the **same** helpers as the CSV importer (`src/lib/server/product-fields.ts`):
price parsing (EU/US formats), currency, category & gender inference, color→hex.
Relative image URLs are resolved; results are deduped.

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
