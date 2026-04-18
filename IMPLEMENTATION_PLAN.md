# IMPLEMENTATION PLAN — GOO Outfit Builder Redesign

_Target: Replace the builder flow with the RUNWAY design and update fonts globally._

---

## Phase 1 — Global Font System

### Step 1.1 — Load new fonts via `next/font/google`

**File:** `src/app/layout.tsx`

Add three Google Font imports using `next/font/google` (self-hosted, zero layout shift):
- `Fraunces` — variable, axes: `opsz` (9–144), `wght` (300–700), `ital` (0–1)
- `Inter_Tight` — variable, `wght` (300–800)
- `JetBrains_Mono` — variable, `wght` (300–600)

Inject each as a CSS variable on `<html>`:
```
fraunces.variable → --font-fraunces
interTight.variable → --font-inter-tight
jetbrainsMono.variable → --font-mono
```

### Step 1.2 — Update `globals.css` font variables

**File:** `src/app/globals.css`

Replace:
```css
--font-body:    /* system stack */
--font-display: /* Palatino stack */
```
With:
```css
--font-body:    var(--font-inter-tight), "Inter Tight", system-ui, sans-serif;
--font-display: var(--font-fraunces), "Fraunces", Georgia, serif;
--font-mono:    var(--font-mono), "JetBrains Mono", ui-monospace, monospace;
```

Add a `.font-mono` utility class mirroring `.font-display`.

### Step 1.3 — Update light-mode background token

**File:** `src/app/globals.css`

Change `--background: #FAFAF8` → `--background: #F4F2EE` in `:root`.

Update the pre-computed overlay variables that reference the old value:
- `--bg-overlay-90`: `rgba(244, 242, 238, 0.90)`
- `--bg-overlay-95`: `rgba(244, 242, 238, 0.95)`

### Step 1.4 — Visual regression check across all pages

Manually verify these pages after font + color change:
- `/` (homepage — display headings, hero)
- `/browse` (product/outfit cards, filter labels)
- `/stylist` (step labels, palette names, button text)
- `/outfit/[id]` (detail page headings)
- `/product/[id]` (product name, price, specs)
- `/saved` (section headings)
- `/plans` (plan names, price display)

---

## Phase 2 — Stylist Page Typography

### Step 2.1 — Update heading classes on stylist page

**File:** `src/app/stylist/page.tsx`

- Replace any `font-display` heading usage with `font-display` (already correct — will now render Fraunces).
- Add `font-mono` class to step counter labels (e.g. "Step 1 of 6"), palette chip mono labels, budget range micro-text.
- Update letter-spacing on uppercase micro-labels to match design spec (1.5–2 tracking units → `tracking-widest`).

No layout changes required for the stylist page.

---

## Phase 3 — Builder Page Restructure

### Step 3.1 — Scaffold the new 3-column shell

**File:** `src/app/builder/page.tsx` (full rewrite)

Create the outer layout grid:
```
<div className="h-screen flex flex-col overflow-hidden">
  <BuilderHeader />
  <div className="flex-1 grid grid-cols-[300px_1fr_360px] min-h-0 overflow-hidden">
    <LeftPanel />
    <CenterCanvas />
    <RightPanel />
  </div>
  <BuilderFooter />
</div>
```

Preserve existing state variables: `selection`, `variantOverrides`, URL persistence logic, `useLikes`, theme context.

### Step 3.2 — Build `BuilderHeader`

Inline in builder page:
- Left: `GOO` logo in Fraunces italic (32px, weight 300) + nav tabs: Feed / **Create** / Saved (12px, uppercase, 1.5 tracking; active tab underlined)
- Right: "Stylist" pill button (toggles AI drawer, with pulsing dot indicator) + "Publish" inverted pill button
- Border-bottom matching `var(--border)`

### Step 3.3 — Build `LeftPanel` (Items in this look)

Replaces the current slot-tab + product-list panel:
- Header: mono label "In this look" + piece count in display font
- Per-category slot rows (one row per category: outerwear, top, bottom, shoes, accessories):
  - 60×74px product image (or striped placeholder if empty)
  - Category label (mono, 10px, uppercase) + product name + brand
  - Price (right-aligned, 11px)
  - Minimum row height 80px, border-top between rows
- Footer: "Total" label + sum in display font (Fraunces, 26px weight 300)
- Panel is `overflowY: auto`

### Step 3.4 — Build `CenterCanvas`

Replaces the current 2×2 canvas grid:
- Background: `var(--surface)` (bg2 equivalent)
- Outfit silhouette: layered absolute-positioned placeholder blocks for Outer/Top/Bottom/Shoes/Acc — show striped pattern when slot filled, dashed border when empty
- Top-left mono label: "Look 007" (or generated name)
- Top-right: 3 small icon buttons for display modes (○ ◐ ●)
- Bottom center: mono label "Edit · Drag to reorder"
- Fills available space, no scroll

