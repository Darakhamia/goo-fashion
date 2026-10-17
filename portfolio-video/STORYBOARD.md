# GOO Fashion: promo video, storyboard and plan

A 28.5-second silent promo for the portfolio site, in the style of a product-launch ad: bold kinetic type, a few product moments shown big and clean, and a strong ending. It is not a screen walkthrough. It replaces the first cut (a walkthrough, rebuilt from vendored components); see [History](#history).

**Status:** approved 2026-10-13, after six full-resolution stills (one per key beat) and the side-by-side check against the live site. Rendered the same day from full-resolution masters; the final files and their `ffprobe` check are in README.md.

---

## 1. How the UI is captured

**Nothing in the video is redrawn. Every piece of interface in it is a screenshot of the real app.**

1. **The real app runs locally.** It is a production build (`next build && next start`) of `master` at `e947728`, made in a separate worktree, so this branch's video folder stays out of the app's type check.
2. **Its database is a stand-in.**
   - `capture/mock-supabase.mjs` answers the app's PostgREST reads from JSON tables.
   - The app is unchanged. It reads through its own code: `dbToProduct`, `groupVariants` and the seeded shuffle.
3. **The fixtures are the real catalogue.**
   - Source: `capture/fixtures/source/`, exported once from goo-fashion.com's public API on 2026-10-13:
     - `/api/products`: 554 items;
     - `/api/categories`, `/api/color-groups` and `/api/brands`.
   - `capture/build-fixtures.mjs` turns the export back into table rows.
   - Product photos are the white-background shots the live site serves from its own storage. A capture run copies them once into `capture/fixtures/storage/` (`COPY_MISSING=1`). After that, capturing is offline.
   - The photo cache is not committed (137 MB). The captures made from it are.
4. **One exception to "as exported"** is the D2 store rows.
   - The featured item (Air Jordan 1 "Royal") is sold by one store in the live catalogue, Goat.
   - As approved before (D2), two illustrative stores are added: StockX at $162 and Farfetch at $185.
   - They live in their own file, `capture/fixtures/illustrative.json`, which says so in its first line.
5. **The browser is Playwright Chromium at `deviceScaleFactor 2`.**
   - Viewports: 1440×900 for desktop, 390×844 for phone.
   - Light theme, cookie choice already made, the one-time "AI Stylist" tip dismissed.
   - `Math.random` is seeded, so every load of a page is identical.
6. **The AI stylist exchange is scripted.**
   - The capture answers the app's `POST /api/stylist/chat` with a fixed reply in the route's own response shape.
   - No model is called.
   - The question is typed into the real input one key at a time, and each keystroke is captured.
7. **What the captures are.** `capture/shoot.cjs` writes PNGs to `public/captures/`, plus `manifest.json` with every element's rectangle measured from the DOM. The video only moves, crops, layers and reveals these captures.

### Captures against the real site

Before building, three captures were put side by side with goo-fashion.com, at the same viewport and scale (`capture/compare.cjs`):

| View | Pixels differing | What differs |
|---|---|---|
| Browse grid, desktop | 0.46% | Sign in / Sign up in the header (Clerk loads them from its servers, so they can't appear offline), and anti-aliasing on photo edges (live serves resized photos; locally the originals load). Products, order and layout are identical. |
| Builder with the look, phone | 4.17% | Only the catalogue strip under the board. It is a random shuffle, and on live Clerk and analytics draw random numbers first. The board, the pieces and the total are identical. The video crops to the board. |
| Featured product page, desktop | 1.12% | The two illustrative store rows (D2) and the header, as above. The photo, title, price and the real Goat row are identical. |

The desktop header never appears in the video.

---

## 2. Storyboard

28.5 s · 30 fps · 855 frames. Formats: 1920×1080 (16:9) and 1080×1080 (1:1, recomposed, not cropped).

**Type cards** (beats 1, 3, 5 and 7):
- Inter Tight 800 (the site's face), tight tracking, in the site's light text colour on near-black.
- 164–172 px at 1080p in 16:9 and 128–144 px in 1:1, never below 64 px.
- Words rise in from behind a mask, one after another. Each line holds at least 1 s fully set.

**Product shots** (beats 2, 4, 6 and 8):
- The site's own light page colour behind them (`rgb(244 242 238)`).
- The capture floats with a soft shadow, and the camera pushes in slowly.

| # | Time | Beat | On screen |
|---|---|---|---|
| 1 | 0.0–2.5 | **"Every store. / One wardrobe."** | From black: two lines rise in, hold, then lift away. |
| 2 | 2.5–6.5 | **The catalogue** | The real browse grid, the first 16 cards of today's catalogue in the site's own order, on a plane tilted in 3D. The product photos fly in from all four sides and land in their slots. The cards' frames, names and prices fade in around them, and the grid becomes the exact capture. The plane straightens as the camera pushes in. |
| 3 | 6.5–8.3 | **"Build the look."** | Type card. |
| 4 | 8.3–12.8 | **The outfit builder** | The phone builder's board, cropped from the real phone screen (top bar plus board) and shown big. Five real pieces snap onto it one by one: suede jacket, tee, jeans, Air Jordan 1 "Royal", sunglasses. Each piece flies in from the side and lands where the app put it, and the board reflows between the app's own captured states. The real total pill counts up $1,295 → $1,390 → $1,590 → $1,745 → **$1,945 · 5 pieces**. |
| 5 | 12.8–14.6 | **"Ask the AI stylist."** | Type card. |
| 6 | 14.6–19.6 | **The stylist** | The real chat input, huge: "All black for a gallery opening" is typed into it, one captured keystroke at a time. Send. The camera pulls back to the stylist sheet: the message bubble and the typing dots. Then the reply rises in: the answer, four real pieces (leather trucker, wide long sleeve, black trousers, Jordan 8 "Chrome"), and the "Build this look · 4 pieces" card. (The trousers are from `bottoms`, not `jeans`: the app's stylist maps only `bottoms` to the builder's bottom slot, so a pair of jeans would make the card say "3 pieces".) The camera pushes in on the look. |
| 7 | 19.6–21.8 | **"Find where to buy / every piece."** | Type card. |
| 8 | 21.8–25.3 | **Where to buy** | The real product page of the Jordan 1 "Royal" in a browser frame. The camera pushes in from the photo to "Where to buy" as the store rows cascade in: Goat $155 **Best** (real), StockX $162 and Farfetch $185 (illustrative, D2). |
| 9 | 25.3–28.5 | **End card** | The site's real dark hero, cropped below the nav: the big **GOO**, "Build your look" and the "Build your look ↗" button rise in. **goo-fashion.com** sets underneath. Everything fades to the type cards' black, which is frame 0, so the loop is seamless. |

Pace: every beat is 1.8–5 s, with type cards at 1.8–2.5 s. The camera never stops: there are no static holds, only slow drifts.

**Logos.** No brand logo is ever the subject. GOO's own wordmark appears only on the end card. The pieces were picked for small or no logos.

**Poster** (`goo-poster.png`): the builder board filled, with "$1,945 · 5 pieces", from beat 4 in 16:9. It is a product frame, not the end card.

### 1:1 recomposition

The type is re-set with its own line breaks: "Ask the / AI stylist." and "Find where / to buy / every piece."

| Beat | 16:9 | 1:1 |
|---|---|---|
| Catalogue plane | Covers the frame | Covers the frame, from a different angle |
| Builder board, stylist sheet | Centred, filling the height | Centred, filling the height |
| Browser | 1700 px wide; the camera ends framed on "Where to buy" | Smaller; the push-in ends tighter on the rows |
| Hero | Covers the frame | Re-cropped to a square around GOO |

### 9:16 cut, with sound (added 2026-10-14)

The same film, recomposed for 1080×1920 and, unlike the two loops above, with sound.

| Beat | 9:16 |
|---|---|
| Type cards | 196 px, one or two words a line: "Every / store. / One / wardrobe.", "Build / the look.", "Ask the / AI stylist.", "Find where / to buy / every piece." (168 px) |
| Catalogue plane | The whole wall of 16 cards, four rows deep |
| Builder | The whole phone, top bar to tab bar |
| Stylist | Typed close on the input; pulls back to the whole sheet |
| Browser | Ends on the info column (title, price, "Where to buy"), centred. The address sits next to the window buttons, so the close-up never cuts it in half. |
| Hero | A square around GOO in the middle of the frame, fading into black above and below |

**Sound.** Every sound is synthesised from noise and sine waves by `scripts/make-sfx.py`, with fixed seeds: no third-party samples, no licences. Each scene places its own cues next to the motion they belong to (`src/promo/Sfx.tsx`):

| Beat | Sound |
|---|---|
| Type cards | One soft rush as the words rise |
| Catalogue | Rushes as the photos fly in, a few ticks as they land, a soft snap as the grid settles |
| Builder | Per piece: a rush in, a low snap on landing, and a blip that rises one tone each time the total changes |
| Stylist | A keystroke per typed character, a pop on send, a rush on the pull-back, a two-note chime with the answer, faint ticks as the pieces arrive |
| Product | A rush as the window arrives; the three store rows tick in, each a step higher; a low swell into the end card |
| End card | A soft, deep landing as GOO rises; a chime with goo-fashion.com |
| Under everything | A quiet, airy chord (Fmaj9), silent at both ends |

The mix is quiet on purpose: −24 LUFS integrated, about 10 dB below what social platforms normalise to, with the true peak under −6 dBTP. Frame 0 and the last frame are silent, so the loop is seamless in sound too.

### Shorts: Night, Ask, Pocket (added 2026-10-16)

Three short films in the same style, each built around one idea. They are delivered as MP4 only (no WebM, no posters).

- **Format:** vertical 1080×1920, 30 fps, 15–16 s, with the same quiet sound as the 9:16 cut.
- **Loudness:** −24 LUFS integrated, true peak under −6 dBTP.
- **Source:** the same captures and scenes as the promo, plus new captures of the same local app (§1). Each short is a seamless loop.
- **Type cards:** 196 px, in tone with the film: light type on black for Night, black type on the site's light page colour for Ask and Pocket.
- **End card:** the site's real hero in the film's theme.

**Night** (dark theme, 15.5 s, 465 frames). Everything is the site's dark theme.

| Time | Beat | On screen |
|---|---|---|
| 0.0–2.0 | **"Dress for / tonight."** | Type card |
| 2.0–6.0 | **The outerwear wall** | The real browse grid filtered to outerwear, dark theme, first 16 cards. The photos fly in as in beat 2. |
| 6.0–7.8 | **"Snap it / together."** | Type card |
| 7.8–12.3 | **The builder, dark** | Five pieces snap on one by one. The total counts $990 → $1,165 → $1,440 → $1,599 → **$1,779 · 5 pieces**. |
| 12.3–15.5 | **End card** | The dark hero, as in the promo |

Night's five pieces are a leather mix jacket, a wide long sleeve, tapered jeans, Air Jordan 3 "True Blue" and sunglasses.

**Ask** (light, 16.1 s, 482 frames)

| Time | Beat | On screen |
|---|---|---|
| 0.0–2.2 | **"Not sure / what to / wear?"** | Type card |
| 2.2–7.3 | **The stylist** | "Smart casual for a dinner date" is typed into the real input. The scripted reply rises in with four real pieces: twill jacket, tee, black trousers, Nike SB Air Force 1 Low. Then a finger taps "Build this look · 4 pieces". |
| 7.3–11.1 | **The builder fills** | The sheet slides away, and the app's scrim clears over the empty builder. The four pieces rise onto the board from below, and the total counts $495 → $645 → $990 → **$1,126 · 4 pieces**. |
| 11.1–12.9 | **"Ask. / Build. / Wear."** | Type card |
| 12.9–16.1 | **End card** | The light hero |

- The capture taps "Build this look" in the real app and records the builder address it opens. It is the same look the builder states show.
- The stylist's last frame and the builder's first are the same picture, so the cut is invisible.

**Pocket** (light, 15.1 s, 453 frames)

| Time | Beat | On screen |
|---|---|---|
| 0.0–2.4 | **"Every / store. / In your / pocket."** | Type card |
| 2.4–9.9 | **The phone** | See the steps below the table. |
| 9.9–11.9 | **"Best price. / One tap."** | Type card |
| 11.9–15.1 | **End card** | The light hero |

On the phone:
1. The real results for "Jordan 1" (14 cards) are flicked down twice.
2. A finger taps the Air Jordan 1 "Royal" ("$155 · 3 stores"), and its page pushes in.
3. It taps "Where to buy" in the buy bar. The page scrolls to the stores: Goat $155 "Best price" (real), StockX $162 and Farfetch $185 (illustrative, D2). The scroll ends exactly where the app's own scroll does (698 px, measured).
4. It taps the bag. The bag button gets its check, and the header's bag shows **1**.

How the phone is captured:
- A scrolling page is captured in layers, the way the phone composes it:
  - the whole page as one tall image, with the fixed bars hidden;
  - each fixed bar on its own, over a transparent background: the header, the tab bar, and the buy bar before and after the tap.
- The video scrolls the page under the bars. Under the translucent bars it applies the app's own backdrop blur (`backdrop-blur-md`).
- Viewport shots of the real page after each tap sit next to the layers, for checking the composite (`pocket-product-stores.png`, `pocket-product-bagged.png`).

**Sound.** The same library and placement rules as the 9:16 cut, plus:
- **Pocket:** soft rushes for the flicks, a pop per tap, a rush as the page opens, the three store rows ticking in a step higher each, and a snap and blip for the bag.
- **Ask:** the stylist's cues and a pop on "Build this look".
- **Pads:** each film has a pad of its own length, chord and seed: Dm9 for Night (low and dark), Gmaj9 for Ask, Cmaj9 for Pocket (brighter). The promo's files are untouched.

### Feature films: Local, Colours, Search (added 2026-10-17)

Three more vertical films, asked for as "different features, more effects". Each one shows something the site does that the promo and the shorts do not. The motion is bolder: glitches, colour-channel splits, punch-ins on the cut, blur along fast moves, slot reels, a circle wipe, cards flying to new places.

- **Format:** MP4 only, 1080×1920, 30 fps, quiet sound at −24 LUFS.
- **Source:** every piece of interface is still a capture of the local app.

**What is new in the capture** (`capture/shoot-features.cjs`):
- **The homepage's gooey word, recorded as it moves.** The hero word morphs GOO → Outfits → Looks → Style → Fits, in Ukrainian GOO → Образи → Луки → Стиль → Мода. The page's clock is Playwright's: it is paused, then stepped 1/30 s per frame. So the app's own animation is captured at exactly 30 fps, at deviceScaleFactor 3, and kept as a short video for each language (`morph-en.mp4`, `morph-uk.mp4`).
- **Phone screens at deviceScaleFactor 3,** because these films show them larger. Full screens are JPEG q92.
- **Language and currency come from the app's own settings,** stored as it stores them: `goo-lang` and `goo-currency` in localStorage.
- **The currencies are the switcher's seven:** USD, EUR, GBP, UAH, CZK, JPY and TRY. Prices are converted by the app.
- **Saved items need a signed-in account.** They can't be shown offline, so there is no saved-items film.

**Local** (19.5 s, 584 frames)

| Time | Beat | On screen |
|---|---|---|
| 0.0–6.5 | **The word, in two languages** | Two gooey morphs: GOO → Outfits → Looks. A glitch (slices and a channel split) crosses into Луки → Стиль → Мода, and the label decodes from ENGLISH to УКРАЇНСЬКА. The word sits on the hero's own background, at the same scale. |
| 5.9–10.2 | **The homepage switches** | A circle wipe opens on the phone homepage ("How it works") and the footer's real language switch, shown big. A tap on UA, then a divider sweeps across: the same screen in English on one side and Ukrainian on the other. |
| 10.2–11.7 | **"Any / currency."** | Type card |
| 11.7–16.3 | **Seven currencies** | The sneaker's stores, with each price a slot reel. Row by row, they roll from one currency's capture to the next: $156 → 138 € → £117 → 3,370 Kč → ¥24,591 → 7,708 ₺ → **6,988 ₴**. The buy bar rolls with them, and the currency code and symbol stand huge behind. |
| 16.3–19.5 | **End card** | The dark hero |

**Colours** (17.7 s, 532 frames, cut on a 120 BPM beat)

| Time | Beat | On screen |
|---|---|---|
| 0.0–2.0 | **"Every colour."** | The filter sheet's thirteen real swatches pop in. "colour." is cut out of the thirteen colours sliding through it. |
| 2.0–7.7 | **A colour a beat** | The frame floods with each swatch's own colour (its hex from the catalogue). The real swatch row shows it picked, and the phone shows the real results for it. The name and the sheet's own count ("198 pieces") stand huge above. The last five come on every half beat. Each cut has a punch-in, a channel split, a little shake and a tap. |
| 7.7–11.2 | **One tee, 8 colours** | The Cities Tee's page in each of its colours, one tap per swatch, with the frame in that colour |
| 11.2–14.5 | **Every angle** | The sneaker's ten photos, whipped through with motion blur. The page's own counter goes 1/10 → 10/10. |
| 14.5–17.7 | **End card** | The light hero |

**Search** (15.2 s, 456 frames)

| Time | Beat | On screen |
|---|---|---|
| 0.0–3.2 | **Typing** | A tap on search, then "jacket" typed a key at a time, set huge above the phone. Under it, the app's count rolls 554 → 148 → 44 → 26. |
| 3.2–6.9 | **Sort** | The real Sort & filter sheet rises. A tap on "Price: low to high", then on "Show 26 pieces". The cards fly from their places in one order to their places in the other. |
| 6.9–10.2 | **Filter** | The sheet again: black is picked, and the count rolls 26 → 14. The cards that are not black drop out, and the rest close up. |
| 10.2–12.0 | **"Find it. / Fast."** | Type card |
| 12.0–15.2 | **End card** | The light hero |

- A search typed into the page has no filter button. So the sort and filter part opens the same results from the address, `/browse?search=jacket`, which keeps the toolbar.
- The cards that fly are each cut from the capture of the order they land in.

**Sound.** The same library and placement rules, plus a soft kick and hat for the beat, a glitch, a slot-reel ratchet and a riser. All are synthesised by `scripts/make-sfx.py`. Each film has its own pad.

---

## 3. Output (`out/`, replacing the old files)

| File | Spec |
|---|---|
| `goo-16x9.mp4` | 1920×1080, 30 fps, H.264 High, yuv420p, CRF 18–20, `+faststart`, ≤ 8 MB |
| `goo-1x1.mp4` | 1080×1080, same settings |
| `goo-16x9.webm`, `goo-1x1.webm` | VP9, two-pass |
| `goo-poster.png` | 1920×1080, the builder frame |
| `goo-9x16.mp4` | 1080×1920, 30 fps, H.264 High, yuv420p, CRF 18–20, `+faststart`, AAC 160 kb/s, ≤ 8 MB |
| `goo-9x16.webm` | VP9 two-pass, Opus 128 kb/s |
| `goo-9x16-poster.png` | 1080×1920, the builder frame |
| `goo-night.mp4`, `goo-ask.mp4`, `goo-pocket.mp4` | The shorts: 1080×1920, 30 fps, H.264 High, yuv420p, CRF 18–20, `+faststart`, AAC 160 kb/s, ≤ 8 MB. MP4 only. |
| `goo-local.mp4`, `goo-colours.mp4`, `goo-search.mp4` | The feature films, same settings. MP4 only. |

- Rendering is from a lossless master at full resolution, never from a preview.
- Every file is checked with `ffprobe`, and its width, height and bitrate are reported.

---

## 4. Decisions

- **D1 (photos), carried over.** Real white-background shots from GOO's own storage, copied once.
  - Now they are copied by the capture run, for the real app to display. The video uses no loose photos.
- **D2 (store prices), carried over.** The featured item gets two illustrative stores, marked as such in `capture/fixtures/illustrative.json`.
  - Alternative, if you prefer real data only: the page shows its one real row, and the site's own label then reads "1 STORES".
- **D3 (cursor).** None this time: the motion is the camera's and the pieces'.
- **D4 (end card).** The site's real dark hero with the big GOO.
- **D5 (branch).** Everything is committed to `portfolio-video`. No PR to `main`.
- **D6 (touch marks, shorts only).** Ask and Pocket show where a finger taps: a soft disc and a spreading ring, drawn over the capture like the phone bezel. They are presentation, not interface. The promo itself keeps D3: no cursor.

---

## History

The first cut (approved 2026-10-12) was a 24 s walkthrough built from vendored components and recreated page layouts. Its storyboard is in this file's git history, at commit `67c4442`. This promo replaces it. Only the portrait card (`src/card/`, `out/card/`) still uses that code.
