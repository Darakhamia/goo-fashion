# FOLLOWUP PLAN — GOO Post-Migration Improvements

_Created: 2026-04-18 — after RUNWAY migration (Phases 1–3f complete)_

---

## Summary Table

| # | Change | Size | Risk | Blocking dependencies |
|---|---|---|---|---|
| 1 | Reduce canvas visual dominance | Small | Low | None |
| 2 | Clean up builder header area | Small–Medium | Medium | Product decision: where does Stylist trigger live? |
| 3 | Useful filters in right catalog panel | Medium | Low | None |
| 4 | Generate available with fewer slots | Small | Low | None |
| 5 | "Shop the Look" meaningful behavior | Medium | Medium | Product decision: single modal vs tab-per-item |
| 6 | AI Stylist as site-wide real-API feature | Large | High | API key storage, catalog context design, placement decisions |

**Recommended execution order:** 1 → 4 → 3 → 2 (after decision) → 5 (after decision) → 6 (phased)

---

## Change 1 — Reduce Center Canvas Visual Dominance

### What the problem is

The center panel uses `flex-1` in a `grid-cols-[300px_1fr_360px]` layout. On a 1280px screen, the center receives ~620px of width. The silhouette container inside it is 320px wide with `max-h-[560px]`, centered in that space. The result is a large amount of empty `bg-[var(--surface)]` flanking a narrow silhouette — the canvas panel feels like it dominates the layout weight without earning it.

### What to change

- **Option A (recommended):** Give the center column a fixed or capped width, e.g. `grid-cols-[300px_minmax(0,440px)_360px]` with the grid centered using `justify-center` on the outer grid container. This keeps the panels proportional at any screen size.
- **Option B:** Shrink the `max-h` of the silhouette from `560px` to `440–480px` and increase `py` padding around it so the canvas zone feels intentionally editorial rather than stretched.
- **Option C:** Both — cap column width and reduce silhouette height.

The mobile canvas is already 220px and is fine; only desktop needs adjustment.

### Files involved

| File | Change |
|---|---|
| `src/app/builder/page.tsx` | Grid column definition (line ~513); canvas container `max-h` and `py` (line ~638) |

### Size / Risk

**Small.** Pure CSS/Tailwind layout — no logic changes. Low risk; fully reversible.

### What needs product/UX decision

None. This is a visual polish call. If there's a preference for a specific canvas width or silhouette height, state it explicitly. Otherwise, 440px column width + `max-h-[480px]` is a reasonable default.

---

## Change 2 — Clean Up Builder Header Area

### What the problem is

The builder currently renders two stacked navigation bars:

1. **Site nav** (`Navigation.tsx`, `h-16`, fixed) — GOO wordmark, links to Stylist / Browse / Builder / Plans, dark mode toggle, auth button.
2. **Builder sub-header** (`builder/page.tsx`, `h-12`, in-flow) — GOO wordmark again, Feed / Create / Saved tabs, Share / Clear utility buttons, Stylist pill.

This creates visual noise: the GOO logo appears twice, the nav links are partially redundant with the site nav, and the overall header zone feels cluttered at 128px tall (16 + 12 = 112px total, plus the fixed overlap).

Additionally, the canvas top bar contains three circle icon buttons (`○ ◐ ●`) that have no `onClick` handler. They were included from the RUNWAY mockup as display-mode toggles but were never wired to any behavior. Users who tap them receive no feedback.

### Three sub-problems

#### 2a — Duplicated wordmark and navigation

The builder sub-header's GOO wordmark is redundant with the site nav directly above it. The Feed / Create / Saved tabs offer tab-like navigation that partially overlaps the site-wide links.

