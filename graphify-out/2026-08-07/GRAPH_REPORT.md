# Graph Report - goo-fashion  (2026-08-07)

## Corpus Check
- 271 files · ~608,014 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2080 nodes · 3817 edges · 172 communities (137 shown, 35 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.56)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d8fc2122`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- csv-import/route.ts
- chat/route.ts
- theme-context.tsx
- package.json
- supabase.ts
- seo.ts
- AI Stylist Architecture — GOO Fashion
- generate-outfit/route.ts
- cn
- analytics/page.tsx
- ConditionalSiteLayout.tsx
- requireAdmin
- config/route.ts
- parser/page.tsx
- product/[id]/page.tsx
- extract.ts
- profile/page.tsx
- StylistDrawer.tsx
- Phase 3 — Builder Page Restructure
- subscriptions.ts
- What You Must Do When Invoked
- categories/page.tsx
- builder/page.tsx
- app/layout.tsx
- outfits/page.tsx
- products/page.tsx
- compilerOptions
- monobank.ts
- plans.ts
- BUILD PROGRESS — GOO Outfit Builder Redesign
- settings/page.tsx
- app/page.tsx
- Outfit
- lib/types.ts
- useCurrency
- activity/page.tsx
- dependencies
- devDependencies
- categories.ts
- users/page.tsx
- PlanId
- categories/route.ts
- subscriptions/page.tsx
- nikeApi.ts
- logAdminAction
- dbToProduct
- FeatureCarousel.tsx
- Журнал изменений
- ProductClient.tsx
- GOO AI Stylist — Architecture
- outfits.ts
- look/[id]/page.tsx
- Universal Product Parser
- analytics/route.ts
- Бриф агента: работа по плану аудита
- Manual QA checklist — AI Stylist builder flow
- PROJECT ANALYSIS — GOO Fashion
- Product
- goo-studio/blog/page.tsx
- RecentlyViewed.tsx
- 🧠 Features
- outfits/[id]/route.ts
- _detect_bbox
- goo-studio/layout.tsx
- proxy.ts
- db.ts
- currency-context.tsx
- fetch.ts
- Follow-up Phase E1 — Extract StylistDrawer as Reusable Component ✅
- graphify reference: extra exports and benchmark
- Change 2 — Clean Up Builder Header Area
- Change 6 — AI Stylist as a Site-Wide Real-API Feature
- OPEN QUESTIONS
- HomeFullPageScroll.tsx
- goo-studio/page.tsx
- AUDIT_DEV_PLAN.md
- Волны выполнения
- Follow-up Phase E4 — Rate Limiting + Public Hardening ✅
- Follow-up Phase D2 — AI Stylist Chat API Route ✅
- Follow-up Phase E3 — Browse Page AI Stylist Integration ✅
- Change 5 — Clarify and Implement "Shop the Look"
- AnalyticsTracker.tsx
- image-tools/page.tsx
- eslint.config.mjs
- report/page.tsx
- next.config.ts
- Б7. Воронка, главная, SEO — P2
- postcss.config.mjs
- Change 4 — Generate Available With Fewer Slots Filled
- Change 3 — Add Useful Product Filters to Right Catalog Panel
- vercel.json
- getAllBlogPosts
- admin/stats/route.ts
- share/route.ts
- Б0. Разблокировать оплату — P0
- Б1. Биллинг: надёжность и наблюдаемость — P0/P1
- Б2. Гейты и квоты: за что платят — P1
- Б8. Каталог и контент — P2
- Follow-up Phase D1 — AI Stylist Key Infrastructure ✅
- Follow-up Phase C2 — Shop the Look + Cart System ✅
- Phase 3d — Right Panel Catalog Rebuild ✅
- graphify reference: query, path, explain
- Change 1 — Reduce Center Canvas Visual Dominance
- Recommended Execution Phases
- render
- checkout/route.ts
- admin-auth.ts
- image-tools/route.ts
- email/route.ts
- group/route.ts
- opengraph-image.tsx
- templates/route.ts
- 8. Доска статусов
- Billing — monobank (Plata by mono)
- Claude Code Instructions
- health/route.ts
- cookie/page.tsx
- prompts/page.tsx
- terms/page.tsx
- AIStylistChat.tsx
- Б10. Производительность и мобильный UX — P2
- Б11. Решение о бизнес-модели — P0 (решение, не код)
- Б3. Тарифы: обещания = код — P1
- Б4. Аналитика и измеримость — P1
- Б6. Партнёрская монетизация — P1/P2
- 9. Эскалация к CEO
- Manual QA Checklist (final browser testing)
- Follow-up Phase C1 — Builder Header Cleanup ✅
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- exchange-rates/route.ts
- preview/route.ts
- privacy/page.tsx
- Follow-up Phase E2 — Product Detail Page AI Stylist Integration ✅
- Follow-up Phase A — Canvas Balance + Decorative Cleanup + Generate Threshold ✅
- Pending Steps
- ImageCropEditor.tsx
- Phase 3a — Builder Shell + Layout Foundation ✅
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- FOLLOWUP PLAN — GOO Post-Migration Improvements
- unlock/route.ts
- brands/page.tsx
- waitlist/page.tsx
- route.tsx
- HowItWorksGrid.tsx
- SectionLabel.tsx
- class-variance-authority
- .claude/CLAUDE.md
- extraction-spec.md
- @clerk/nextjs
- clsx
- openai
- @radix-ui/react-slot
- recharts
- replicate
- resend
- @supabase/supabase-js
- @upstash/redis
- @vercel/analytics
- @vercel/speed-insights
- web-vitals
- blog/[id]/route.ts
- price-history/route.ts
- renew/route.ts
- Phase 1 — Global Font System ✅

## God Nodes (most connected - your core abstractions)
1. `requireAdmin()` - 121 edges
2. `supabase` - 58 edges
3. `isSupabaseConfigured` - 56 edges
4. `Product` - 27 edges
5. `useCurrency()` - 26 edges
6. `BUILD PROGRESS — GOO Outfit Builder Redesign` - 26 edges
7. `POST()` - 25 edges
8. `Outfit` - 21 edges
9. `useLikes()` - 20 edges
10. `dbToProduct()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `CSVImportPage()` --references--> `react`  [EXTRACTED]
  src/app/goo-studio/brightdata/page.tsx → package.json
