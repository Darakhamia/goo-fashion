# Claude Code Instructions

## Branch Policy
- Always work directly on the `master` branch
- Never create new feature branches
- Commit and push all changes to `master`

---

# Project Documentation: GOO Fashion

## What is this?

GOO is an AI stylist fashion platform. Users browse curated products and outfits, chat with an AI stylist, and can generate outfit images. There's a subscription system and an admin panel.

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | Clerk (`@clerk/nextjs`) |
| Database | Supabase (PostgreSQL) |
| AI Chat | OpenAI (GPT-4o) |
| Image Gen | Replicate (Flux model) |
| Storage | Supabase Storage |
| Rate Limiting | Upstash Redis |
| Email | Resend |
| Analytics | Custom (stored in Supabase) |

## Environment Variables

```
# Supabase
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY

# AI
OPENAI_API_KEY          # can also be stored in Supabase admin settings table
REPLICATE_API_TOKEN

# Rate limiting
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

# Email
RESEND_API_KEY

# Admin
ADMIN_USER_IDS          # comma-separated Clerk user IDs
SUPER_ADMIN_USER_ID     # single Clerk user ID for super admin

# StockX
STOCKX_CLIENT_ID
STOCKX_CLIENT_SECRET
```

If Supabase is not configured, the app falls back to static data from `src/lib/data/products.ts`, `outfits.ts`, `blog.ts`.

## Site Pages

| Route | Description |
|---|---|
| `/` | Homepage / landing |
| `/browse` | Product catalog with filters |
| `/product/[id]` | Product detail — gallery, retailers, price history, reviews |
| `/outfit/[id]` | Outfit detail |
| `/builder` | Outfit builder — assemble an outfit from products |
| `/stylist` | AI Stylist full-page chat |
| `/blog`, `/blog/[slug]` | Blog |
| `/plans` | Pricing page |
| `/subscribe` | Checkout (demo) |
| `/profile` | User profile |
| `/saved` | Saved products & outfits |
| `/login`, `/register` | Clerk auth (catch-all routes) |
| `/about`, `/privacy`, `/terms`, `/cookie` | Static pages |
| `/coming-soon` | Feature preview carousel |
| `/admin/*` | Admin panel (see below) |

## Admin Panel (`/admin`)

Protected by `requireAdmin()` — user must be in `ADMIN_USER_IDS`.

| Route | What it does |
|---|---|
| `/admin` | Dashboard with stats |
| `/admin/products` | Product CRUD |
| `/admin/outfits` | Outfit CRUD |
| `/admin/brands` | Brand management |
| `/admin/blog` | Blog post editor |
| `/admin/users` | User list + plan management |
| `/admin/email` | Email campaigns via Resend |
| `/admin/import` | Bulk product import |
| `/admin/farfetch` | Farfetch product import |
| `/admin/stockx` | StockX import (OAuth flow) |
| `/admin/analytics` | Analytics dashboard with charts |
| `/admin/activity` | Audit log |
| `/admin/settings` | Site settings (OpenAI key, etc.) |

## API Routes

**Products**
- `GET/POST /api/products` — list (with filters) / create
- `GET/PUT/DELETE /api/products/[id]`
- `GET /api/products/[id]/price-history`
- `GET/POST /api/products/[id]/reviews`
- `POST /api/products/bulk` — bulk upsert
- `POST /api/products/group` — manage variant groups
- `POST /api/products/seed` — seed static data to DB

**Outfits**
- `GET/POST /api/outfits`
- `GET/PUT/DELETE /api/outfits/[id]`

**AI**
- `POST /api/stylist/chat` — AI stylist (OpenAI, plan-gated, rate-limited 10 req/min)
- `GET /api/stylist/chat/history` — per-user chat history (Supabase)
- `GET /api/stylist/chat/sessions` — list chat sessions
- `POST /api/generate-outfit` — outfit image generation via Replicate (plan-gated)

