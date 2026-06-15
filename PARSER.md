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

## Importing

The **Parse URL** tab fetches → extracts → shows an **editable preview** (every
field, image picker, diagnostics: HTTP status, HTML size, which strategies hit).
**Import** writes one product, deduped by `source_url` (re-importing the same URL
updates in place), and records an `import_jobs` row.

---

## Storage & schema

No new migration. Config lives in the existing `settings` key/value table:

| key | value |
|---|---|
| `parser_fetch_settings` | JSON `ParserFetchSettings` |
| `parser_fetch_key` | provider API key (secret) |
| `parser_site_configs` | JSON `ParserSiteConfig[]` |

Imports use the `products.source_url` column and the `import_jobs` table from
migration `004_import_tables.sql`.

---

## Files

```
src/lib/server/product-fields.ts            ← shared field normalisers (CSV + URL)
src/lib/server/parser/
├── types.ts                                ← config + result types
├── fetch.ts                                ← pluggable fetcher + SSRF guard
├── extract.ts                              ← JSON-LD / OG / microdata / recipe
├── normalize.ts                            ← raw → Product
└── configs.ts                              ← settings-backed config + site match
src/app/api/admin/parser/
├── config/route.ts                         ← GET/POST fetch settings, key, recipes
├── parse/route.ts                          ← POST { url } → preview (no write)
└── import/route.ts                         ← POST { product } → upsert product
src/app/goo-studio/parser/page.tsx          ← admin screen (3 tabs)
```

## Security

All routes are gated by `requireAdmin`. `direct` fetches block private/loopback/
link-local hosts (SSRF). The provider API key is never returned raw to the
browser — only a masked form.