- `removeBackground()` --references--> `replicate`  [EXTRACTED]
  src/app/api/admin/image-tools/route.ts → package.json
- `POST()` --references--> `replicate`  [EXTRACTED]
  src/app/api/generate-outfit/route.ts → package.json
- `HeroHeader()` --references--> `react`  [EXTRACTED]
  src/components/blocks/hero-section-1.tsx → package.json
- `CrossfadeText()` --references--> `react`  [EXTRACTED]
  src/components/ui/gooey-text-morphing.tsx → package.json

## Import Cycles
- None detected.

## Communities (172 total, 35 thin omitted)

### Community 0 - "csv-import/route.ts"
Cohesion: 0.06
Nodes (56): boostAwinkImageUrl(), cleanName(), collectImages(), getBaseProductName(), getGroupKeys(), mapCSVRow(), parseCSV(), parseJsonArray() (+48 more)

### Community 1 - "chat/route.ts"
Cohesion: 0.06
Nodes (56): ClaudeResult, POST(), augmentQuery(), BrowseContext, buildBrowseContext(), buildCatalogBlock(), buildFocusContext(), buildOutfitContext() (+48 more)

### Community 2 - "theme-context.tsx"
Cohesion: 0.12
Nodes (15): AccountTab(), metadata, AuthForm(), ELEMENTS, Palette, PALETTES, HeroBackground(), HeroBackgroundProps (+7 more)

### Community 3 - "package.json"
Cohesion: 0.18
Nodes (10): engines, node, name, private, scripts, build, dev, lint (+2 more)

### Community 4 - "supabase.ts"
Cohesion: 0.08
Nodes (21): POST(), POST(), ALLOWED_EVENTS, POST(), POST(), resolveCountry(), ALLOWED_METRICS, POST() (+13 more)

### Community 5 - "seo.ts"
Cohesion: 0.11
Nodes (28): BlogPostPage(), formatDate(), generateMetadata(), Props, revalidate, generateMetadata(), OutfitDetailPage(), getBlogPostBySlug() (+20 more)

### Community 6 - "AI Stylist Architecture — GOO Fashion"
Cohesion: 0.04
Nodes (44): 1. Current State Audit, 2. Real API Architecture, 3. Admin Key Management, 4. Catalog Grounding, 5. Prompt Design, 6. Site-Wide Integration Plan, 7. Safety and UX, 8. Implementation Phases (+36 more)

### Community 7 - "generate-outfit/route.ts"
Cohesion: 0.09
Nodes (35): POST(), fetchPageText(), isAllowedExternalUrl(), POST(), slugify(), DELETE(), GET(), POST() (+27 more)

### Community 8 - "cn"
Cohesion: 0.08
Nodes (31): react, react, CSVImportPage(), HeroHeader(), Logo(), menuItems, transitionVariants, HeroSection() (+23 more)

### Community 9 - "analytics/page.tsx"
Cohesion: 0.06
Nodes (25): CountriesChart(), COUNTRY_NAMES, countryFlag(), countryLabel(), formatBucket(), PALETTE, PieItem, tooltipStyle (+17 more)

### Community 10 - "ConditionalSiteLayout.tsx"
Cohesion: 0.14
Nodes (15): ChatPreview(), ConditionalSiteLayoutProps, SiteLayout(), StylistDrawer, Footer(), footerLinks, MobileBottomNav(), Navigation() (+7 more)

### Community 11 - "requireAdmin"
Cohesion: 0.10
Nodes (22): DELETE(), POST(), slug(), buildEmbedText(), GET(), POST(), ProductRow, DELETE() (+14 more)

### Community 12 - "config/route.ts"
Cohesion: 0.15
Nodes (28): buildState(), GET(), IMPERSONATE, maskKey(), POST(), PROVIDERS, sanitizeFetchSettings(), sanitizeSiteConfigs() (+20 more)

### Community 13 - "parser/page.tsx"
Cohesion: 0.10
Nodes (19): CATEGORIES, ConfigState, Diagnostics, GENDERS, IMPERSONATE, ParseResponse, PROVIDERS, RULE_FIELDS (+11 more)

### Community 14 - "product/[id]/page.tsx"
Cohesion: 0.15
Nodes (21): GET(), getData(), generateMetadata(), ProductDetailPage(), Props, metadata, revalidate, SITE_SECTIONS (+13 more)

### Community 15 - "extract.ts"
Cohesion: 0.17
Nodes (29): allMeta(), applyRule(), asString(), brandName(), decodeEntities(), dedupeRaw(), extractProduct(), extractProductLinks() (+21 more)

### Community 16 - "profile/page.tsx"
Cohesion: 0.11
Nodes (23): ALL_FEATURES, BODY_TYPES, BodyType, BUDGET_OPTIONS, COLOR_PALETTE, formatDate(), PLAN_FEATURE_LABELS, PlanTab() (+15 more)