**Blog**
- `GET/POST /api/blog`
- `GET/PUT/DELETE /api/blog/[id]`

**Community looks**
- `POST /api/looks/submit` — user submits a look
- `GET /api/looks/pending` — admin: pending looks
- `POST /api/looks/approve`, `/api/looks/reject`

**External integrations**
- `GET /api/farfetch/search`, `/api/farfetch/fetch`, `/api/farfetch/import`
- `GET /api/stockx/search`, `/api/stockx/import`, `/api/stockx/auth`, `/api/stockx/callback`
- `GET /api/nike`

**Other**
- `GET /api/brands`, `GET /api/brands/[name]`
- `GET /api/color-groups`
- `GET /api/exchange-rates`
- `POST /api/upload` — image upload to Supabase Storage
- `POST /api/unlock` — unlock a feature
- `POST /api/billing/demo-upgrade` — demo plan upgrade
- `POST /api/analytics/event`, `/api/analytics/pageview`, `/api/analytics/web-vitals`
- `GET/POST /api/admin/*` — admin-only routes (stats, audit, settings, users, etc.)

## Subscription Plans (`src/lib/plans.ts`)

Plan is stored in Clerk `publicMetadata.plan`. Defaults to `"free"`.

| Plan | Price | Features |
|---|---|---|
| free | $0 | Browse only, no AI |
| basic | $10/mo | AI Stylist, image generation |
| pro | $25/mo | + Save outfits |
| premium | $45/mo | + Stylist memory, exclusive styles |

Key helpers:
- `coercePlan(raw)` — safely parse plan from Clerk metadata
- `planHasFeature(planId, feature)` — check if plan includes a feature
- `minimumPlanFor(feature)` — cheapest plan for a feature
- Use `requirePlan(feature)` server-side to gate API routes

## Data Layer (`src/lib/data/db.ts`)

Single file that abstracts Supabase vs static fallback. Always import from here:
- `getAllProducts()`, `getProductById(id)`
- `getAllOutfits()`, `getOutfitById(id)`
- `getAllBlogPosts()`, `getBlogPostBySlug(slug)`

DB rows use `snake_case`; app types use `camelCase`. Conversion functions:
- `dbToProduct(row)` / `productToDb(product)`
- `dbToColorGroup(row)`

## Key Types (`src/lib/types.ts`)

- `Product` — main product type with retailers, variants, crop data
- `Outfit` — outfit with `OutfitItem[]` (product + role: hero/secondary/accent)
- `UserProfile` — body type, style prefs, budget, saved items
- `Brand` — union type of supported brands
- `Category` — union: outerwear, tops, shirts, bottoms, footwear, etc.
- `Occasion` — casual, work, evening, sport, formal, weekend
- `StyleKeyword` — minimal, streetwear, classic, avant-garde, etc.
- `FilterState` — used by browse page filters
- `ColorGroup` — color families for filter UI (mapped from DB `color_groups` table)
- `BlogPost`, `Retailer`, `PricePoint`, `ProductReview`, `ProductSwatch`

## React Contexts (`src/lib/context/`)

All wrapped in `layout.tsx` root layout:

| Context | What it holds |
|---|---|
| `AuthContext` | Clerk user, plan, isAdmin flag |
| `LikesContext` | Liked product/outfit IDs |
| `CartContext` | Shopping cart items |
| `CurrencyContext` | Selected currency + exchange rates |
| `StylistContext` | AI stylist chat state, drawer open/close |
| `ThemeContext` | dark/light theme (localStorage key: `goo-theme`) |

## Components

**Layout** (`src/components/layout/`)
- `Navigation` — top nav bar
- `Footer` — site footer
- `MobileBottomNav` — mobile bottom navigation
- `ConditionalSiteLayout` — hides nav/footer for admin/auth pages

