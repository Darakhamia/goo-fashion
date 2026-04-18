# BUILD PROGRESS — GOO Outfit Builder Redesign

_Last updated: 2026-04-18_

---

## Status Overview

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Global font system | ✅ Complete |
| Phase 2 | Stylist page typography | ✅ Complete |
| Phase 3a | Builder shell + layout foundation | ✅ Complete |
| Phase 3b | Builder left panel (slot rows) | ✅ Complete |
| Phase 3c | Builder center canvas (silhouette) | ✅ Complete |
| Phase 3d | Builder right panel (catalog rebuild) | ✅ Complete |
| Phase 3e | Builder AI Stylist drawer (chat UI) | ✅ Complete |
| Phase 3f | Builder mobile layout + QA polish | ✅ Complete |
| Phase 4 | QA and polish | ✅ Complete (folded into 3f) |
| Follow-up Phase A | Canvas balance, decorative cleanup, Generate threshold | ✅ Complete |
| Follow-up Phase B | Catalog filters: price, brand, sort | ✅ Complete |

---

## Follow-up Phase B — Catalog Filters ✅

**Completed:** 2026-04-18

### What was done

**`src/app/builder/page.tsx`**
- Added `Brand` to imports from `@/lib/types`
- Added `PRICE_BUCKETS` module-level constant (All / < $200 / < $500 / < $1k / < $2k)
- Added 4 new state vars: `maxPrice`, `selectedBrands`, `sortBy`, `filtersOpen`
- Added `availableBrands` memo — derives brand list from current category filter, sorted alphabetically
- Extended `catalogProducts` memo with price cap filter, brand multi-select filter, price sort (asc/desc)
- Added `hasActiveFilters` computed boolean — drives badge count display
- Added `clearFilters` action — resets price/brands/sort to defaults
- Added filter UI to **desktop right panel** (between category chips and count row):
  - Always-visible compact row: "Filters [· N]" toggle + Sort cycle button + Clear link
  - Expandable panel: Price bucket pills (single-select toggle) + Brand multi-select chips
- Added same filter UI to **mobile catalog section** (between chip row and count row)

### Interaction model
- Filters toggle row is always visible; panel collapses/expands via `filtersOpen` state
- Price bucket: clicking active bucket deselects it (toggle behavior); clicking new one replaces
- Brand: multi-select — any number of brands can be active simultaneously
- Sort cycles through: Featured → Price ↑ → Price ↓ → Featured
- Active filter count shown inline: "Filters · 3"
- Clear button resets all three filter dimensions at once
- Filters are shared state between desktop and mobile (same state vars)

---

## Phase 1 — Global Font System ✅

**Completed:** 2026-04-18

### What was done

**`src/app/layout.tsx`**
- Added `next/font/google` imports for `Fraunces`, `Inter_Tight`, `JetBrains_Mono`
- Font config:
  - `Fraunces` → CSS var `--font-fraunces` (normal + italic, `opsz` axis, `display: swap`)
  - `Inter_Tight` → CSS var `--font-inter-tight` (`display: swap`)
  - `JetBrains_Mono` → CSS var `--font-jetbrains` (`display: swap`)
- Injected all three `.variable` class names on `<html>` alongside the existing `dark` class

**`src/app/globals.css`**
- Replaced system font stack vars with:
  - `--font-body: var(--font-inter-tight), "Inter Tight", system-ui, sans-serif`
  - `--font-display: var(--font-fraunces), "Fraunces", Georgia, serif`
  - `--font-mono: var(--font-jetbrains), "JetBrains Mono", ui-monospace, monospace` *(new)*
- Updated light-mode background token: `#FAFAF8` → `#F4F2EE`
- Updated all 5 pre-computed overlay variables referencing the old background RGB (`250, 250, 248` → `244, 242, 238`)
- Added `.font-mono` global utility class

### Verification
- Grepped for stale `#FAFAF8`, `Palatino`, `BlinkMacSystemFont` — none found in src/
- Font variables are injected via `next/font` (self-hosted, `font-display: swap`, no layout shift)

---

## Phase 2 — Stylist Page Typography ✅

**Completed:** 2026-04-18

### What was done

**`src/app/stylist/page.tsx`** — typography class additions only. No step logic, routing, state, or layout was changed.

Applied `.font-mono` class to all UI elements in the JetBrains Mono role (labels, controls, metadata, action buttons):