**Options:**
- **Option A (recommended):** Remove the GOO wordmark from the builder sub-header; keep the Feed / Create / Saved context tabs and the utility buttons (Share, Clear). This makes the sub-header a pure context bar, not a nav bar.
- **Option B:** Remove the builder sub-header entirely and rely on the site nav. The Stylist toggle, Share, and Clear would need new homes (see 2c).
- **Option C:** Suppress the site-wide `Navigation` on the builder route (add `/builder` to the `isBarePage` list in `ConditionalSiteLayout.tsx`) and keep the builder sub-header as the only nav. This is the most design-coherent but loses the site nav's auth/theme controls.

#### 2b — Remove the ○ ◐ ● decorative controls

The three buttons in the canvas top bar (line ~624 in `builder/page.tsx`) have no behavior. They confuse users who expect them to do something (switch canvas layout? Toggle light/dark? Show product details?).

**Options:**
- **Option A (immediate):** Remove the button row entirely. The "Look 007" label stays; the right side of the canvas top bar is empty or replaced with a small icon that clears the canvas.
- **Option B:** Wire them to actual behavior before shipping: e.g., toggle between silhouette view / flat-lay grid / collage mode. This is a medium-sized feature, not a quick cleanup.

**Recommended:** Remove now (Option A), add meaningful display modes later as a separate feature.

#### 2c — Remove Stylist pill from builder inner header

The Stylist pill in the builder sub-header is currently the only way to open the AI drawer. If the sub-header is simplified (Change 2a), the pill needs a new trigger location.

**Options for where the trigger lives:**
- **Option A:** Add a "Stylist ●" button to the right panel header (above the search input), as a secondary panel action. Natural for a catalog-adjacent tool.
- **Option B:** Move it into the builder footer — right of Save, left of Shop the Look.
- **Option C:** Make the Stylist drawer trigger a floating action button (FAB) at a fixed position. More prominent, but introduces a new UI pattern not used elsewhere.
- **Option D:** Keep the Stylist pill in the sub-header but remove the GOO wordmark and tabs — making the sub-header a single-purpose row ("Create" label left, Stylist pill right).

### Files involved

| File | Change |
|---|---|
| `src/app/builder/page.tsx` | Sub-header JSX (lines ~444–506); canvas top bar buttons (lines ~623–633) |
| `src/components/layout/ConditionalSiteLayout.tsx` | Only if Option C for 2a is chosen |

### Size / Risk

**Small–Medium.** Removing elements is low-risk. The only medium-risk decision is the Stylist trigger relocation (2c) — it affects discoverability of a key feature.

### What needs product/UX decision

**Must decide before coding:**
- 2a: Which header simplification option?
- 2c: Where does the Stylist trigger live after the sub-header is cleaned up?

**Can implement without waiting:**
- 2b (remove ○ ◐ ● buttons) is unambiguous — do this immediately.

---

## Change 3 — Add Useful Product Filters to Right Catalog Panel

### What the problem is

The right catalog panel currently offers only: text search, category chips (slot filter), a count line, and a liked-only toggle. Users can't filter by price, brand, or style — the three most actionable product attributes. The `FilterState` type in `src/lib/types.ts` already defines the full filter schema (`priceMin`, `priceMax`, `brands[]`, `styleKeywords[]`, `sortBy`), so the data model is ready.

### What to add

**Tier 1 — High impact, low implementation cost:**
- **Max price slider** — single range slider (0 → max product price in catalog). Most products range $30–$2000+. State: `maxPrice: number | null`. Filter: `p.priceMin <= maxPrice`.
- **Sort toggle** — "Trending ⇅" / "Price ↑" / "Price ↓" / "Newest". State: `sortBy: "relevance" | "price-asc" | "price-desc" | "newest"`. Apply after all other filters.

**Tier 2 — Medium impact, medium cost:**
- **Brand filter** — multi-select dropdown or scrollable chip list. Available brands: the 15-brand `Brand` union type. State: `selectedBrands: Brand[]`. Filter: `selectedBrands.length === 0 || selectedBrands.includes(p.brand)`.
- **Style keyword chips** — secondary filter below category chips. Toggle one or more `StyleKeyword` values. Already available on every Product.