### Community 17 - "StylistDrawer.tsx"
Cohesion: 0.17
Nodes (18): ChatSession, applyGesture(), BrowseContext, buildLookUrl(), CATEGORY_TO_SLOT, clampRect(), cleanReplyText(), defaultRect() (+10 more)

### Community 18 - "Phase 3 — Builder Page Restructure"
Cohesion: 0.08
Nodes (25): File Change Summary, IMPLEMENTATION PLAN — GOO Outfit Builder Redesign, Phase 1 — Global Font System, Phase 2 — Stylist Page Typography, Phase 3 — Builder Page Restructure, Phase 4 — QA and Polish, Step 1.1 — Load new fonts via `next/font/google`, Step 1.2 — Update `globals.css` font variables (+17 more)

### Community 19 - "subscriptions.ts"
Cohesion: 0.25
Nodes (15): POST(), GET(), POST(), listWalletCards(), activateSubscription(), addOneMonth(), BillingEventRow, BillingEventType (+7 more)

### Community 20 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 21 - "categories/page.tsx"
Cohesion: 0.11
Nodes (28): addGroup(), [addingIn, setAddingIn], addSub(), [busy, setBusy], Counts, deleteGroup(), deleteSub(), [draftLabel, setDraftLabel] (+20 more)

### Community 22 - "builder/page.tsx"
Cohesion: 0.10
Nodes (34): BuilderPage(), CATALOG_CHIPS, CatalogItem, CATEGORY_ICONS, FIGURE_SLOTS, MOBILE_CHIPS, PRICE_BUCKETS, SlotId (+26 more)

### Community 23 - "app/layout.tsx"
Cohesion: 0.09
Nodes (20): interTight, metadata, poppins, viewport, PostHogTracker(), BugReportButton(), ConditionalSiteLayout(), AuthContext (+12 more)

### Community 24 - "outfits/page.tsx"
Cohesion: 0.16
Nodes (12): CATEGORIES, defaultForm, OCCASIONS, OutfitFormState, OutfitRole, PendingLook, ROLES, Season (+4 more)

### Community 25 - "products/page.tsx"
Cohesion: 0.11
Nodes (21): AdminProductsPage(), AVAILABILITY_OPTIONS, categoryPath(), DEFAULT_COLOR_GROUPS, defaultForm, deriveColors(), fmtDate(), fmtPrice() (+13 more)

### Community 26 - "compilerOptions"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, goo-fashion, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts (+21 more)

### Community 27 - "monobank.ts"
Cohesion: 0.14
Nodes (15): API_BASE, call(), chargeWallet(), ChargeWalletParams, ChargeWalletResult, CreateInvoiceParams, CreateInvoiceResult, fetchPublicKeyPem() (+7 more)

### Community 28 - "plans.ts"
Cohesion: 0.16
Nodes (16): GET(), GET(), POST(), BILLING_CCY, BILLING_CCY_SYMBOL, coercePlan(), DEFAULT_PLAN, Feature (+8 more)

### Community 29 - "BUILD PROGRESS — GOO Outfit Builder Redesign"
Cohesion: 0.10
Nodes (20): After Phase 1 (global fonts), After Phase 2 (stylist typography), BUILD PROGRESS — GOO Outfit Builder Redesign, Builder Migration Status: ✅ FUNCTIONALLY COMPLETE, Changes, Follow-up Phase B — Catalog Filters ✅, Follow-up Phase D3 — Wire Builder AI Drawer to Real API ✅, Interaction model (+12 more)

### Community 30 - "settings/page.tsx"
Cohesion: 0.14
Nodes (18): EMPTY_SHOWCASE, EMPTY_STYLIST, ExtraStoreForm, KeyStatus, PickerItem, SettingsPage(), ShowcaseIds, STEP_META (+10 more)

### Community 31 - "app/page.tsx"
Cohesion: 0.08
Nodes (17): HomePage(), revalidate, HomeSection(), HomeSectionProps, smallViewportHeight(), buildSteps(), HowItWorksSection(), JsonLd() (+9 more)

### Community 32 - "Outfit"
Cohesion: 0.11
Nodes (17): EASE, FeaturesBento(), FeaturesBentoProps, STYLIST_CHIPS, EASE, OutfitExamplesCarousel(), Props, OutfitCardProps (+9 more)

### Community 33 - "lib/types.ts"
Cohesion: 0.12
Nodes (11): PAD, PriceHistoryChart(), Props, Props, BodyType, Brand, FilterState, Plan (+3 more)

### Community 34 - "useCurrency"
Cohesion: 0.12
Nodes (19): isProductAvailable(), LookCard(), SavedOutfitCard(), AIStylistShowcase(), AIStylistShowcaseProps, BuyRow(), BuyRowData, EASE (+11 more)

### Community 35 - "activity/page.tsx"
Cohesion: 0.28
Nodes (6): ACTION_COLORS, ACTION_LABELS, AdminActivityPage(), AuditEntry, fmtFull(), fmtRelative()

### Community 36 - "dependencies"
Cohesion: 0.11
Nodes (19): @anthropic-ai/sdk, framer-motion, lucide-react, next, dependencies, @anthropic-ai/sdk, framer-motion, lucide-react (+11 more)

### Community 37 - "devDependencies"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+11 more)

### Community 38 - "categories.ts"
Cohesion: 0.14
Nodes (17): GET(), TreeResponse, bucketsInTree(), CATEGORY_VALUES, CategoryGroup, CategoryItem, DEFAULT_CATEGORY_GROUPS, isBuiltInBucket() (+9 more)