| Element | Location |
|---|---|
| `Step {N} of {N}` counter | Progress bar row |
| `← Back` button | Progress bar row |
| `Continue` button | Style step, Palette step |
| `Skip` button | Style, Palette, Fit, Season steps (all 4) |
| `Selected range` label | Budget step |
| `$X–$Y` budget range text in preset cards | Budget step |
| `Generate Outfit` CTA button | Budget step |
| `Building your outfit…` loading text | Result/loading state |
| `AI Generated` eyebrow label | Result step |
| `Regenerate` button | Result step |
| `Start over` button | Result step footer |

**Already correct — no changes needed:**
- All `h1` headings already used `font-display` → now render Fraunces ✓
- Budget selected-range display (`font-display text-3xl`) → already Fraunces ✓
- Body/description text inherits `--font-body` (Inter Tight) via `body` tag ✓

### Step count
11 targeted `font-mono` additions across the file. Zero logic changes.

---

## Known Issues / Visual Areas to Check

### After Phase 1 (global fonts)
1. **Homepage hero** — Fraunces at `text-4xl/5xl font-light` may render slightly wider than Palatino; check for text overflow on narrow viewports.
2. **Navigation links** — Inter Tight replaces system-UI; spacing and weight at 13–14px should be verified, especially on mobile.
3. **Footer `--fg-on-dark-*` overlays** — rgba values updated from `250,250,248` to `244,242,238`; confirm legibility on dark backgrounds is unchanged.
4. **Nav backdrop (sticky blur)** — uses `--bg-overlay-90/95`; the slight background shift from near-white → warm cream should be checked in light mode.
5. **All pages using `.font-display`** — now Fraunces instead of Palatino. The optical size and weight render differently; verify on browse, outfit detail, product detail, and plans.

### After Phase 2 (stylist typography)
6. **JetBrains Mono at 10px** — the step counter and eyebrow labels are 10px monospace with `tracking-[0.18em]`. Confirm this is legible in both light and dark mode, especially on mobile (very small text).
7. **Budget preset card spacing** — the price range text (`$30–$150`) now renders in a slightly wider monospace face; verify it doesn't overflow the card padding at 2-column grid width.
8. **Generate Outfit button width** — `font-mono` has slightly different character width than Inter Tight; the `px-12` padding should still look balanced, but verify at mobile full-width.

---

---

## Phase 3a — Builder Shell + Layout Foundation ✅

**Completed:** 2026-04-18

### What was done

**`src/app/builder/page.tsx`** — full structural rewrite. All existing state, logic, actions, and the generate modal were preserved exactly.

**New outer layout:**
- `h-screen pt-16 flex flex-col overflow-hidden` — same as before, accounts for fixed `h-16` site nav
- `relative` wrapper on the 3-column body div (not the outer container), so the AI drawer is absolutely positioned starting below the site nav

**New builder sub-header (RUNWAY design):**
- GOO wordmark in Fraunces italic + Feed / Create / Saved tabs (mono labels, Create underlined)
- Share and Clear utility actions (hidden when nothing selected)
- Stylist pill button: toggles `aiOpen`, pulsing dot indicator, inverts on open

**New 3-column grid:**
- `grid-cols-[300px_1fr_360px]` on desktop, `grid-cols-1` on mobile (left/right panels hidden on mobile via `hidden md:flex`)
- Left panel: new "In this look" summary with per-slot rows (image 60×74 + mono label + name/brand + price), total footer with Fraunces display price
- Center panel: existing 2×2 canvas grid preserved intact (hover overlays, variant swatches, info cards, slot badges all kept)
- Right panel: existing product picker moved here (slot tabs + search + liked filter + AI match + ProductRow list)

**New footer (RUNWAY design):**
- Left: `N pieces · N brands` mono metadata (or prompt when empty)
- Right: Generate button (≥2 pieces only), Save / Saved ✓ button, View → link, "Shop the Look $XXX" inverted CTA

**New AI Stylist drawer (shell):**
- `absolute top-0 right-0 bottom-0 w-[380px]` within the `relative` body wrapper
- `animate-slide-in-right`, shadow `-20px 0 60px rgba(0,0,0,0.12)`
- Header: G avatar (Fraunces italic), "Stylist" label, "● Online" mono status, × close
- Body: centered placeholder ("AI Stylist · Chat UI — next step")
- Footer: message input placeholder with ⏎ hint

**New `uniqueBrandCount` derived value** added to power the footer metadata.

**Font-mono applied** to all builder labels, buttons, tabs, badges, and metadata.