**Tier 3 — Lower priority:**
- **Color filter** — `/api/color-groups` endpoint exists and Product has `colorGroupIds`. Would require a fetch on mount. Skip for now.
- **Gender filter** — Product has `gender?: Gender`. Can be useful but most catalog items are unisex/women.
- **New arrivals toggle** — `p.isNew === true`. Simple but low utility without a full editorial strategy.

### Implementation approach

Add filter state to the component (or extract to a `useBuilderFilters` hook if the file grows too large). Extend the `catalogProducts` memo to apply sort + price + brand filters after the existing category/search/liked filters. Add a collapsible filter header row in the right panel between the chips and the count line.

**UI pattern:** a collapsed "Filters ⌄" row that expands to show price slider + brand chips. Count line shows `X results` in real time. A "Clear filters" link appears when any filter is active.

### Files involved

| File | Change |
|---|---|
| `src/app/builder/page.tsx` | New state vars; extended `catalogProducts` memo; filter UI JSX in right panel |
| `src/lib/types.ts` | No change needed — `FilterState` already covers required filters |

### Size / Risk

**Medium.** Mostly additive — new state and memo logic, new JSX rows. Risk is low. The only care needed is keeping the `catalogProducts` memo dependency array complete to avoid stale filters.

### What needs product/UX decision

- Should price filter use a **slider** (UX is tricky on mobile) or **preset buckets** (Under $100 / $100–$500 / $500+)?
- Should brand filter be an **inline chip scroll** (familiar pattern used in category chips) or a **dropdown**?
- Should filters persist across sessions (localStorage) or reset on page load?

---

## Change 4 — Generate Available With Fewer Slots Filled

### What the problem is

The Generate button currently renders only when `selectedCount >= 2` (desktop footer only; completely absent on mobile). The API route (`/api/generate-outfit`) already accepts `pieces.length >= 1` — the threshold is a frontend-only guard that is more restrictive than necessary. Additionally, the Generate action being hidden on mobile means the feature is invisible to the majority of users.

### What to change

1. **Lower threshold to 1:** Change `{selectedCount >= 2 && (` to `{selectedCount >= 1 && (` in both the desktop footer and the mobile bottom bar.
2. **Add Generate to mobile bottom bar:** Add the Generate button (with spinner state) between Save and Shop the Look in the mobile `shrink-0` bottom bar.
3. **Clarify the button label** when only 1 item is selected: "Generate Look" (current) is fine; optionally add a tooltip explaining that partial outfits are supported.

### API behavior note

The `generate-outfit` route constructs a DALL-E / gpt-image-1 prompt from whatever pieces are provided. With 1 piece the image will focus on that item. This is valid and can produce useful output (single-item editorial shots).

### Files involved

| File | Change |
|---|---|
| `src/app/builder/page.tsx` | `selectedCount >= 2` condition (line ~1167 desktop); mobile bottom bar (line ~1264) |

### Size / Risk

**Small.** One condition change + adding the button to the mobile bar. Risk is low — the API already handles 1 piece cleanly.

### What needs product/UX decision

None. The change is a straightforward UX improvement with no ambiguity.

---

## Change 5 — Clarify and Implement "Shop the Look"

### What the problem is

"Shop the Look" is currently a styled button that renders with the outfit total price but has **no onClick handler**. It is entirely decorative. The `Product` type has a `retailers: Retailer[]` field where each retailer has a `url: string` and `price: number`. The data needed to link out to real products exists in the catalog — it just isn't wired to the button.

### Available retailer data per product

```typescript
interface Retailer {
  name: string;
  url: string;
  price: number;
  currency: string;
  availability: "in stock" | "low stock" | "sold out";
  isOfficial: boolean;
}
```

Each product has at least one retailer. The `isOfficial` flag identifies the brand's own store vs. third-party resellers.

### Implementation options

**Option A — Modal with per-item shop links (recommended)**
Open a drawer/modal listing each selected product with: product thumbnail, name, brand, price, and a "Shop at [Retailer]" link that opens in a new tab. Show the preferred retailer first (`isOfficial: true` → official store; otherwise first by price). This gives users control and avoids browser tab-blocking issues.