### Community 39 - "users/page.tsx"
Cohesion: 0.18
Nodes (15): AdminUsersPage(), filterBtnCls(), fmtDate(), fmtDuration(), fmtRelative(), initials(), PLAN_OPTIONS, planBadge (+7 more)

### Community 40 - "PlanId"
Cohesion: 0.10
Nodes (15): Cell, COMPARISON, FAQ_ITEMS, PLANS, PlansPage(), BillingStatus, PLAN_COPY, SubscribeInner() (+7 more)

### Community 41 - "categories/route.ts"
Cohesion: 0.36
Nodes (12): cleanLabel(), DELETE(), dynamic, Guard, isTableMissing(), PATCH(), POST(), readBucket() (+4 more)

### Community 42 - "subscriptions/page.tsx"
Cohesion: 0.14
Nodes (14): approxUsd(), ByPlan, EVENT_LABEL, EVENT_STYLE, fmtDate(), fmtDateTime(), Payload, STATUS_STYLE (+6 more)

### Community 43 - "nikeApi.ts"
Cohesion: 0.20
Nodes (16): extractColors(), extractId(), extractImage(), extractName(), extractPrice(), extractProductsFromResponse(), extractSizes(), extractUrl() (+8 more)

### Community 44 - "logAdminAction"
Cohesion: 0.20
Nodes (12): GET(), POST(), STEPS, GET(), POST(), DELETE(), GET(), maskKey() (+4 more)

### Community 45 - "dbToProduct"
Cohesion: 0.29
Nodes (11): POST(), DELETE(), noDb(), PATCH(), PUT(), POST(), POST(), dbToProduct() (+3 more)

### Community 46 - "FeatureCarousel.tsx"
Cohesion: 0.13
Nodes (7): BRANDS, CS, FeatureCarousel(), ITEMS, SLIDE_COMPS, SLIDES, FEATURES

### Community 47 - "Журнал изменений"
Cohesion: 0.12
Nodes (15): AI Stylist — журнал улучшений, Блок 1 — релевантность поиска (2026-06-04), Блок 1 (улучшение) — эмбеддинги переведены на OpenAI (2026-06-04), Блок 1 (фикс 2) — устойчивость бэкфилла к rate limit Replicate (2026-06-04), Блок 1 (фикс 3) — таймаут на эмбеддинг запроса в чате (2026-06-04), Блок 1 (фикс) — генерация эмбеддингов падала (2026-06-04), Блок 2 — модель и формат вызова (2026-06-04), Блок 3 — мобильный доступ / мёртвый код (2026-06-04) (+7 more)

### Community 48 - "ProductClient.tsx"
Cohesion: 0.09
Nodes (32): BrowsePage(), CATEGORY_ICONS, DEFAULT_COLOR_GROUPS, GENDERS, OCCASIONS, SortOption, STYLE_FILTERS, StyleFilter (+24 more)

### Community 49 - "GOO AI Stylist — Architecture"
Cohesion: 0.14
Nodes (13): GOO AI Stylist — Architecture, Как поменять модель, Как работает поиск по каталогу, Лимиты сообщений, Обзор, Переменные окружения, Персонализация, Почему это масштабируется (+5 more)

### Community 51 - "look/[id]/page.tsx"
Cohesion: 0.22
Nodes (13): dynamic, generateMetadata(), loadLook, lookHeading(), Props, resolveLook(), SharedLookPage(), SLOT_PRIORITY (+5 more)

### Community 52 - "Universal Product Parser"
Cohesion: 0.15
Nodes (12): 1. Fetch layer — "Fetch & Anti-bot" tab, 2. Universal extractor, 3. Normalizer, Files, Image quality, Importing, Listing / category pages, Security (+4 more)

### Community 53 - "analytics/route.ts"
Cohesion: 0.23
Nodes (12): bucketKey(), bucketSize(), EventRow, GET(), PageViewRow, percentile(), Range, rangeMs() (+4 more)

### Community 54 - "Бриф агента: работа по плану аудита"
Cohesion: 0.17
Nodes (11): 1. Стартовый промт, 2. Роль и рамки, 3. Источник истины, 4.1. Волны идут подряд, 4.2. Цикл одной задачи, 4.3. Одна задача — один коммит, 4. Порядок работы, 5. Жёсткие правила (+3 more)

### Community 55 - "Manual QA checklist — AI Stylist builder flow"
Cohesion: 0.17
Nodes (12): Fixes applied (`src/app/builder/page.tsx`), Follow-up Phase D4 — End-to-End Verification + Polish ✅, Full outfit (all 5 slots filled), Invalid or empty model output, Key missing (no OpenAI key configured), Manual QA checklist — AI Stylist builder flow, No product suggestions returned, Partial outfit (1–3 pieces selected) (+4 more)

### Community 56 - "PROJECT ANALYSIS — GOO Fashion"
Cohesion: 0.17
Nodes (11): 10. Git / branch policy, 1. TL;DR, 2. Directory Structure (current), 3. Pages (routes), 4. API Routes, 5. Auth, plans, rate-limiting, 6. Supabase schema, 7. Styling & typography (+3 more)

### Community 57 - "Product"
Cohesion: 0.25
Nodes (7): SelectedItem, Props, Props, ChatMessage, StylistDrawerProps, HomepageStylist, Product

### Community 58 - "goo-studio/blog/page.tsx"
Cohesion: 0.24
Nodes (10): AdminBlogPage(), BlogFormState, COMMON_CATEGORIES, defaultForm, formatDate(), slugify(), escapeHtml(), estimateReadTime() (+2 more)

