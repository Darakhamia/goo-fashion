# PROJECT ANALYSIS — GOO Fashion

_Generated 2026-04-18 based on the GOO Outfit Builder design handoff bundle._

---

## 1. Project Structure Overview

```
src/
├── app/                         # Next.js App Router
│   ├── layout.tsx               # Root layout (Clerk, ThemeProvider, LikesProvider)
│   ├── globals.css              # All CSS variables, animations, utility classes
│   ├── page.tsx                 # Homepage
│   ├── stylist/page.tsx         # Multi-step AI stylist wizard
│   ├── builder/page.tsx         # Outfit builder (current 2-panel design)
│   ├── browse/                  # Browse outfits/products
│   ├── saved/                   # Saved looks & likes
│   ├── outfit/[id]/             # Single outfit detail
│   ├── product/[id]/            # Single product detail
│   ├── profile/                 # User profile (Clerk-protected)
│   ├── plans/                   # Pricing tiers
│   ├── admin/                   # Admin CRUD (protected)
│   └── api/                     # API routes (generate-outfit, products, outfits, brands…)
├── components/
│   ├── layout/
│   │   ├── ConditionalSiteLayout.tsx
│   │   ├── Navigation.tsx
│   │   └── Footer.tsx
│   ├── outfit/
│   │   ├── OutfitCard.tsx
│   │   ├── OutfitCollage.tsx
│   │   └── OutfitActions.tsx
│   ├── product/
│   │   ├── ProductCard.tsx
│   │   ├── ProductGallery.tsx
│   │   └── ProductClient.tsx
│   └── ui/
│       └── SectionLabel.tsx
├── lib/
│   ├── context/                 # ThemeProvider, LikesProvider, AuthProvider
│   ├── data/                    # db.ts (Supabase), outfits.ts, products.ts
│   ├── services/                # nikeApi.ts
│   ├── supabase.ts
│   └── types.ts
public/                          # Static assets
```

**Tech stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, Clerk auth, Supabase, OpenAI SDK.

---

## 2. Where Stylist and Builder Are Implemented

| Page | File | Route |
|---|---|---|
| AI Stylist | `src/app/stylist/page.tsx` | `/stylist` |
| Outfit Builder | `src/app/builder/page.tsx` | `/builder` |

Both are self-contained single-file page components (no sub-components extracted). The navigation links to both via `Navigation.tsx`.

### Stylist (`/stylist`)

A 6-step wizard + result step:

1. Occasion (casual, work, evening, formal, weekend, sport)
2. Style keywords (12 aesthetic chips)
3. Color palette (12 palette options with 4-color swatches)
4. Fit preference (4 options)
5. Season (4 options)
6. Budget (6 presets with price ranges)
7. **Result**: Filters `outfits.ts` by occasion, shows 4 OutfitCards after a 2.4s fake-generation animation.

State is local (`useState`). No API call — uses static outfit data. The "Regenerate" button resets to step 1.

### Builder (`/builder`)

Two-panel layout with `h-screen`:

- **Left panel (240–300px):** Product picker sidebar — 4 slot tabs (top/bottom/shoes/accessories), search input, liked-only toggle, AI-match sort, scrollable `ProductRow` list.
- **Right panel (flex-1):** 2×2 canvas grid. Each cell shows selected product image with hover overlay (brand, name, price, color swatches, remove). Active slot has ring border.
- **Bottom bar:** Total price + style tags (left), Generate + Save + View buttons (right, when ≥2 pieces selected).
- Selection synced to URL params for shareable links.
- "Generate" calls `POST /api/generate-outfit` (DALL-E 3 / GPT-Image 1) and opens a full-screen image modal.
- "Save" persists to `localStorage` as `goo-saved-outfits`.

---

## 3. Components, Routes, Layouts, and Styles That Affect Them

### Shared layout

- **`src/app/layout.tsx`** — wraps both pages with `ClerkProvider`, `ThemeProvider`, `AuthProvider`, `LikesProvider`, and `ConditionalSiteLayout`.
- **`ConditionalSiteLayout.tsx`** — renders `Navigation` + `Footer` unless the pathname is `/admin`, `/login`, or `/register`. Both `/stylist` and `/builder` receive the full nav/footer.
- **`Navigation.tsx`** — fixed header with links to "Stylist", "Browse", "Builder", "Plans". Changes in builder layout that affect `h-screen` must account for the navigation height (currently ~56px fixed).

### Styles