**Option B — Open all retailer URLs in new tabs**
Call `window.open(url, "_blank")` for each product's primary retailer on click. Browsers block this for multiple simultaneous new tabs unless each open is triggered by a separate user interaction. Unreliable in practice.

**Option C — Navigate to a dedicated "checkout" page**
Create a `/shop/[outfitId]` or `/builder/shop` route that lists all items with retailer links. Adds a new route and navigation step. Most appropriate if affiliate tracking or analytics are needed per click.

**Option D — Affiliate link aggregation (future)**
If GOO monetizes via affiliate programs (e.g., Awin, ShareASale, Impact), the retailer URLs would need to be replaced with affiliate-tracked URLs. This is a business/infrastructure decision, not a UI decision.

### Recommended implementation path

Implement **Option A** with a simple modal. This unblocks the feature with minimal risk and leaves room for affiliate enhancement later without changing the UX surface.

The modal would reuse the existing modal shell from the generate-outfit flow (same backdrop, scale-in animation, × close).

### Files involved

| File | Change |
|---|---|
| `src/app/builder/page.tsx` | `onClick` on Shop the Look button; new `showShopModal` state; ShopModal JSX |
| `src/lib/types.ts` | No change — `Retailer` type already complete |

### Size / Risk

**Medium.** New state, new modal JSX, per-retailer link logic. Risk is low technically. The medium risk is UX: if retailer URLs in the database are stale or missing, the modal will show broken links. A data-quality check on the `retailers` field for catalog products should precede rollout.

### What needs product/UX decision

**Must decide before coding:**
- Which option (A/B/C)?
- For option A: which retailer is shown by default — official store, lowest price, first in array?
- Should availability status (`in stock` / `low stock` / `sold out`) be shown in the modal?
- Is affiliate link tracking needed from day one, or is a plain link acceptable?

---

## Change 6 — AI Stylist as a Site-Wide Real-API Feature

### Scope of what's being requested

This is a significant architectural change with five distinct sub-problems:

1. Wire the builder drawer to a real OpenAI chat API instead of mock replies
2. Make the AI Stylist accessible across the site (not builder-only)
3. Have the AI understand the store's actual product catalog
4. Manage the API key on the server side via the admin panel
5. Architect it cleanly enough to extend and maintain

### 6a — Real chat API backend

**Current state:** The builder drawer calls `generateMockReply()` (pure function, no network). The only OpenAI integration is `POST /api/generate-outfit` for image generation.

**What's needed:** A new `POST /api/stylist/chat` route.

**Request shape:**
```typescript
{
  messages: { role: "user" | "assistant"; content: string }[];
  context: {
    selection: { slot: string; productId: string; name: string; brand: string; priceMin: number; styleKeywords: string[] }[];
    catalogSummary?: string;  // injected server-side
  };
}
```

**Response shape:**
```typescript
{
  text: string;
  suggestedProductIds?: string[];  // IDs from the real catalog, not hallucinated names
}
```

**Implementation notes:**
- Use `openai.chat.completions.create` with `gpt-4o-mini` (fast, cheap, sufficient for styling advice).
- Key resolution: same pattern as `generate-outfit` — check `x-openai-key` header first, then `process.env.OPENAI_API_KEY`.
- Streaming is optional for v1 (non-streaming is simpler; add streaming in v2 if needed).

### 6b — Catalog-aware system prompt

**The core challenge:** The AI needs to suggest real products by ID, not hallucinate product names. Without access to the catalog, it will invent brands and items that don't exist.

**Three levels of catalog awareness:**

**Level 1 — Static context (simplest, implement first):**
Inject a static catalog summary into the system prompt: category names, brand list, price range, style keywords. The AI gives generic styling advice and style-keyword recommendations (not specific product IDs). The frontend then uses those style keywords to filter the real catalog and shows matching products as suggestions.