### What did NOT change
- All state variables (selection, variantOverrides, products, activeSlot, search, aiMatch, likedOnly, saved, copied, generating, generatedImage, generatedModel, generateError, showModal)
- All action functions (selectProduct, selectVariant, clearSlot, clearAll, shareOutfit, saveOutfit, generateOutfit)
- URL persistence logic (updateURL + restore useEffect)
- Generated image modal (preserved exactly)
- Error toast (preserved)
- SlotIcon, ProductRow, EmptySlot components (preserved)

---

## Phase 3b — Left Panel Rebuild ✅

**Completed:** 2026-04-18

### What was done

**`src/app/builder/page.tsx`** — slot system and icon only. Left panel JSX from Phase 3a was already complete; only the data model needed updating.

- `SlotId` expanded: `"outerwear" | "top" | "bottom" | "shoes" | "accessories"`
- `SLOTS` updated to 5 entries:
  - `outerwear` → `["outerwear"]`
  - `top` → `["tops", "knitwear"]` (outerwear removed from this slot)
  - `bottom` → `["bottoms", "dresses"]`
  - `shoes` → `["footwear"]`
  - `accessories` → `["accessories"]`
- `CANVAS_SLOTS` constant added — filters outerwear out, keeps the 2×2 canvas working until Phase 3c
- `SlotIcon` outerwear SVG added (long coat silhouette, 16×16 viewBox)
- Right panel slot tab grid updated: `grid-cols-4` → `grid-cols-5`

---

## Phase 3c — Center Canvas (Silhouette) ✅

**Completed:** 2026-04-18

### What was done

**`src/app/builder/page.tsx`** — center panel JSX fully replaced. All state and action logic preserved.

**Removed:**
- `CANVAS_SLOTS` constant (no longer needed)
- `EmptySlot` component (replaced by inline empty-state rendering)

**Added:**
- `FIGURE_SLOTS` constant — typed array for the 4 main figure zones (outerwear, top, bottom, shoes) with `flex` proportion values
- `lookNumber` state — random 3-digit number generated once on mount, used in the canvas top bar

**New center `<main>` structure:**
- **Top bar** (h-9): "Look 001" mono label left · three display mode icon buttons (○ ◐ ●) right
- **Silhouette zone** (flex-1): 320px centered container holding:
  - **240px main figure** (absolute, left-aligned, full height): 4 flex-grow stacked zones for Outerwear (flex 7), Top (flex 4.5), Bottom (flex 5), Shoes (flex 2.5)
  - **Accessories floating panel** (absolute, right: 0, 60×74px, vertically centered): floats 20px right of the figure
- **Bottom bar** (h-8): "Edit · Drag to reorder" mono label centered

**Each slot zone behavior:**
- **Empty**: diagonal repeating-linear-gradient stripe using `var(--fg-overlay-05)` + dashed border + SlotIcon + category label
- **Filled**: product image (`object-cover`) + hover dim overlay + slot label badge (top-left) + variant swatches (top-right, up to 5) + info strip (bottom, slides in on hover: brand, name, ↗ link, price, × remove)
- **Active**: `ring-1 ring-inset ring-[var(--foreground)]`
- Clicking any zone sets `activeSlot` — right panel filters to that category

**Slot proportions at max-height 560px:**
- Outerwear: ~205px (37%)
- Top: ~131px (23%)
- Bottom: ~146px (26%)
- Shoes: ~73px (13%)
- Accessories: 74px fixed (floating)

---

## Pending Steps

### Phase 3b — ✅ Done

### Phase 3c — ✅ Done

## Phase 3d — Right Panel Catalog Rebuild ✅

**Completed:** 2026-04-18

### What was done

**`src/app/builder/page.tsx`** — right panel fully replaced. State simplified.

**Removed:**
- `ProductRow` component (inline list row with swatches — replaced by 2-col grid cards)
- `aiMatch` state variable (dropped per design spec)
- `slotProducts` / `slotScores` derived memo (replaced by `catalogProducts`)

**Added:**
- `CATALOG_CHIPS` constant — 6 entries: All, Outerwear, Tops, Bottoms, Shoes, Accessories (each maps to `SlotId | null`)
- `catalogCategory: SlotId | null` state (null = show All products)
- `catalogProducts` derived memo — filters by `catalogCategory`, `search`, `likedOnly`