### Step 3.5 — Build `RightPanel` (Catalog)

Replaces the current canvas area's right portion:
- **Search input** (full-width, border, height 38px, search icon + clear ×)
- **Category chips** (pill buttons: All / Outerwear / Tops / Bottoms / Shoes / Accessories)
- **Price range + sort** (range slider for max price, "Sort · Trending ⇅" toggle link)
- Separator border below filters
- **Results count** (mono, 10px, uppercase)
- **2-column product grid** (gap 10):
  - Each card: 3/4 aspect ratio image (or placeholder), product name (11px, ellipsis), brand + price row
  - Selected state: `outline: 1.5px solid var(--foreground)` + checkmark badge (18px circle, top-right)
  - Click toggles slot — replaces existing item in same category
- Panel is `overflowY: auto`, padded

### Step 3.6 — Build `BuilderFooter`

Replaces current bottom bar:
- Left: "{N} pieces · {M} brands" (11px, muted)
- Right: "Shop the Look" + total price in inverted pill (height 42px, uppercase, 12px, letter-spacing 2)
- Border-top

### Step 3.7 — Build `AIStylistDrawer`

New component, overlays the full builder (position absolute, right 0, full height, width 380px):
- Only renders when `aiOpen === true`
- Header: Avatar circle (G, inverted) + "Stylist" label + "● Online" mono status + × close button
- Chat thread: scrollable list of message bubbles (user right / AI left), AI messages may include 4-item suggestion thumbnail strips
- Quick-reply pills: "Warmer", "Sharper", "Under $500"
- Input area: message input placeholder + ⏎ hint
- Entry animation: `gooFade` 240ms ease
- Shadow: `-20px 0 60px rgba(0,0,0,0.15)`

Keep messages as mock data initially (no real API wiring).

### Step 3.8 — Category mapping

Map new 5-slot categories to existing product `categories` array:

| New slot | Existing product categories |
|---|---|
| `outerwear` | `["outerwear"]` |
| `top` | `["tops", "knitwear"]` |
| `bottom` | `["bottoms", "dresses"]` |
| `shoe` | `["footwear"]` |
| `accessory` | `["accessories"]` |

Update the slot-toggle logic: selecting a product replaces any existing item in the same category group (matching current behavior, just with updated category names).

### Step 3.9 — URL persistence + edit mode

Preserve existing logic that syncs `selection` to URL search params (`?top=id&bottom=id…`). The param keys can stay the same; add `outerwear` as a new key. Restore selection on load.

### Step 3.10 — Responsive: mobile layout

Below `md` breakpoint, switch from 3-column grid to stacked mobile layout:
1. Header (logo + Stylist button)
2. Outfit hero image (fixed 260px height, `bg-surface`)
3. Horizontal items strip (scrollable row of 58×72px slot thumbnails with category labels)
4. Search input
5. Category chip row (horizontal scroll)
6. 2-column product grid (scrollable, `pb-28` for floating bar clearance)
7. Floating bottom bar (absolute, bottom 34px, full-width pill, `Total` + `Shop →`)

---

## Phase 4 — QA and Polish

### Step 4.1 — Cross-browser + dark mode check

- Verify builder in light and dark mode — all panels, drawer, product images, placeholder tiles.
- Verify hover states on catalog cards, slot rows, header buttons.
- Confirm `overflowY: auto` scrollbars are styled correctly (3px width from globals.css).

### Step 4.2 — Navigation height offset

Confirm the builder's `h-screen flex flex-col` layout correctly accounts for the fixed navigation height. If nav is `fixed` (currently `fixed top-0 z-50`), add `pt-14` (or the correct height offset) to the builder's outer container, or change the builder nav strategy.

### Step 4.3 — Font loading verification

- Confirm no FOUT (flash of unstyled text) with `font-display: swap`.
- Confirm Fraunces italic renders correctly for the logo (`<em>GOO</em>` or `font-style: italic`).
- Confirm JetBrains Mono renders at 9–11px sizes with correct `letter-spacing`.

### Step 4.4 — Stylist page final check

After font changes, re-verify the 6-step wizard renders correctly — step labels, palette swatches, budget chips, results grid — at both mobile and desktop breakpoints.

---

## File Change Summary

| File | Change type |
|---|---|
| `src/app/layout.tsx` | Add `next/font/google` imports, inject CSS vars on `<html>` |
| `src/app/globals.css` | Update font vars, add `--font-mono`, update `#FAFAF8` token, add `.font-mono` class |
| `src/app/builder/page.tsx` | Full rewrite (3-column layout, new components) |
| `src/app/stylist/page.tsx` | Typography class updates only |

No new files need to be created. No component files outside `builder/page.tsx` require structural changes.