```
System prompt excerpt:
"You are an AI stylist for GOO, a curated fashion platform.
Available categories: outerwear, tops, bottoms, footwear, accessories, dresses, knitwear.
Available brands: Acne Studios, Balenciaga, Fear of God, Toteme, Lemaire, The Row, Jil Sander, Maison Margiela, A.P.C., COS, Arket, Massimo Dutti, Zara, & Other Stories, Nike.
Price range: $30–$3,000.
Style keywords: minimal, streetwear, classic, avant-garde, romantic, utilitarian, bohemian, preppy, sporty, dark, maximalist, coastal, academic.
When asked for product recommendations, respond with a style description and up to 3 style keywords from the above list.
The frontend will show matching products."
```

**Level 2 — Dynamic catalog summary (medium effort):**
Generate a catalog summary at request time: fetch brand counts, category counts, price ranges from the DB/API. Cache for 1 hour. Inject as a JSON block into the system prompt.

**Level 3 — Product-ID suggestions (most powerful, most complex):**
The AI returns specific product IDs, OR the frontend does a semantic/keyword search after the AI replies. Options:
- **Option A:** Include all product names+IDs in the context (only works for small catalogs — will exceed token limits for large catalogs).
- **Option B:** Vector embedding search — embed product descriptions at index time, embed user query at runtime, retrieve top-N matching products. Requires a vector DB (Supabase has pgvector). Medium-term goal.
- **Option C (recommended for v1):** AI returns style keyword tags → frontend filters catalog by those keywords using existing logic. This is what the mock already does (`generateMockReply` returns `suggestions: Product[]` based on `styleKeywords`). Keeps the AI layer thin.

### 6c — API key management on server side

**Current state:** The admin settings page (`/admin/settings/page.tsx`) saves the OpenAI key to **localStorage**. It's sent as an `x-openai-key` header on each generate request. This means:
- The key is only available in the browser that saved it.
- No key is set server-side by default (unless `OPENAI_API_KEY` env var is configured).
- The admin's key is not shared with other users — intentional for now.

**What's needed for a shared, production Stylist:**
- Store the key server-side in Supabase (a `settings` table with `key: "openai_api_key"`, `value: string`).
- The admin saves the key via the admin UI → it's persisted in Supabase.
- API routes read the key from Supabase (or the env var as fallback), not from request headers.
- The admin UI shows masked key + test button (already exists; just swap localStorage → Supabase).

**Security note:** OpenAI keys stored in a DB must be encrypted at rest or stored in a secrets manager. Storing in plain Supabase `text` column is acceptable for a development/small-scale deployment but not for production. This should be flagged explicitly.

**Files involved:**
- `src/app/admin/settings/page.tsx` — swap `localStorage.setItem` → `fetch('/api/admin/settings', { method: 'POST', body: { key: 'openai_api_key', value: apiKey } })`
- New: `src/app/api/admin/settings/route.ts` — GET/POST for settings (Supabase-backed, admin-auth-gated)
- `src/app/api/generate-outfit/route.ts` — add Supabase key fetch fallback
- New: `src/app/api/stylist/chat/route.ts` — chat endpoint, same key resolution

### 6d — Site-wide integration: where should the Stylist appear?

This is the highest-stakes product decision in this entire plan.

**Possible surfaces:**

| Surface | User intent | Implementation cost |
|---|---|---|
| Builder drawer (current) | "Help me complete this outfit" | Already exists — just wire to real API |
| Browse page sidebar or overlay | "Help me find something specific" | Medium — new component or reuse drawer |
| Product detail page | "What goes with this?" | Medium — can show context-aware suggestions |
| Outfit detail page | "Style advice on this look" | Medium — outfit item data available |
| Global floating chat widget | Anywhere on the site | Large — persistent state across routes, context switching |
| Dedicated `/stylist` assistant (upgrade current wizard) | Replace 6-step static flow with conversational AI | Large — replaces existing feature |