**Updated:**
- `selectProduct` — now auto-routes by `product.category` into the correct slot via `SLOTS.find(s => s.categories.includes(product.category))`. Also calls `setActiveSlot(slotId)` to sync the canvas ring. Toggling the same product deselects it.
- Left panel slot row `onClick` — now calls `setCatalogCategory(slot.id)` alongside `setActiveSlot(slot.id)`
- Canvas figure zone `onClick` — now calls `setCatalogCategory(id)` alongside `setActiveSlot(id)`
- Canvas accessories button `onClick` — same dual sync

**New right panel layout:**
1. **Search input** (38px height, left search icon, right × clear)
2. **Category chips** (pill style, overflow-x-auto, horizontal scroll): All / Outerwear / Tops / Bottoms / Shoes / Accessories
3. **Count + Liked toggle** (below chips, above product grid separator)
4. **2-column product grid** (scrollable, `gap-3 p-3`):
   - Each card: 3/4 aspect image (`object-cover`, `group-hover:scale-105`) + product name + brand / price row
   - Selected state: `outline outline-1 outline-[var(--foreground)]` + checkmark circle badge (top-right of image)
   - Clicking a card calls `selectProduct(product)` → auto-routes to correct slot

### Phase 3d — ✅ Done

### Phase 3e — ✅ Complete (2026-04-18)

**What was done — `src/app/builder/page.tsx`:**

- Added `ChatMessage` interface, `QUICK_REPLIES` constant, `generateMockReply()` pure function (module level)
- Added chat state: `chatMessages`, `chatInput`, `chatLoading`, `chatThreadRef`
- Added `sendMessage()` action — appends user message, simulates 900–1400ms delay, calls `generateMockReply`, appends AI reply
- Added `useEffect` auto-scroll — scrolls `chatThreadRef` to bottom after each message or loading state change
- Replaced drawer placeholder body + input with:
  - Scrollable thread (`ref={chatThreadRef}`) — user bubbles right/dark, AI bubbles left/surface
  - AI suggestion strips — horizontal scroll of 72px product cards (clickable via `selectProduct`, shows selected state checkmark)
  - Typing indicator — 3 staggered `animate-bounce` dots while loading
  - Quick-reply chip strip — 4 preset prompts call `sendMessage` directly
  - Composer — controlled input, Enter to send, send SVG button, disabled during loading
- AI drawer: welcome message pre-populates thread so drawer is never empty on open

---

### Phase 3f — ✅ Complete (2026-04-18)

**What was done — `src/app/builder/page.tsx`:**

**Structural changes:**
- Desktop 3-col grid: changed from `h-full grid grid-cols-1 md:grid-cols-[...]` → `hidden md:grid md:h-full md:grid-cols-[...]`
- Footer: added `hidden md:flex` — replaced by mobile bottom bar on small screens
- AI drawer: `w-[380px]` → `w-full md:w-[380px]` — full-width on mobile (covers full panel like a sheet)

**New mobile layout (`md:hidden h-full flex flex-col overflow-hidden`):**

1. **Mini canvas (220px)** — condensed silhouette with 140px main figure (FIGURE_SLOTS, same proportions) + 36×44px accessories panel; canvas label overlay with Look number + Clear button (pointer-events-auto within pointer-events-none parent)
2. **Slot strip** — horizontal scrollable row of 5 slots (52×64px thumbnails); active slot highlighted with ring; selected items show product image + × remove button (avoids nested `<button>` via `role="button"` div); short labels (Out/Top/Bot/Shoes/Acc)
3. **Search input** — full-width, 38px, shared search state with desktop
4. **Category chips** — pill row, horizontal scroll, shared `catalogCategory` state
5. **Count + liked toggle** — same as desktop right panel
6. **Product grid** — flex-1 overflow-y-auto, 2-col, same `catalogProducts` memo, same `selectProduct` auto-routing
7. **Mobile bottom bar** — Total (Fraunces display font) + Save + "Shop · $X" inverted CTA

**Mobile AI drawer:** full-width overlay (w-full), slides in from right, × closes it. Chat thread, suggestions, quick-reply chips, and composer all work identically to desktop.

**Mobile interaction model:**
- Tapping a canvas zone or slot strip item: sets `activeSlot` + `catalogCategory` (syncs chip filter + ring)
- Tapping a product card: auto-routes to correct slot, updates canvas and slot strip
- Tapping × on slot strip card: removes item from that slot
- Scrolling: only the product grid scrolls; canvas + slot strip + search + footer are fixed in the flex column
- Stylist button in header: opens full-width AI drawer overlay

---

### Phase 4 — ✅ Complete (folded into Phase 3f)

