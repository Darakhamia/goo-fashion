# PROJECT ANALYSIS — GOO Fashion

_Last updated: 2026-04-19. Purpose: a dense, factual snapshot of the codebase so a fresh Claude session can skip re-exploration. Keep this file updated when structure changes._

---

## 1. TL;DR

- **Stack**: Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS v4 · Clerk (auth) · Supabase (DB) · OpenAI SDK · Upstash Redis (rate-limiting).
- **Product**: AI-assisted fashion styling app. Users browse curated outfits/products, build outfits slot-by-slot, or generate outfits via AI (wizard or chat drawer).
- **Entry points worth reading first**:
  - `src/app/layout.tsx` — providers order
  - `src/app/builder/page.tsx` — most complex page
  - `src/app/stylist/page.tsx` — wizard flow
  - `src/lib/data/db.ts` — server data layer (Supabase + static fallback)
  - `supabase-schema.sql` — DB tables
  - `src/app/api/stylist/chat/route.ts` — AI chat endpoint with rate-limiting
  - `src/app/api/generate-outfit/route.ts` — image generation

---

## 2. Directory Structure (current)

```
src/
├── app/
│   ├── layout.tsx                  # ClerkProvider → ThemeProvider → AuthProvider → CartProvider → LikesProvider → ConditionalSiteLayout
│   ├── page.tsx                    # Homepage (hero + featured)
│   ├── globals.css                 # ALL css vars, fonts, utilities — single source of truth
│   ├── admin/                      # Admin dashboard (brands, products, outfits, users, settings)
│   ├── api/                        # see §4
│   ├── blog/                       # Static blog landing (hard-coded posts)
│   ├── browse/                     # Browse outfits+products (searchable grid)
│   ├── builder/page.tsx            # Outfit builder — 3-col layout + stylist drawer
│   ├── login/[[...sign-in]]/       # Clerk <SignIn/> catch-all
│   ├── register/[[...sign-up]]/    # Clerk <SignUp/> catch-all
│   ├── outfit/[id]/                # Outfit detail
│   ├── plans/                      # Pricing (Basic/Pro/Ultra)
│   ├── product/[id]/               # Product detail (images, colors, retailers)
│   ├── profile/                    # User profile (Clerk-protected)
│   ├── saved/                      # Saved outfits (likes context)
│   ├── stylist/page.tsx            # 6-step wizard → filters static outfits
│   └── subscribe/                  # Upgrade/checkout flow
├── components/
│   ├── admin/ImageCropEditor.tsx   # Admin product image crop tool
│   ├── layout/
│   │   ├── ConditionalSiteLayout.tsx  # Hides nav/footer on /admin, /login, /register
│   │   ├── Navigation.tsx
│   │   └── Footer.tsx
│   ├── outfit/                     # OutfitCard, OutfitCollage, OutfitActions
│   ├── product/                    # ProductCard, ProductGallery, ProductClient
│   ├── stylist/StylistDrawer.tsx   # AI chat drawer — embeddable on builder/browse/product
│   └── ui/                         # Generic UI (SectionLabel, etc.)
├── lib/
│   ├── context/
│   │   ├── auth-context.tsx        # Clerk user → { id, name, email, plan, isAdmin }
│   │   ├── cart-context.tsx        # Shopping cart state
│   │   ├── likes-context.tsx       # Saved outfits/products state
│   │   └── theme-context.tsx       # Dark/light toggle
│   ├── data/
│   │   ├── db.ts                   # Server-side Supabase queries + app↔db type converters; falls back to static data if SUPABASE_URL missing
│   │   ├── outfits.ts              # Static outfit catalog
│   │   ├── plans.ts                # Plan definitions (Basic $10 / Pro $25 / Ultra $49)
│   │   └── products.ts             # Static product catalog (~50 items)
│   ├── server/
│   │   ├── admin-auth.ts           # requireAdmin() — checks Clerk userId ∈ ADMIN_USER_IDS
│   │   ├── get-openai-key.ts       # Resolves OPENAI_API_KEY from env or Supabase settings
│   │   └── rate-limit.ts           # Upstash sliding-window limiter (10 req/min/IP); fails open
│   ├── services/nikeApi.ts         # Nike RapidAPI fetcher+transformer
│   ├── supabase.ts                 # Client singleton
│   └── types.ts                    # Shared TS types
public/                             # Static assets
scripts/                            # Utility scripts
supabase-schema.sql                 # DB schema (see §6)
supabase-migration-color-groups.sql # Color groups migration
```

