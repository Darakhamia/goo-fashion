# PROJECT ANALYSIS — GOO Fashion

_Updated 2026-04-21. Reflects current codebase state._

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
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (Clerk, ThemeProvider, LikesProvider, CartProvider)
│   ├── globals.css                   # All CSS variables, animations, utility classes
│   ├── page.tsx                      # Homepage
│   ├── browse/page.tsx               # Browse outfits/products
│   ├── saved/page.tsx                # Saved looks & likes
│   ├── blog/page.tsx                 # Blog listing
│   ├── outfit/[id]/page.tsx          # Single outfit detail
│   ├── product/[id]/page.tsx         # Single product detail
│   ├── profile/page.tsx              # User profile (Clerk-protected)
│   ├── plans/page.tsx                # 3-tier pricing + comparison table
│   ├── subscribe/page.tsx            # Subscribe placeholder (plan via URL param)
│   ├── stylist/page.tsx              # AI stylist chat page
│   ├── builder/page.tsx              # Outfit builder (3-column RUNWAY layout)
│   ├── login/[[...sign-in]]/page.tsx
│   ├── register/[[...sign-up]]/page.tsx
│   ├── admin/                        # Admin CRUD (protected)
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Dashboard
│   │   ├── brands/page.tsx
│   │   ├── outfits/page.tsx
│   │   ├── products/page.tsx
│   │   ├── settings/page.tsx
│   │   └── users/page.tsx
│   └── api/
│       ├── admin/settings/route.ts
│       ├── admin/settings/test/route.ts
│       ├── brands/route.ts
│       ├── brands/[name]/route.ts
│       ├── color-groups/route.ts
│       ├── generate-outfit/route.ts  # DALL-E 3 / GPT-Image 1
│       ├── nike/route.ts
│       ├── outfits/route.ts
│       ├── outfits/[id]/route.ts
│       ├── products/route.ts
│       ├── products/[id]/route.ts
│       ├── products/bulk/route.ts
│       ├── products/group/route.ts
│       ├── products/seed/route.ts
│       ├── upload/route.ts           # Supabase Storage image upload
│       ├── stylist/chat/route.ts     # AI stylist chat with plan limits
│       ├── stylist/chat/history/route.ts
│       └── stylist/chat/sessions/route.ts
├── components/
│   ├── admin/ImageCropEditor.tsx   # Admin product image crop tool
│   ├── layout/
│   │   ├── ConditionalSiteLayout.tsx # Nav+Footer wrapper, skips /admin /login /register
│   │   ├── Navigation.tsx
│   │   └── Footer.tsx
│   ├── admin/
│   │   └── ImageCropEditor.tsx
│   ├── outfit/
│   │   ├── OutfitCard.tsx
│   │   ├── OutfitCollage.tsx
│   │   └── OutfitActions.tsx
│   ├── product/
│   │   ├── ProductCard.tsx
│   │   ├── ProductGallery.tsx
│   │   └── ProductClient.tsx
│   ├── stylist/
│   │   └── StylistDrawer.tsx         # AI stylist slide-in drawer with history + plan limits
│   └── ui/
│       └── SectionLabel.tsx
├── lib/
│   ├── context/
│   │   ├── auth-context.tsx
│   │   ├── cart-context.tsx
│   │   ├── likes-context.tsx
│   │   └── theme-context.tsx
│   ├── data/
│   │   ├── db.ts                     # Supabase client queries + static fallback
│   │   ├── outfits.ts
│   │   ├── plans.ts                  # Plan definitions (Free/Plus/Ultra)
│   │   └── products.ts
│   ├── server/
│   │   ├── admin-auth.ts
│   │   ├── get-openai-key.ts         # Resolves per-user or global OpenAI key
│   │   └── rate-limit.ts             # Upstash sliding-window limiter; fails open
│   ├── services/
│   │   └── nikeApi.ts
│   ├── supabase.ts
│   └── types.ts
public/                               # Static assets
scripts/
supabase-schema.sql
supabase-migration-color-groups.sql
supabase/migrations/003_stylist_usage.sql  # Daily usage tracking per user
```

---

## 3. Pages (routes)

| Route | File | Notes |
|---|---|---|
| `/` | `page.tsx` | Homepage |
| `/browse` | `browse/page.tsx` | Browse outfits & products |
| `/saved` | `saved/page.tsx` | Saved looks & liked items |
| `/blog` | `blog/page.tsx` | Blog listing |
| `/outfit/[id]` | `outfit/[id]/page.tsx` | Outfit detail |
| `/product/[id]` | `product/[id]/page.tsx` | Product detail |
| `/profile` | `profile/page.tsx` | Clerk-protected |
| `/plans` | `plans/page.tsx` | 3-tier pricing + FAQ |
| `/subscribe` | `subscribe/page.tsx` | Subscribe placeholder (plan via `?plan=` URL param) |
| `/stylist` | `stylist/page.tsx` | AI stylist chat page |
| `/builder` | `builder/page.tsx` | Outfit builder (3-col RUNWAY layout) |
| `/admin` | `admin/page.tsx` | Admin dashboard (Supabase-backed) |
| `/login` | `login/[[...sign-in]]/page.tsx` | Clerk sign-in |
| `/register` | `register/[[...sign-up]]/page.tsx` | Clerk sign-up |

---

## 4. API Routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/generate-outfit` | POST | DALL-E 3 / GPT-Image 1 outfit image generation |
| `/api/stylist/chat` | POST | AI stylist chat — plan limits, daily usage, OpenAI |
| `/api/stylist/chat/history` | GET/POST | Persist & fetch chat history per user/surface |
| `/api/stylist/chat/sessions` | GET | List all sessions for a user |
| `/api/upload` | POST | Supabase Storage image upload (outfit-images bucket) |
| `/api/products` | GET/POST | Product CRUD (supports `raw=true`) |
| `/api/products/[id]` | GET/PATCH | Single product |
| `/api/products/bulk` | POST | Bulk import |
| `/api/products/group` | GET | Variant grouping |
| `/api/products/seed` | POST | Seed from static data |
| `/api/outfits` | GET/POST | Outfit CRUD |
| `/api/outfits/[id]` | GET/PATCH/DELETE | Single outfit |
| `/api/brands` | GET/POST | Brand CRUD |
| `/api/brands/[name]` | GET | Brand detail |
| `/api/color-groups` | GET/POST | Color swatch CRUD |
| `/api/nike` | GET | Nike RapidAPI proxy |
| `/api/admin/settings` | GET/POST/DELETE | OpenAI key management |
| `/api/admin/settings/test` | GET | Test OpenAI key |