**Recommended approach:**
- **Phase 1:** Wire the existing builder drawer to the real API. Zero new surfaces.
- **Phase 2:** Extract the chat drawer into a reusable `<StylistDrawer>` component. Add it to the product detail page and browse page.
- **Phase 3:** Evaluate whether a global floating widget is warranted, or whether the current per-page drawer model is sufficient.

Avoid building a global floating widget before validating that users actually want multi-page AI context. The builder drawer is the right first deployment surface because outfit-building is the highest-intent context.

### 6e — Architecture diagram (recommended)

```
Admin Panel (/admin/settings)
  └─ POST /api/admin/settings → Supabase (settings table)

Builder Drawer / Chat Component
  └─ POST /api/stylist/chat
        ├─ Read OpenAI key: Supabase → env var → x-openai-key header
        ├─ Build system prompt: static catalog summary + outfit context
        ├─ openai.chat.completions.create (gpt-4o-mini)
        ├─ Parse reply: text + optional style keyword tags
        └─ Return { text, styleKeywords[] }
                └─ Frontend maps styleKeywords → products from catalogProducts state
```

### Files involved (full implementation)

| File | Change type |
|---|---|
| `src/app/api/stylist/chat/route.ts` | **New** — chat API route |
| `src/app/api/admin/settings/route.ts` | **New** — settings GET/POST |
| `src/app/admin/settings/page.tsx` | **Modify** — swap localStorage → Supabase API |
| `src/app/builder/page.tsx` | **Modify** — replace `generateMockReply` call with `fetch('/api/stylist/chat', ...)` |
| `src/lib/types.ts` | **Modify** — add `ChatRequest`, `ChatResponse` types |
| `src/app/api/generate-outfit/route.ts` | **Modify** — add Supabase key lookup |

Optional future files:
- `src/components/stylist/StylistDrawer.tsx` — extracted reusable component
- `src/lib/context/stylist-context.tsx` — if persistent cross-page state is needed

### Size / Risk

**Large.** This spans API routes, admin settings, a new Supabase table, and changes to how the OpenAI key is resolved everywhere. Risk is medium-high:
- **Key security risk:** Storing OpenAI keys in Supabase without encryption is acceptable for internal use but not for production.
- **Cost risk:** Real API calls cost money per chat message. Without rate limiting, a busy Stylist drawer could run up significant OpenAI charges.
- **Catalog hallucination risk:** Without proper product-ID grounding, the AI will suggest real-sounding but non-existent products. The Style-keyword-passthrough approach (Level 1) mitigates this.

---

## OPEN QUESTIONS

These items cannot be implemented confidently without explicit product decisions. Implementation should pause on each until answered.

---

### Q1 — Builder header: does the sub-header stay at all?

**Question:** Should the builder have its own sub-header bar, or should all navigation context live in the site nav?

**Why it matters:** The sub-header adds 48px of vertical space that compresses the builder panels. Removing it entirely recovers real estate. Keeping it (simplified) gives the builder its own context tab row.

**Options to choose from:**
- A: Keep sub-header; remove GOO logo; keep Feed/Create/Saved tabs; move Stylist trigger
- B: Remove sub-header entirely; move Stylist trigger + Share/Clear to footer or right panel
- C: Suppress site nav on `/builder`; use the sub-header as the only navigation bar

---

### Q2 — AI Stylist trigger location after sub-header cleanup

**Question:** If the Stylist pill is removed from the builder sub-header, where does the trigger live?

**Options:**
- Right panel header (next to search)
- Builder footer (between Save and Shop the Look)
- A floating action button
- Stays in sub-header (if sub-header is kept)

---

### Q3 — Product filter UX: slider vs. presets for price

**Question:** Price range filter — continuous slider or named buckets?

Buckets (Under $100 / $100–$500 / $500–$1,000 / $1,000+) are more mobile-friendly and require less state. A slider is more granular but harder to use on touch. Which does the product prefer?

---

### Q4 — Shop the Look: flow model

**Question:** When a user clicks "Shop the Look," what happens?