---

## 3. Pages (routes)

| Route | Purpose |
|---|---|
| `/` | Homepage — hero, featured outfits & products |
| `/admin` | Admin hub (brands, products, outfits, users, settings) — gated by `ADMIN_USER_IDS` |
| `/blog` | Static blog landing with hard-coded posts |
| `/browse` | Browse all outfits/products with search+filter |
| `/builder` | Outfit builder (3-column layout: slots left · silhouette center · catalog right); embeds `StylistDrawer`; calls `/api/generate-outfit` for AI images |
| `/login` | Clerk `<SignIn>` |
| `/register` | Clerk `<SignUp>` |
| `/outfit/[id]` | Outfit detail (items list, total price, keywords) |
| `/plans` | Pricing tiers |
| `/product/[id]` | Product detail (gallery, colors, retailers, price range) |
| `/profile` | User profile — plan info, saved outfits, member since |
| `/saved` | User's saved outfits (from likes context) |
| `/stylist` | 6-step wizard (occasion → style → palette → fit → season → budget) → filter static outfits, show 4 `OutfitCard`s |
| `/subscribe` | Subscription upgrade/checkout |

---

## 4. API routes (`src/app/api/`)

| Route | Methods | Purpose |
|---|---|---|
| `/api/admin/settings` | GET/POST/DELETE | Admin-only: manage OpenAI API key (env or Supabase `settings` table) |
| `/api/admin/settings/test` | — | Test endpoint for admin settings |
| `/api/brands` | GET/POST | List brands; admin creates |
| `/api/brands/[name]` | — | Brand detail/update |
| `/api/color-groups` | GET/POST | Color swatch CRUD |
| `/api/generate-outfit` | POST | OpenAI `gpt-image-1` / DALL-E 3 outfit image generation |
| `/api/nike` | GET | Proxy to Nike RapidAPI search |
| `/api/outfits` | GET/POST | List / create outfits |
| `/api/outfits/[id]` | — | Outfit get/update |
| `/api/products` | GET/POST | List / create products (supports `raw` mode skipping variant grouping) |
| `/api/products/[id]` | — | Product get/update |
| `/api/products/bulk` | — | Bulk import |
| `/api/products/group` | — | Variant (color) grouping |
| `/api/products/seed` | — | DB seeding |
| `/api/stylist/chat` | POST | AI chat (gpt-4o-mini); validates catalog IDs; extracts JSON block; rate-limited 10/min/IP |
| `/api/stylist/chat/history` | GET/POST | Persist & fetch chat history per user/surface/context |

---

## 5. Auth, rate-limiting, env

**Clerk**
- Wrapped at root in `layout.tsx` via `<ClerkProvider>`.
- `auth-context.tsx` exposes `{ id, name, email, plan, isAdmin, signOut, openSignIn, openSignUp }` using `useUser()` + `useClerk()`.
- User plan read from Clerk `publicMetadata.plan` (`free` | `plus` | `ultra`).
- Admin flag from `publicMetadata.isAdmin` **or** server check via `ADMIN_USER_IDS` env var (CSV of Clerk user IDs) — see `src/lib/server/admin-auth.ts`.
- Sign-in/up live at `/login` and `/register` as catch-all routes.

**Upstash rate-limit**
- Used only by `/api/stylist/chat`. Env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Sliding window, 10 requests/minute per IP. Fails open if Upstash is unavailable.

**Required env vars** (non-exhaustive)
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `OPENAI_API_KEY` (or set via admin settings UI → Supabase `settings`)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `ADMIN_USER_IDS` (comma-separated Clerk IDs)
- `RAPIDAPI_KEY` (Nike service, optional)

---

## 6. Supabase schema (`supabase-schema.sql`)