---

## 5. Auth, plans, rate-limiting

**Clerk**
- `auth-context.tsx` exposes `{ id, name, email, plan, isAdmin }`.
- Plan: `publicMetadata.plan` → `free` | `plus` | `ultra`. Default `free`.
- Admin: `publicMetadata.isAdmin` (client) + `ADMIN_USER_IDS` env var (server via `requireAdmin()`).

**Plan daily limits** (enforced in `/api/stylist/chat`)
- free: 20 msg/day · plus: 150 msg/day · ultra: unlimited
- Tracked in `stylist_daily_usage` Supabase table.
- Burst protection via Upstash Redis (10 req/min/IP, fails open).

**Required env vars**
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `OPENAI_API_KEY` (or set via admin UI)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (optional)
- `ADMIN_USER_IDS` (CSV of Clerk IDs)
- `RAPIDAPI_KEY` (Nike, optional)

---

## 6. Supabase schema

| Table | Purpose |
|---|---|
| `products` | Full catalog with variant grouping, crop data, style keywords |
| `brands` | Admin-managed brand list |
| `color_groups` | Swatches for browse filters |
| `outfits` | Admin-uploaded outfits with image_url, items, keywords |
| `settings` | Key-value config (`openai_api_key`) |
| `stylist_chats` | Chat history: `user_id, surface, context_id, messages JSONB` |
| `stylist_daily_usage` | Daily msg count: `user_id, usage_date, count` |

Storage bucket: `outfit-images` (public, auto-created by `/api/upload`).

RLS enabled on all tables; public read, service-role writes.

---

## 7. Styling & typography

- Single CSS file: `src/app/globals.css` — all CSS vars, keyframes, utilities.
- No `tailwind.config.js` (Tailwind v4 via PostCSS).
- Fonts: **Fraunces** (display serif) · **Inter Tight** (UI sans) · **JetBrains Mono** (micro-labels).
- Light-mode bg: `#F4F2EE` | Dark-mode: `#0A0A0A`.

---

## 8. Data flow — Builder and Stylist

**Builder (`/builder`)**
- On mount: `GET /api/products` (falls back to `products.ts` if Supabase down).
- 5 slots: outerwear · top · bottom · shoes · accessories.
- Selection synced to URL params. Save → `localStorage goo-saved-outfits`.
- "Generate" → `POST /api/generate-outfit` → DALL-E modal.
- `persistLook({ generatedImage, generatedStyle })` — auto-saves after generation.
- Embeds `StylistDrawer` (rate-limited, history-aware).

**StylistDrawer (chat)**
- Used in builder, browse, product pages.
- Plan limits shown in composer footer (amber warning at ≤5 remaining).
- History panel lists all sessions; click any to reload.
- "Build this look" button appears when suggestions cover ≥2 different slots.

---

## 9. Known gotchas

- **`h-screen` + fixed nav**: builder uses full viewport minus nav height (~56px).
- **Variant grouping**: pass `raw=true` to `/api/products` to skip.
- **Admin auth**: two checks — Clerk `publicMetadata.isAdmin` (client) + `ADMIN_USER_IDS` env (server). Mutations need `requireAdmin()`.
- **OpenAI key**: `get-openai-key.ts` tries env then Supabase `settings`. Missing → 501.
- **Upstash fail-open**: rate limiter passes through when Redis unreachable.
- **Static fallbacks**: `db.ts` silently returns static data when `SUPABASE_URL` unset.
- **RLS**: all mutations need service-role key server-side.

---

## 10. Git / branch policy

- **Project policy** (`CLAUDE.md`): always commit directly to `master`; no feature branches.