### Community 59 - "RecentlyViewed.tsx"
Cohesion: 0.30
Nodes (9): ENDPOINT, Props, RecentlyViewed(), RecordRecentView(), getRecentlyViewed(), KEYS, read(), recordView() (+1 more)

### Community 60 - "🧠 Features"
Cohesion: 0.18
Nodes (10): 🚀 About the Project, 👗 AI Outfit Generator, 🤖 AI Stylist, 🛍 Fashion Discovery, 🧠 Features, 🛠 Getting Started, Goo Fashion 👕✨, 🧩 Outfit Builder (+2 more)

### Community 61 - "outfits/[id]/route.ts"
Cohesion: 0.27
Nodes (9): DELETE(), PATCH(), PUT(), GET(), POST(), createOutfit(), outfitToDb(), toggleOutfitHomepageFeatured() (+1 more)

### Community 62 - "_detect_bbox"
Cohesion: 0.47
Nodes (5): ndarray, _detect_bbox(), normalize(), Обнаружение bounding box товара на светлом (белом/серым) фоне. Алгоритм: 1.…, Result

### Community 63 - "goo-studio/layout.tsx"
Cohesion: 0.29
Nodes (6): AdminLayout(), darkVars, NAV_CATEGORIES, NAV_ITEMS, NavItem, pageTitles

### Community 64 - "proxy.ts"
Cohesion: 0.40
Nodes (5): clerk, config, isProtectedRoute, isPublicRoute, proxy()

### Community 65 - "db.ts"
Cohesion: 0.09
Nodes (27): blogPosts, asExtraStores(), asStringArray(), DEFAULT_COLOR_GROUPS, emptyShowcaseIds(), emptyStylistIds(), ExtraStore, getHomepageShowcaseIds() (+19 more)

### Community 66 - "currency-context.tsx"
Cohesion: 0.27
Nodes (9): applyFormat(), CURRENCIES, CurrencyCode, CurrencyContext, CurrencyContextValue, CurrencyInfo, CurrencyProvider(), FALLBACK_RATES (+1 more)

### Community 67 - "fetch.ts"
Cohesion: 0.31
Nodes (9): browserHeaders(), buildProviderUrl(), fetchHtml(), FetchResult, IMPERSONATE_UA, isBlockedDirectHost(), userAgentFor(), validateTargetUrl() (+1 more)

### Community 68 - "Follow-up Phase E1 — Extract StylistDrawer as Reusable Component ✅"
Cohesion: 0.22
Nodes (9): Files created / edited, Follow-up Phase E1 — Extract StylistDrawer as Reusable Component ✅, New component API, Notes for future Phase E steps, Recommended next prompt (Phase E2), Selected-state check refactored, What moved into the component, What remains builder-specific vs reusable (+1 more)

### Community 69 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 70 - "Change 2 — Clean Up Builder Header Area"
Cohesion: 0.22
Nodes (9): 2a — Duplicated wordmark and navigation, 2b — Remove the ○ ◐ ● decorative controls, 2c — Remove Stylist pill from builder inner header, Change 2 — Clean Up Builder Header Area, Files involved, Size / Risk, Three sub-problems, What needs product/UX decision (+1 more)

### Community 71 - "Change 6 — AI Stylist as a Site-Wide Real-API Feature"
Cohesion: 0.22
Nodes (9): 6a — Real chat API backend, 6b — Catalog-aware system prompt, 6c — API key management on server side, 6d — Site-wide integration: where should the Stylist appear?, 6e — Architecture diagram (recommended), Change 6 — AI Stylist as a Site-Wide Real-API Feature, Files involved (full implementation), Scope of what's being requested (+1 more)

### Community 72 - "OPEN QUESTIONS"
Cohesion: 0.22
Nodes (9): OPEN QUESTIONS, Q1 — Builder header: does the sub-header stay at all?, Q2 — AI Stylist trigger location after sub-header cleanup, Q3 — Product filter UX: slider vs. presets for price, Q4 — Shop the Look: flow model, Q5 — Shop the Look: affiliate tracking, Q6 — AI Stylist: shared server-side API key vs. per-user key, Q7 — AI Stylist site-wide surface: which pages? (+1 more)

### Community 73 - "HomeFullPageScroll.tsx"
Cohesion: 0.46
Nodes (7): classifyWheel(), easeInOutCubic(), HomeFullPageScroll(), isModalOpen(), isTypingTarget(), navHeight(), visibleSections()

### Community 74 - "goo-studio/page.tsx"
Cohesion: 0.31
Nodes (8): AdminDashboardPage(), fadeUp, fmtDelta(), fmtRelative(), initials(), staggerContainer, STAT_ACCENTS, StatsPayload

### Community 75 - "AUDIT_DEV_PLAN.md"
Cohesion: 0.25
Nodes (7): Б5-1. Закрыть `/api/report-bug` · 3–4 ч · **делать в Волне 1**, Б5-2. Rate-limit на остальные публичные эндпоинты · 3–4 ч, Б5-3. Не светить внутренний адрес в редиректах · 1 ч, Б5. Безопасность и утечки расходов — P1, Б9-1. Lifecycle-письма · 2–3 дня, Б9-2. Причина вернуться на второй день · продукт, Б9. Удержание и письма — P2

