# GOO Fashion — portfolio video

A 24-second silent loop of the GOO interface for a portfolio site, made with
[Remotion](https://www.remotion.dev/) from the app's own components, tokens and
catalogue. Self-contained: own `package.json`, nothing in the app changed.

- `STORYBOARD.md` — the brief, the storyboard and the decisions behind it.
- `VENDORED.md` — which parts are the app's code, copied, and which are rebuilt from its markup.

## Deliverables (`out/`)

| File | |
|---|---|
| `goo-16x9.mp4` | 1920×1080, 30 fps, H.264 |
| `goo-16x9.webm` | 1920×1080, 30 fps, VP9 |
| `goo-1x1.mp4` | 1080×1080, 30 fps, H.264 — re-laid out for square, not cropped |
| `goo-1x1.webm` | 1080×1080, 30 fps, VP9 |
| `goo-poster.png` | 1920×1080 — the builder with the board filled and the total shown |

Every video file is under 5 MB. The last frame equals the first, so the loop is
seamless:

```html
<video autoplay muted loop playsinline poster="goo-poster.png">
  <source src="goo-16x9.webm" type="video/webm">
  <source src="goo-16x9.mp4" type="video/mp4">
</video>
```

## Make it again

```bash
npm ci
npm run studio                      # preview in the browser
node scripts/render.mjs preview     # half-size review copies → out/preview/
node scripts/render.mjs master      # near-lossless masters → out/master/
scripts/encode.sh                   # deliverables under 5 MB → out/
node scripts/stills.mjs out 1 Poster-16x9:0 && mv out/Poster-16x9-000.png out/goo-poster.png
```

Renders run offline: the catalogue and photos are local fixtures
(`src/fixtures/`, `public/fixtures/`), the AI stylist's exchange is scripted,
and the font is bundled. The browser is the Chromium headless shell at
`/opt/pw-browsers` (override with `REMOTION_BROWSER`).

## Data

Products are real items from GOO's live catalogue; their photos were copied
once from GOO's own image storage. The product page's second and third store
prices (StockX, Farfetch) are **illustrative**, marked as such in
`src/fixtures/story.ts`: the live catalogue lists that sneaker at one store.

Remotion is free for individuals and companies of up to three people; larger
companies need a company license.