- **`src/app/globals.css`** — the only CSS file. Controls all CSS variables (colors, fonts), HTML/body defaults, animation keyframes, and utility classes. Font changes must be made here.
- **Tailwind v4** — utility classes throughout both pages. No `tailwind.config.js` — Tailwind is configured via PostCSS.

### Components used inside builder/stylist

| Component | Used in |
|---|---|
| `OutfitCard` | Stylist results step |
| `ProductRow` (inline in builder) | Builder picker panel |
| `useLikes` context | Builder (likedOnly filter) |
| `useTheme` context | Both (dark mode awareness) |

---

## 4. Font System Currently Used

**No external fonts are loaded.** The entire site uses system font stacks declared as CSS variables in `globals.css`:

```css
--font-body:    -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif;
--font-display: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif;
```

- `body` uses `var(--font-body)`, 14px, line-height 1.6, letter-spacing 0.01em.
- Display headings use `.font-display` (a global utility class that applies `var(--font-display) !important`).
- No Google Fonts, no `next/font`, no `@font-face` declarations.
- Letter-spacing used extensively for uppercase editorial labels (0.08em–0.22em).

---

## 5. Where Global Typography Is Configured

All typography configuration lives in **one place**: `src/app/globals.css`.

- `--font-body` and `--font-display` CSS variables (lines 5–6)
- `body { font-family: var(--font-body); font-size: 14px; … }` (lines 52–59)
- `.font-display { font-family: var(--font-display) !important; }` (lines 61–63)
- No Tailwind `fontFamily` extensions — fonts are applied exclusively via CSS variables and the `.font-display` class.

`src/app/layout.tsx` contains no `<link>` tags or `next/font` imports for fonts — confirming zero external font loading today.

---

## 6. Which Parts of the New Design Are Relevant to Implement

The design handoff (`GOO Outfit Builder.html`) delivers the **RUNWAY direction** as the chosen design. Key elements to implement:

### A. New font trio (global change)
- **Fraunces** — variable serif (opsz 9–144, wght 300–700), used for `GOO` logo, display headings, piece-count labels, total price.
- **Inter Tight** — grotesque sans (wght 300–800), used for all UI text (nav, product names, prices, form labels, buttons).
- **JetBrains Mono** — monospace (wght 300–600), used for micro-labels (`UPPER · CASE · TAGS`), sort/filter text, inline identifiers.

### B. Builder page — complete layout restructure

**Desktop (3-column grid):**
- **Left 300px** — "In this look": per-category slot rows (thumbnail 60×74 + label + name/brand + price), total price at bottom.
- **Center (flex-1)** — Outfit silhouette canvas (`GooOutfitSilhouette`): layered rectangular placeholder blocks, `Look 007` mono label, light/dark toggle icons.
- **Right 360px** — Catalog with: search input, category chips (pill style), price range slider + sort toggle, 2-column product grid (3/4 aspect, checkmark on selected).

**AI Stylist drawer** — slides in from the right over the entire layout (380px wide), toggled by a pill button in the header. Contains: avatar, chat bubbles, suggestion thumbnails, quick-reply pills, message input.

**Header**: `GOO` logo (Fraunces italic), nav tabs (Feed / Create / Saved), Stylist pill button, Publish pill button.

**Footer bar**: "X pieces · Y brands" left, "Shop the Look $$$" right (inverted pill CTA).

**Mobile:**
- Header → Outfit image (260px hero) → Horizontal slot strip → Search + category chips → 2-column product grid → Floating bottom bar (`Total` + `Shop →` pill, `position: absolute` at bottom 34px).

### C. Color token alignment
Current light-mode background is `#FAFAF8`; the design uses `#F4F2EE`. The CSS variable token names can stay but values need updating. Dark mode already matches (`#0A0A0A`).

### D. Stylist page typography update
No layout restructure required for the stylist wizard, but it should receive the new fonts (Fraunces for headings, Inter Tight for body, JetBrains Mono for step labels and micro-text).

---

## 7. What Should Be Replaced vs. Reused

### Replace entirely
| What | Why |
|---|---|
| Builder page layout (2-panel → 3-column) | Fundamentally different information architecture |
| `--font-body` / `--font-display` CSS vars | New font trio replaces system-font stacks |
| `body { font-family }` declaration | Must reference new Inter Tight |
| Light-mode background color (`#FAFAF8` → `#F4F2EE`) | Token alignment with design |

### Rewrite substantially
| What | Why |
|---|---|
| Builder left panel | From slot-tabs+product-list to per-category slot rows |
| Builder right panel | From 2×2 canvas to center silhouette + separate catalog panel |
| Builder bottom bar | "Shop the Look" CTA replaces Generate/Save buttons |