| Table | Purpose / Key columns |
|---|---|
| `products` | Catalog core. `name, brand, category, price_min/max, images[], colors[], sizes[], material, retailers JSONB, style_keywords[], gender, variant_group_id, color_hex, is_group_primary, crop_data JSONB, color_group_ids int[]` |
| `brands` | `name` unique. Admin-managed |
| `color_groups` | Swatches for filters: `id, name, hex_code, sort_order` |
| `outfits` | `name, description, occasion, image_url, items JSONB, total_price_min/max, style_keywords[], is_ai_generated, is_saved, season` |
| `settings` | Key-value admin config (e.g., `openai_api_key`): `key, value, updated_at` |
| `stylist_chats` | Chat persistence: `user_id, surface, context_id, messages` |

RLS enabled on all tables; public read, service-role writes.

---

## 7. Styling & typography

- Single CSS file: `src/app/globals.css` — all CSS vars, keyframes, utilities live here.
- No `tailwind.config.js` (Tailwind v4 via PostCSS).
- Fonts: the handoff design calls for **Fraunces** (serif display), **Inter Tight** (sans UI), **JetBrains Mono** (micro-labels). Check current state of `globals.css` before asserting whether these are loaded — historically the site used system stacks via `--font-body` / `--font-display`.
- Light-mode bg token: was `#FAFAF8`, design target `#F4F2EE`. Verify current value before changing.
- `.font-display` utility class applies `var(--font-display)` with `!important`.

---

## 8. Data flow — Builder and Stylist

**Builder (`/builder`)**
- On mount: `GET /api/products` (falls back to `src/lib/data/products.ts` if Supabase down).
- UI: 5 slots (outerwear · top · bottom · shoes · accessories) fed by catalog filters.
- Selection synced to URL params (shareable links).
- "Save" → `localStorage` key `goo-saved-outfits`.
- "Generate" → `POST /api/generate-outfit` → modal with DALL-E/gpt-image-1 output.
- Embeds `StylistDrawer` which posts to `/api/stylist/chat` (rate-limited).

**Stylist (`/stylist`)**
- Pure client wizard: 6 steps, local `useState`.
- Result step **does not call an API** — filters `src/lib/data/outfits.ts` (or Supabase via `db.ts` if wired) by occasion.
- Renders 4 `OutfitCard`s after a ~2.4s fake-generation animation.
- "Regenerate" resets to step 1.

**StylistDrawer (chat)**
- Can appear on builder, browse, product pages.
- Sends `{ messages, context, currentOutfit }` to `/api/stylist/chat`.
- Server validates any catalog IDs referenced by the model, extracts a JSON suggestion block.
- History optionally persisted via `/api/stylist/chat/history`.

---

## 9. Known gotchas

- **`h-screen` + fixed nav**: builder uses full viewport minus nav height. When touching layout, re-verify nav offset (~56px).
- **Variant grouping**: products have `variant_group_id` + `is_group_primary` + `color_hex`. `/api/products` groups variants by default; pass `raw=true` to skip.
- **Admin auth**: there are two checks — Clerk `publicMetadata.isAdmin` (client-side UX) and `ADMIN_USER_IDS` env (server-side truth). Mutations must go through `requireAdmin()`.
- **OpenAI key resolution**: `get-openai-key.ts` tries env first, then Supabase `settings` table. Missing key → 500 on generate/chat endpoints.
- **Upstash fail-open**: rate limiter returns `success: true` when Upstash is unreachable — do not rely on it for hard quota enforcement.
- **Static fallbacks**: `db.ts` will silently return `products.ts` / `outfits.ts` if `NEXT_PUBLIC_SUPABASE_URL` is unset. Test against real Supabase before declaring a feature working.
- **RLS**: all mutations require the service-role key on the server; client-side Supabase calls will only read.

---

## 10. Git / branch policy

- **Project policy** (from `CLAUDE.md`): always commit directly to `master`; do not create feature branches.
- This file is safe to commit in isolation — it is documentation only.

---

## 11. Companion docs in repo

- `AI_STYLIST_ARCHITECTURE.md` — deep dive on stylist chat design
- `BUILD_PROGRESS.md` — running log of build work
- `FOLLOWUP_PLAN.md` — open follow-ups
- `IMPLEMENTATION_PLAN.md` — implementation plan doc

Read those for historical context; this file is the quick-orient snapshot.