**Product** (`src/components/product/`)
- `ProductCard` — catalog card with swatches, hover effects
- `ProductClient` — full product page client logic
- `ProductGallery` — image gallery with zoom
- `PriceHistoryChart` — recharts price chart
- `ProductReviews` — review list + submission

**Outfit** (`src/components/outfit/`)
- `OutfitCard` — catalog card
- `OutfitCollage` — multi-image collage layout
- `OutfitCarousel` — horizontal scroll carousel
- `OutfitActions` — save/share/like buttons

**Stylist** (`src/components/stylist/`)
- `FloatingStylist` — floating chat button shown site-wide
- `StylistDrawer` — slide-in chat drawer
- `StylistPersonalizationModal` — onboarding style preferences

**UI** (`src/components/ui/`)
- `Price` — formatted price with currency
- `SectionLabel` — styled section heading

**Other**
- `UpgradeModal` — shown when user hits a plan gate
- `ImageCropEditor` — admin image crop tool
- `AnalyticsTracker` — fires pageview/event analytics

## Auth & Admin Guards

**Client-side**: `useAuth()` from `AuthContext` — gives `user`, `isLoggedIn`, `user.isAdmin`

**Server-side** (`src/lib/server/admin-auth.ts`):
```ts
const admin = await requireAdmin();
if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```
- `requireAdmin()` — checks Clerk session + ADMIN_USER_IDS
- `requireSuperAdmin()` — additionally checks SUPER_ADMIN_USER_ID

**Plan gates** (`src/lib/server/require-plan.ts`):
```ts
const check = await requirePlan("aiStylist");
if (!check.allowed) return NextResponse.json(check.error, { status: 402 });
```

## Rate Limiting (`src/lib/server/rate-limit.ts`)

10 requests/minute per IP using Upstash sliding window. Applied on stylist chat. Falls through silently if Upstash is not configured.

## AI Stylist Chat (`/api/stylist/chat`)

- Uses OpenAI with tool-calling (up to 4 rounds)
- Has context awareness: surface (`builder` | `browse` | `product`), current outfit, visible products
- Stores chat history in Supabase `stylist_sessions` table when configured
- User message capped at 500 chars, history capped at last 20 entries
- Plan daily limits: free=20, plus=150, ultra=unlimited

## Image Generation (`/api/generate-outfit`)

- Uses Replicate (Flux model)
- Fetches product images, builds a prompt, generates outfit image
- Uploads result to Supabase Storage bucket `generated-outfits`
- Path format: `{userId}/{date}/{timestamp}.jpg`
- Requires `imageGeneration` feature (basic plan+)

## Fonts & Theme

Fonts loaded via `next/font/google` in `layout.tsx`:
- `--font-fraunces` — Fraunces (serif, used for headings)
- `--font-inter-tight` — Inter Tight (sans-serif, body text)
- `--font-jetbrains` — JetBrains Mono (code/mono)

Theme: dark by default. Inline script in `<head>` reads `localStorage['goo-theme']` to prevent flash of wrong theme. Toggle managed by `ThemeContext`.

## Supabase Database Tables

Main tables (see `supabase-schema.sql` for full DDL):
- `products` — product catalog
- `outfits` — outfit collections
- `blog_posts` — blog content
- `color_groups` — color filter groups (id, name, hex_code, sort_order)
- `import_jobs` — background import tracking
- `price_history` — per-product price points over time
- `product_reviews` — user reviews
- `analytics_events` / `analytics_pageviews` / `web_vitals` — custom analytics
- `stylist_sessions` / `stylist_usage` — AI chat history and usage tracking
- `audit_log` — admin actions log

Migrations in `supabase/migrations/` (001–004).

## External Integrations

- **Farfetch** — search and import products via scraping (`/api/farfetch/*`)
- **StockX** — OAuth2 flow + product import (`/api/stockx/*`)
- **Nike** — product fetch via unofficial API (`/api/nike`)
- **Resend** — transactional + campaign email (`/admin/email`)