### Community 76 - "Волны выполнения"
Cohesion: 0.25
Nodes (8): Волна 1 — «сегодня и завтра» (Б0 целиком + Б5-1), Волна 2 — «первая неделя» (Б1, Б2, Б3, Б4, Б5), Волна 3 — «две–четыре недели» (Б6, Б7, Б9, Б10), Волна 4 — «месяц+» (Б8, Б11), Волны выполнения, Как читать этот документ, План разработки по итогам аудита, Сводка блоков

### Community 77 - "Follow-up Phase E4 — Rate Limiting + Public Hardening ✅"
Cohesion: 0.25
Nodes (8): AI Stylist rollout status, Browse z-index fix, Error hardening, Files created / edited, Follow-up Phase E4 — Rate Limiting + Public Hardening ✅, How rate limiting works, Input validation added (server-side), Required env vars (Upstash rate limiting)

### Community 78 - "Follow-up Phase D2 — AI Stylist Chat API Route ✅"
Cohesion: 0.25
Nodes (8): Catalog grounding, Error handling, File added, Follow-up Phase D2 — AI Stylist Chat API Route ✅, JSON extraction, Request shape, Response shape, System prompt (reproduced)

### Community 79 - "Follow-up Phase E3 — Browse Page AI Stylist Integration ✅"
Cohesion: 0.25
Nodes (8): Entry point, Files edited, Follow-up Phase E3 — Browse Page AI Stylist Integration ✅, How browse context is passed, Limitations before E4, New prop added to StylistDrawer, Recommended next prompt (Phase E4), Suggestion click behavior on browse

### Community 80 - "Change 5 — Clarify and Implement "Shop the Look""
Cohesion: 0.25
Nodes (8): Available retailer data per product, Change 5 — Clarify and Implement "Shop the Look", Files involved, Implementation options, Recommended implementation path, Size / Risk, What needs product/UX decision, What the problem is

### Community 81 - "AnalyticsTracker.tsx"
Cohesion: 0.25
Nodes (15): AnalyticsTracker(), Metric, reportVital(), shouldSkip(), beacon(), detectBrowser(), detectDevice(), detectOS() (+7 more)

### Community 82 - "image-tools/page.tsx"
Cohesion: 0.25
Nodes (4): Result, SAMPLE_URLS, Step, STEP_LABELS

### Community 84 - "report/page.tsx"
Cohesion: 0.25
Nodes (6): PRIORITIES, PRIORITY_BADGE, REPORTERS, Result, SECTIONS, StructuredBug

### Community 86 - "Б7. Воронка, главная, SEO — P2"
Cohesion: 0.29
Nodes (7): Б7-1. Ценностное предложение на главной · 1–2 дня, Б7-2. H1 и уникальные метаданные · 4–6 ч, Б7-3. Язык и рынок · 3–4 ч, Б7-4. Починить гидратацию React #418 · 1 день, Б7-5. Поведенческие раздражители · 1 день, Б7-6. og:image для блога · 1 ч, Б7. Воронка, главная, SEO — P2

### Community 88 - "Change 4 — Generate Available With Fewer Slots Filled"
Cohesion: 0.29
Nodes (7): API behavior note, Change 4 — Generate Available With Fewer Slots Filled, Files involved, Size / Risk, What needs product/UX decision, What the problem is, What to change

### Community 89 - "Change 3 — Add Useful Product Filters to Right Catalog Panel"
Cohesion: 0.29
Nodes (7): Change 3 — Add Useful Product Filters to Right Catalog Panel, Files involved, Implementation approach, Size / Risk, What needs product/UX decision, What the problem is, What to add

### Community 91 - "getAllBlogPosts"
Cohesion: 0.26
Nodes (10): GET(), POST(), BlogPage(), formatDate(), metadata, revalidate, blogPostToDb(), createBlogPost() (+2 more)

### Community 92 - "admin/stats/route.ts"
Cohesion: 0.38
Nodes (6): ClerkUserLite, daysAgo(), GET(), growthPct(), HealthReport, RecentRow

### Community 93 - "share/route.ts"
Cohesion: 0.52
Nodes (6): asTrimmedString(), isMissingColumnError(), mintLookId(), POST(), RawPiece, sanitizePieces()

### Community 94 - "Б0. Разблокировать оплату — P0"
Cohesion: 0.33
Nodes (6): Б0-1. Починить ссылку на вход в воронке оплаты · 15 мин, Б0-2. Сделать настоящую страницу регистрации · 2–3 ч, Б0-3. Починить изображения каталога (429) · 2–4 ч, Б0-4. Диагностика автопродления в Supabase · 30 мин (не код), Б0-5. Проверить `CRON_SECRET` в окружении Vercel · 15 мин, Б0. Разблокировать оплату — P0

### Community 95 - "Б1. Биллинг: надёжность и наблюдаемость — P0/P1"
Cohesion: 0.33
Nodes (6): Б1-1. `activateSubscription()` должен падать, если строка не обновилась · 3–4 ч, Б1-2. Не терять токен карты · 2–3 ч, Б1-3. Перестать глушить журнал платежей · 1–2 ч, Б1-4. Алерты по биллингу · 1 день, Б1-5. Показать состояние биллинга в админке · 1 день, Б1. Биллинг: надёжность и наблюдаемость — P0/P1

### Community 96 - "Б2. Гейты и квоты: за что платят — P1"
Cohesion: 0.33
Nodes (6): Б2-1. Закрыть AI-стилиста тарифом с бесплатной воронкой · 1 день, Б2-2. Закрыть сохранение образов тарифом Pro · 3–4 ч, Б2-3. Месячная квота генераций изображений · 2 дня — **самая дорогая дыра**, Б2-4. Перевести лимиты стилиста на месячные · 4–6 ч, Б2-5. Реализовать или убрать функции Premium · 1–2 дня (или 0, см. Б3), Б2. Гейты и квоты: за что платят — P1