**QA checks applied:**
- Nav height offset: `pt-16` on outer div matches `h-16` fixed nav — verified
- Desktop 3-col grid `hidden md:grid` preserves all desktop behavior
- AI drawer z-index 20 overlays both desktop and mobile layouts correctly
- Slot strip uses `role="button"` div to avoid nested button HTML validity issue
- Scrollbar width (3px) from globals.css applies to all scroll regions
- Empty states, liked toggle, category routing verified to work identically on mobile

---

## Manual QA Checklist (final browser testing)

### Mobile (< 768px viewport)
- [ ] Canvas shows 5-slot silhouette at 220px height, empty and filled states
- [ ] Tapping canvas zone updates slot strip ring + catalog chip filter
- [ ] Slot strip scrolls horizontally; × remove button works; thumbnails update on selection
- [ ] Search filters catalog in real time
- [ ] Category chips filter to correct products
- [ ] Tapping a product routes to correct slot (no slot pre-selection needed)
- [ ] Mobile bottom bar: Total updates, Save button works, "Saved ✓" feedback shown
- [ ] AI Stylist button opens full-width drawer; × closes it
- [ ] Chat: quick-reply chips send messages; typing + Enter sends; typing indicator shows; suggestions are tappable and add to outfit
- [ ] Dark mode: all panels, canvas empty states, mobile drawer render correctly

### Desktop (≥ 768px viewport)
- [ ] 3-column layout: left panel, canvas, right catalog all visible
- [ ] Canvas silhouette slot zones: hover overlays, variant swatches, info strip, × remove all work
- [ ] Left panel: slot rows update on selection; total price updates
- [ ] Right panel: search, chip filter, 2-col grid, checkmark badge all work
- [ ] Footer: Generate (≥2 pieces), Save/Saved ✓, View →, Shop the Look CTA
- [ ] AI drawer: 380px, slides in from right, chat thread scrolls, suggestions clickable
- [ ] Stylist pill inverts when drawer is open