- **Modal listing each item with one buy link** — safest, most controllable
- **Open product detail pages** in the app (`/product/[id]`) rather than external links
- **New tabs to retailer URLs** — technically unreliable, browser may block

Additionally: when a product has multiple retailers, which is shown first — official store, lowest price, or alphabetical?

---

### Q5 — Shop the Look: affiliate tracking

**Question:** Does GOO have or plan to have affiliate partnerships with any retailers in the catalog?

If yes, retailer URLs need to be replaced with affiliate-tracked links before the Shop the Look feature can ship. This changes the data model (`retailers[].url` → affiliate URL per retailer) and may require a third-party affiliate SDK.

---

### Q6 — AI Stylist: shared server-side API key vs. per-user key

**Question:** Should there be one shared OpenAI key for all users (admin-configured), or should each user supply their own key?

**Current behavior:** The generate-outfit feature supports both — admin localStorage key OR `OPENAI_API_KEY` env var. There is no per-user key storage (Clerk user metadata is not used for this).

**Implications:**
- **Shared key (one admin key):** Standard SaaS model. GOO absorbs the API costs; users don't need to manage keys. Requires rate limiting to prevent abuse. The key should live in Supabase or as an env var, not localStorage.
- **Per-user key:** Current model for the Generate feature. Users bring their own key. No cost to GOO; friction for users; not appropriate for a polished consumer product.

---

### Q7 — AI Stylist site-wide surface: which pages?

**Question:** Beyond the builder drawer, on which pages should the AI Stylist be accessible?

Options (pick any/all):
- `/browse` — "Help me find something specific"
- `/product/[id]` — "What goes with this?"
- `/outfit/[id]` — "Style advice on this look"
- Global floating widget on all pages
- Dedicated upgrade of the `/stylist` 6-step wizard into conversational AI

This determines how much the Stylist drawer needs to be decoupled from the builder and whether a `StylistContext` shared across routes is needed.

---

### Q8 — Rate limiting for AI chat

**Question:** Is there a plan for rate limiting the AI Stylist chat once it's backed by a real API?

Without rate limiting, a single user can spam the chat endpoint and exhaust the API key quota in minutes. Acceptable approaches:
- Per-user message limits enforced via Clerk user ID + Supabase usage table
- Time-based throttle (X messages per minute per IP)
- Plan-gating (free users get N AI messages/month; Plus/Ultra get more)

The `UserProfile.plan` type (`"free" | "plus" | "ultra"`) already models tiered access. This suggests plan-gating was anticipated.

---

## Recommended Execution Phases

### Phase A — Quick wins, no product decisions needed (1–2 sessions)
- **Change 1:** Reduce canvas dominance (CSS only)
- **Change 4:** Lower Generate threshold to 1 piece; add Generate to mobile bottom bar
- **Change 2b:** Remove ○ ◐ ● decorative circle controls from canvas top bar

### Phase B — Filters and polish (1 session, no blocking decisions)
- **Change 3:** Add price slider, brand chips, sort toggle to right catalog panel

### Phase C — After product decisions on Q1/Q2 and Q4/Q5 (1–2 sessions)
- **Change 2a/2c:** Simplify builder header, relocate Stylist trigger
- **Change 5:** Implement Shop the Look modal with retailer links

### Phase D — AI Stylist v1: real API in builder drawer (2–3 sessions)
- Answer Q6 first (shared vs. per-user key)
- Create `POST /api/stylist/chat` with static catalog context + style keyword passthrough
- Update admin settings to store key in Supabase (or confirm env var is sufficient)
- Wire builder drawer to real API; replace `generateMockReply`

### Phase E — AI Stylist v2: site-wide (after validating Phase D)
- Answer Q7 (which pages?)
- Extract `<StylistDrawer>` as a reusable component
- Add to product detail and/or browse page
- Consider `StylistContext` if cross-page state persistence is needed
- Add rate limiting (answer Q8 first)

---

_End of FOLLOWUP_PLAN.md_