### Community 97 - "Б8. Каталог и контент — P2"
Cohesion: 0.33
Nodes (6): Б8-1. Массовое проставление `styleKeywords` · 2–3 дня, Б8-2. Женский сегмент · зависит от источников, Б8-3. Описания товаров · 1–2 дня + генерация, Б8-4. Готовые образы и блог · продолжающееся, Б8-5. Определиться с ценовым позиционированием · решение продукта, Б8. Каталог и контент — P2

### Community 98 - "Follow-up Phase D1 — AI Stylist Key Infrastructure ✅"
Cohesion: 0.33
Nodes (6): Admin authorization, Admin settings UI changes, Files added / changed, Follow-up Phase D1 — AI Stylist Key Infrastructure ✅, How the key is stored and accessed, Schema assumptions

### Community 99 - "Follow-up Phase C2 — Shop the Look + Cart System ✅"
Cohesion: 0.33
Nodes (6): Cart data structure, Duplicate handling, Files changed, Follow-up Phase C2 — Shop the Look + Cart System ✅, Interaction model, Limitations

### Community 100 - "Phase 3d — Right Panel Catalog Rebuild ✅"
Cohesion: 0.33
Nodes (6): Phase 3d — ✅ Done, Phase 3d — Right Panel Catalog Rebuild ✅, Phase 3e — ✅ Complete (2026-04-18), Phase 3f — ✅ Complete (2026-04-18), Phase 4 — ✅ Complete (folded into Phase 3f), What was done

### Community 101 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 102 - "Change 1 — Reduce Center Canvas Visual Dominance"
Cohesion: 0.33
Nodes (6): Change 1 — Reduce Center Canvas Visual Dominance, Files involved, Size / Risk, What needs product/UX decision, What the problem is, What to change

### Community 103 - "Recommended Execution Phases"
Cohesion: 0.33
Nodes (6): Phase A — Quick wins, no product decisions needed (1–2 sessions), Phase B — Filters and polish (1 session, no blocking decisions), Phase C — After product decisions on Q1/Q2 and Q4/Q5 (1–2 sessions), Phase D — AI Stylist v1: real API in builder drawer (2–3 sessions), Phase E — AI Stylist v2: site-wide (after validating Phase D), Recommended Execution Phases

### Community 104 - "render"
Cohesion: 0.47
Nodes (5): Image, load_font_bytes(), main(), Отрисовать иконку size×size со сглаживанием через суперсэмплинг., render()

### Community 105 - "checkout/route.ts"
Cohesion: 0.52
Nodes (6): POST(), PAID_PLAN_IDS, planPriceMinor(), createInvoice(), buildReference(), upsertPendingSubscription()

### Community 106 - "admin-auth.ts"
Cohesion: 0.20
Nodes (13): GET(), GET(), ClerkError, DELETE(), errMsg(), GET(), PATCH(), AdminUserRow (+5 more)

### Community 107 - "image-tools/route.ts"
Cohesion: 0.60
Nodes (5): ensureProductImagesBucket(), fetchImageBuffer(), POST(), removeBackground(), uploadToStorage()

### Community 108 - "email/route.ts"
Cohesion: 0.42
Nodes (8): buildHtml(), buildPlainText(), esc(), GET(), inlineFormat(), POST(), resolveRecipients(), textToHtml()

### Community 109 - "group/route.ts"
Cohesion: 0.60
Nodes (5): DELETE(), GET(), isMissingColumnError(), MIGRATION_COLUMNS, POST()

### Community 110 - "opengraph-image.tsx"
Cohesion: 0.33
Nodes (4): alt, contentType, runtime, size

### Community 111 - "templates/route.ts"
Cohesion: 0.23
Nodes (10): DELETE(), EmailTemplate, GET(), loadTemplates(), POST(), saveTemplates(), Audience, AUDIENCE_OPTIONS (+2 more)

### Community 112 - "8. Доска статусов"
Cohesion: 0.40
Nodes (5): 8. Доска статусов, Волна 1 — разблокировать оплату, Волна 2 — за что платят и чем меряем, Волна 3 — рост, Волна 4 — каталог и модель

### Community 113 - "Billing — monobank (Plata by mono)"
Cohesion: 0.40
Nodes (4): Billing — monobank (Plata by mono), Files, How it works, Setup checklist

### Community 114 - "Claude Code Instructions"
Cohesion: 0.40
Nodes (4): Branch Policy, Claude Code Instructions, graphify, Работа по плану аудита — читать первым

### Community 119 - "AIStylistChat.tsx"
Cohesion: 0.50
Nodes (4): AIStylistChat(), CONV, Msg, STEPS

### Community 120 - "Б10. Производительность и мобильный UX — P2"
Cohesion: 0.50
Nodes (4): Б10-1. Похудеть builder · 2 дня, Б10-2. Размеры элементов на мобильном · 1 день, Б10-3. `/sitemap-page` · 4 ч, Б10. Производительность и мобильный UX — P2

### Community 121 - "Б11. Решение о бизнес-модели — P0 (решение, не код)"
Cohesion: 0.50
Nodes (4): Б11. Решение о бизнес-модели — P0 (решение, не код), Метрики, которые смотрим после каждой волны, На что опираемся — не переделывать, Что осталось непроверенным аудитом