### Cross-cutting
- [ ] Font rendering: Fraunces italic for GOO wordmark and prices; JetBrains Mono for all labels/buttons
- [ ] Light mode: warm cream background (#F4F2EE), all borders/text legible
- [ ] URL persistence: selection survives page reload (search params)
- [ ] Generate modal: opens on button click (requires ≥2 pieces), download and regenerate work
- [ ] No layout flash on initial load (dark class in `<html>` prevents FOUC)

---

## Builder Migration Status: ✅ FUNCTIONALLY COMPLETE

All phases of the RUNWAY redesign are implemented. The builder has full desktop 3-column layout and a complete mobile stacked flow. The AI Stylist drawer works on both breakpoints with mock chat. URL persistence, category routing, variant swatches, and all actions (generate, save, share, clear) are functional.

---

## Risks Introduced by Phase 3a

1. **Left panel shows old 4-slot system** — the new RUNWAY design calls for 5 slots (outerwear, top, bottom, shoe, accessory). The current stub uses the existing 4-slot `SLOTS` array. This is temporary but means "outerwear" isn't visible in the left panel until Phase 3b adds the 5-slot mapping.

2. **Right panel still slot-tab based** — clicking a product in the right panel still requires selecting a slot first (activeSlot). In the final design, the right panel catalog routes products to their natural category slot automatically. This will be fixed in Phase 3d.

3. **Mobile panels hidden** — left and right panels are `hidden md:flex`. On mobile, only the center canvas and footer are visible. This is temporary until Phase 3f.

4. **AI drawer overlays 3-column body only** — the drawer covers from below the builder sub-header to above the footer. This means the sub-header and footer remain accessible while the drawer is open. This matches the final RUNWAY design intent but differs from the prototype which overlays the entire frame.

5. **Center canvas still 2×2 grid** — the 2×2 is functional and preserves all existing UX (hover overlays, variant swatches). It will be replaced with the outfit silhouette in Phase 3c; the transition should be smooth.

---

## Recommended Next Prompt

```
Read PROJECT_ANALYSIS.md, IMPLEMENTATION_PLAN.md, BUILD_PROGRESS.md, and CLAUDE.md first.

Now execute only Phase 3e: AI Stylist drawer chat UI for the builder.

Scope:
- Replace the drawer placeholder with a working chat UI shell (mock data, no real API wiring)
- Scrollable message thread: user bubbles right / AI bubbles left
- AI messages may include a 4-item horizontal suggestion strip (mini product cards, clickable to select)
- Quick-reply pills below the thread: "Warmer", "Sharper", "Under $500"
- Message input (functional state — user can type and hit ⏎ to append a mock message)
- Keep the drawer shell (header, animate-slide-in-right, shadow) intact from Phase 3a
- Entry animation already defined: animate-slide-in-right

Do not do these yet:
- do not wire real AI/API responses to the drawer
- do not do the mobile phase yet
- do not redesign unrelated pages

Key constraints:
- The drawer is absolute within the body wrapper (does not overlay site nav)
- `aiOpen` state is already defined and toggles the drawer
- Product list is available via the `products` state array for suggestion strips
- Keep suggestion strip clicks wired to `selectProduct(product)` for real selection behavior

When done update BUILD_PROGRESS.md.
```

---

(old Phase 3d next prompt archived below)

```
Read PROJECT_ANALYSIS.md, IMPLEMENTATION_PLAN.md, BUILD_PROGRESS.md, and CLAUDE.md first.

Now execute only Phase 3d: right panel catalog rebuild for the builder.

Scope:
- Replace the current slot-tab + ProductRow picker in the right panel with the full
  category catalog as described in IMPLEMENTATION_PLAN.md step 3.5
- Search input (full-width, 38px height, search icon + clear ×)
- Category chips: All / Outerwear / Tops / Bottoms / Shoes / Accessories (pill style)
- 2-column product grid (3/4 aspect ratio cards, checkmark on selected)
- Clicking a product auto-routes it to the correct slot based on product.category (no activeSlot tab needed)
- Keep the activeSlot state wired to the canvas: clicking a zone in the center canvas
  still filters the right panel to that category
- Price filter and sort are optional — implement if clean, skip if it would bloat scope

Do not do these yet:
- do not fully implement the AI drawer conversation UI
- do not do the mobile phase yet
- do not redesign unrelated routes/pages

Key constraints:
- product.category is a single Category string (not array) — mapping is in SLOTS constant
- The 5-slot SLOTS array is the source of truth for category → slot routing
- activeSlot still drives canvas ring highlight and right panel context
- ProductRow component can be removed once the 2-col grid replaces it
```

---

## Follow-up Phase A — Canvas Balance + Decorative Cleanup + Generate Threshold ✅

**Completed:** 2026-04-18

### What was done

**`src/app/builder/page.tsx`** — 4 targeted changes, no logic rework.

**1. Canvas top bar — removed decorative circle controls**
Removed the `○ ◐ ●` button row from the canvas top bar. These had no `onClick` handlers and gave users no feedback when tapped. The canvas top bar is now a single left-aligned "Look —" / "Look 007" mono label. The `justify-between` flex direction changed to simple `flex items-center` since there is no right-side content.

**2. Silhouette canvas — reduced visual dominance**
- `py-6 px-4` → `py-8 px-6`: increased padding around the silhouette for a more editorial framing
- `max-h-[560px]` → `max-h-[460px]`: silhouette height reduced by 100px (~18%), making the canvas panel feel proportional rather than stretched on typical desktop heights (768–900px)

These changes leave the `1fr` grid column and panel background intact — the panels remain full-bleed. The canvas area has the same footprint, but the silhouette is better framed within it.

**3. Desktop footer — Generate threshold lowered**
`selectedCount >= 2` → `selectedCount >= 1`. The Generate button now appears as soon as one piece is selected. The API already accepts 1+ pieces (validation in `/api/generate-outfit/route.ts` is `pieces.length < 1`), so the frontend was more conservative than necessary. A single-item generation produces a focused editorial shot of that item.

**4. Mobile bottom bar — Generate added**
Added an icon-only Generate button (star SVG, 36×36px square) between the total and Save button. Appears when `selectedCount >= 1`, same condition as desktop. Shows a spinning indicator while generating. Uses `aria-label="Generate outfit image"` for accessibility. The compact icon keeps the mobile bar from becoming crowded.

### Visual tradeoffs

- The reduced `max-h-[460px]` means on very tall viewports (1200px+ height) the silhouette won't stretch to fill the vertical space as much. This is intentional — the previous stretch created an awkward aspect ratio on the slot zones.
- The `px-6` side padding on the silhouette zone slightly reduces effective canvas width (was `px-4`), but since the silhouette container is a fixed 320px centered within the zone, the visual padding is only background-color surface, not functional space.
- The mobile Generate icon has no text label. Users unfamiliar with the star icon may not immediately understand it triggers AI generation. A tooltip or a text label on first use could help — tracked as a follow-up.