### Reuse with additions
| What | What to add |
|---|---|
| `globals.css` color variables | Add `--font-mono`, update font var values, update `#FAFAF8` |
| Navigation.tsx | No structural change; font will update globally |
| Footer.tsx | No structural change |
| `ConditionalSiteLayout.tsx` | No change needed |
| Stylist page structure (6-step wizard) | Only typography classes need updating |
| All other pages (browse, saved, home, etc.) | Font update is automatic via CSS variables |
| `useLikes`, theme context, URL persistence logic | Keep in builder rewrite |
| `/api/generate-outfit` | Keep; wire to new "Generate" trigger if retained |

### Drop
- The inline `ProductRow` component inside builder (replaced by slot-row and catalog-card patterns).
- The 4 slot-tab icons (slot selection is now implicit via catalog category chips).
- The "AI Match" sort toggle in current builder (replaced by stylist drawer suggestions).

---

## 8. Risks, Dependencies, and Edge Cases

### Fonts
- **Google Fonts availability**: The design loads Fraunces, Inter Tight, and JetBrains Mono from `fonts.googleapis.com`. These must be added via `<link>` in `layout.tsx` or via `next/font/google`. Prefer `next/font/google` for performance (self-hosted, no layout shift).
- **Variable font axes**: Fraunces uses `opsz` and `wght` axes. Tailwind v4 doesn't auto-generate optical-size utilities; these must be applied via inline styles or custom CSS utility classes where needed.
- **Fallback chain**: Until fonts load, Fraunces fallback is Georgia/serif and Inter Tight fallback is system-ui. Line-height and letter-spacing may shift slightly on first paint; `font-display: swap` is recommended.

### Builder layout
- **`h-screen` and fixed nav**: The current builder uses `h-screen` minus the fixed navigation height. The new 3-column layout must maintain this — verify the nav height offset is correct (currently implied by `pt-14` or equivalent).
- **Overflow in left/right panels**: Both side panels need `overflowY: auto` (scoped scrolling). Test that the center canvas doesn't scroll — it should fill available height.
- **Mobile breakpoint**: The 3-column desktop layout collapses to a stacked mobile layout. The mobile design is a completely different flow (top image, horizontal items strip, scrollable catalog grid). This requires responsive logic, not just column-collapsing.
- **Product data shape**: The design prototype uses a simplified `GOO_CATALOG` with `cat` values `outerwear/top/bottom/shoe/accessory`. The real Supabase products use `categories` array (e.g. `["tops", "knitwear"]`). The slot-to-category mapping must be remapped.
- **Placeholder images**: The design uses neutral striped placeholders. The real builder uses actual `product.imageUrl`. The catalog grid and slot rows should show real images (or a placeholder if null).

### AI Stylist drawer
- The current site has a real AI generation endpoint (`/api/generate-outfit`). The new drawer is primarily a chat UI. Wiring real AI responses to the drawer is out of scope for this migration (the drawer can remain UI-only with mock messages initially).
- The drawer overlays the right catalog panel. On narrow viewports, confirm it doesn't obscure usable content.

### Stylist page
- The wizard uses `OutfitCard` for results — this component is unchanged. Typography update only.
- Budget presets and palette swatches are hardcoded. No data dependency risk.

### Other pages
- Font change via CSS variables propagates automatically to all pages (browse, home, saved, product, outfit detail, admin). Test all pages for visual regressions after font swap.
- The `.font-display` utility class will now render Fraunces instead of Palatino everywhere it's used — verify heading hierarchy looks correct on the homepage, browse, and outfit detail pages.

---

## 9. Concise Migration Summary

The migration has two independent tracks that can be executed sequentially:

**Track 1 — Global fonts** (lower risk, high visual impact):
Replace the system font stacks in `globals.css` with Fraunces + Inter Tight + JetBrains Mono loaded via `next/font/google`. Update `--font-body` and `--font-display` CSS variables, add `--font-mono`. Update the light-mode background token from `#FAFAF8` to `#F4F2EE`. All pages inherit the new type system automatically.

**Track 2 — Builder page restructure** (higher risk, contained to `/builder`):
Rewrite `src/app/builder/page.tsx` to implement the RUNWAY 3-column layout: left panel (slot rows showing selected items + total), center panel (outfit silhouette canvas), right panel (search/filter/catalog grid). Add an AI Stylist slide-in drawer. Implement a responsive mobile layout. Preserve URL persistence, likes integration, and the generate-outfit API call.

The Stylist page (`/stylist`) requires only typography class updates — no layout restructure.