### Community 122 - "Б3. Тарифы: обещания = код — P1"
Cohesion: 0.50
Nodes (4): Б3-1. Привести `/plans` в соответствие с реальностью · 1 день, Б3-2. Честная валюта · 2–3 ч, Б3-3. Пересмотреть сетку тарифов · решение продукта, 4 ч на внедрение, Б3. Тарифы: обещания = код — P1

### Community 123 - "Б4. Аналитика и измеримость — P1"
Cohesion: 0.50
Nodes (4): Б4-1. Починить Vercel Analytics · 2–4 ч, Б4-2. Расставить `track()` по воронке · 1–2 дня, Б4-3. Дашборд воронки в админке · 1 день, Б4. Аналитика и измеримость — P1

### Community 124 - "Б6. Партнёрская монетизация — P1/P2"
Cohesion: 0.50
Nodes (4): Б6-1. Подключить партнёрку Farfetch · 2 дня (из них ожидание модерации), Б6-2. Трекинг кликов «Where to buy» · 4–6 ч, Б6-3. Отчёт по партнёрским доходам в админке · 1 день, Б6. Партнёрская монетизация — P1/P2

### Community 125 - "9. Эскалация к CEO"
Cohesion: 0.50
Nodes (4): 9. Эскалация к CEO, Когда останавливаться, Тон отчёта, Форма отчёта

### Community 126 - "Manual QA Checklist (final browser testing)"
Cohesion: 0.50
Nodes (4): Cross-cutting, Desktop (≥ 768px viewport), Manual QA Checklist (final browser testing), Mobile (< 768px viewport)

### Community 127 - "Follow-up Phase C1 — Builder Header Cleanup ✅"
Cohesion: 0.50
Nodes (4): Follow-up Phase C1 — Builder Header Cleanup ✅, Header hierarchy after changes, Remaining UI inconsistencies, What was done

### Community 128 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 129 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 130 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 132 - "preview/route.ts"
Cohesion: 0.67
Nodes (5): buildHtml(), esc(), inlineFormat(), POST(), textToHtml()

### Community 134 - "Follow-up Phase E2 — Product Detail Page AI Stylist Integration ✅"
Cohesion: 0.67
Nodes (3): Files edited, Follow-up Phase E2 — Product Detail Page AI Stylist Integration ✅, New props added to StylistDrawer in E2

### Community 135 - "Follow-up Phase A — Canvas Balance + Decorative Cleanup + Generate Threshold ✅"
Cohesion: 0.67
Nodes (3): Follow-up Phase A — Canvas Balance + Decorative Cleanup + Generate Threshold ✅, Visual tradeoffs, What was done

### Community 136 - "Pending Steps"
Cohesion: 0.67
Nodes (3): Pending Steps, Phase 3b — ✅ Done, Phase 3c — ✅ Done

### Community 137 - "ImageCropEditor.tsx"
Cohesion: 0.47
Nodes (5): clamp(), DEFAULT_CROP, ImageCropEditor(), Props, CropData

### Community 138 - "Phase 3a — Builder Shell + Layout Foundation ✅"
Cohesion: 0.67
Nodes (3): Phase 3a — Builder Shell + Layout Foundation ✅, What did NOT change, What was done

### Community 168 - "blog/[id]/route.ts"
Cohesion: 0.60
Nodes (4): DELETE(), PUT(), deleteBlogPost(), updateBlogPost()

### Community 169 - "price-history/route.ts"
Cohesion: 0.67
Nodes (3): GET(), mockHistory(), POST()

### Community 170 - "renew/route.ts"
Cohesion: 0.20
Nodes (16): dynamic, GET(), maxDuration, SITE_URL, alertRecipients(), esc(), render(), sendBillingAlert() (+8 more)

### Community 171 - "Phase 1 — Global Font System ✅"
Cohesion: 0.67
Nodes (3): Phase 1 — Global Font System ✅, Verification, What was done

## Knowledge Gaps
- **816 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+811 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireAdmin()` connect `requireAdmin` to `csv-import/route.ts`, `chat/route.ts`, `preview/route.ts`, `supabase.ts`, `generate-outfit/route.ts`, `config/route.ts`, `blog/[id]/route.ts`, `categories/route.ts`, `price-history/route.ts`, `logAdminAction`, `dbToProduct`, `analytics/route.ts`, `outfits/[id]/route.ts`, `getAllBlogPosts`, `admin/stats/route.ts`, `admin-auth.ts`, `image-tools/route.ts`, `email/route.ts`, `group/route.ts`, `templates/route.ts`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `supabase` connect `supabase.ts` to `csv-import/route.ts`, `chat/route.ts`, `generate-outfit/route.ts`, `requireAdmin`, `config/route.ts`, `subscriptions.ts`, `plans.ts`, `lib/types.ts`, `categories.ts`, `categories/route.ts`, `price-history/route.ts`, `logAdminAction`, `dbToProduct`, `analytics/route.ts`, `outfits/[id]/route.ts`, `db.ts`, `admin/stats/route.ts`, `share/route.ts`, `admin-auth.ts`, `image-tools/route.ts`, `group/route.ts`, `templates/route.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `@vercel/analytics`, `@vercel/speed-insights`, `web-vitals`, `package.json`, `cn`, `class-variance-authority`, `@clerk/nextjs`, `clsx`, `openai`, `@radix-ui/react-slot`, `recharts`, `replicate`, `resend`, `@supabase/supabase-js`, `@upstash/redis`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _816 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `csv-import/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05879692446856626 - nodes in this community are weakly interconnected._
- **Should `chat/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.061581920903954805 - nodes in this community are weakly interconnected._
- **Should `theme-context.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._