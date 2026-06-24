# Graph Report - .  (2026-06-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1378 nodes · 2622 edges · 91 communities (74 shown, 17 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ff70486e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 90|Community 90]]

## God Nodes (most connected - your core abstractions)
1. `requireAdmin()` - 116 edges
2. `Product` - 26 edges
3. `POST()` - 25 edges
4. `useCurrency()` - 22 edges
5. `useLikes()` - 20 edges
6. `Outfit` - 20 edges
7. `useAuth()` - 19 edges
8. `compilerOptions` - 16 edges
9. `getAllOutfits()` - 15 edges
10. `PlanId` - 15 edges

## Surprising Connections (you probably didn't know these)
- `DELETE()` --calls--> `requireAdmin()`  [INFERRED]
  src/app/api/outfits/[id]/route.ts → src/lib/server/admin-auth.ts
- `normalizeRetailers()` --calls--> `slug()`  [INFERRED]
  src/lib/data/db.ts → src/app/api/admin/brand-logo/route.ts
- `GET()` --calls--> `requireAdmin()`  [EXTRACTED]
  src/app/api/admin/email/route.ts → src/lib/server/admin-auth.ts
- `GET()` --calls--> `requireAdmin()`  [EXTRACTED]
  src/app/api/admin/embeddings/route.ts → src/lib/server/admin-auth.ts
- `sharedLookFromShareData()` --calls--> `httpUrl()`  [INFERRED]
  src/lib/data/db.ts → src/app/api/admin/parser/import/route.ts

## Import Cycles
- None detected.

## Communities (91 total, 17 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (56): CATEGORIES, Category, CSVMappedRow, ImportResult, Merchant, Step, boostAwinkImageUrl(), cleanName() (+48 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (61): buildState(), GET(), IMPERSONATE, maskKey(), POST(), PROVIDERS, sanitizeFetchSettings(), sanitizeSiteConfigs() (+53 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (51): augmentQuery(), BrowseContext, buildBrowseContext(), buildCatalogBlock(), buildFocusContext(), buildOutfitContext(), buildPersonalizationBlock(), buildSearchQuery() (+43 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (44): dependencies, @anthropic-ai/sdk, class-variance-authority, @clerk/nextjs, clsx, framer-motion, lucide-react, next (+36 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (29): POST(), GET(), DELETE(), POST(), slug(), DELETE(), GET(), KEYS (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (20): COUNTRY_NAMES, countryFlag(), countryLabel(), PALETTE, PieItem, tooltipStyle, AdminAnalyticsPage(), BrowserPie (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (28): HeroHeader(), Logo(), menuItems, transitionVariants, HeroSection(), useMousePositionRef(), cn(), AnimatedGroup() (+20 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (28): CATALOG_CHIPS, CatalogItem, CATEGORY_GROUPS, FIGURE_SLOTS, MOBILE_CHIPS, PRICE_BUCKETS, SlotId, SLOTS (+20 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (27): NotFound(), getBrandLogos(), getOutfitsByProductId(), OutfitDetailPage(), ProductDetailPage(), AVAILABILITY, availabilityUrl(), breadcrumbJsonLd() (+19 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (27): blogPosts, asExtraStores(), asStringArray(), DEFAULT_COLOR_GROUPS, emptyShowcaseIds(), emptyStylistIds(), ExtraStore, getHomepageShowcaseIds() (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (8): ALLOWED_EVENTS, DbBlogPost, DbImportJob, DbOutfit, DbOutfitItem, POST(), resolveCountry(), ALLOWED_METRICS

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (27): browserHeaders(), buildItemsList(), buildPrompt(), fetchAsDataUri(), fetchBuffer(), POST(), SlotProduct, Style (+19 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (17): DEFAULT_CROP, ImageCropEditor(), Props, CropData, AVAILABILITY_OPTIONS, CATEGORIES, CATEGORY_CONFIG, DEFAULT_COLOR_GROUPS (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.21
Nodes (21): POST(), POST(), planPriceMinor(), SITE_URL, GET(), chargeWallet(), createInvoice(), activateSubscription() (+13 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (16): PostHogTracker(), interTight, metadata, poppins, viewport, CartContext, CartContextValue, CartItem (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (18): BuilderPage(), useAuth(), useCart(), useCurrency(), useLikes(), ProductSwatch, OutfitActions(), OutfitCard() (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (13): HomepageStylist, Props, Product, SelectedItem, Props, ChatSession, BrowseContext, CATEGORY_TO_SLOT (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (14): outfits, products, Occasion, StyleKeyword, CATEGORIES, defaultForm, OCCASIONS, OutfitFormState (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (15): StylistContext, StylistCtx, StylistProvider(), useStylist(), ChatPreview(), EASE, FeaturesBento(), FeaturesBentoProps (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (18): HomepageShowcaseIds, POST(), STEPS, ClerkError, errMsg(), GET(), GET(), getSuperAdminId() (+10 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (16): AnalyticsTracker(), Metric, reportVital(), beacon(), detectBrowser(), detectDevice(), detectOS(), getCountryCode() (+8 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (18): bucketKey(), bucketSize(), EventRow, GET(), PageViewRow, percentile(), Range, rangeMs() (+10 more)

### Community 22 - "Community 22"
Cohesion: 0.12
Nodes (15): BROWSE_CATEGORY_GROUPS, BROWSE_SUBCAT_TO_VALUE, BrowsePage(), DEFAULT_COLOR_GROUPS, GENDERS, OCCASIONS, SortOption, STYLE_FILTERS (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (15): AuthProvider(), coercePlan(), Feature, FEATURE_LABELS, minimumPlanFor(), PaidPlanId, PLAN_ORDER, PlanDefinition (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (8): HomepageShowcase, ShowcaseItem, buildSteps(), HowItWorksSection(), FadeInView(), FadeInViewProps, FloatLoop(), FloatLoopProps

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (17): API_BASE, call(), ChargeWalletParams, ChargeWalletResult, CreateInvoiceParams, CreateInvoiceResult, fetchPublicKeyPem(), getInvoiceStatus() (+9 more)

### Community 26 - "Community 26"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (12): EASE, Props, Outfit, OutfitItem, OutfitCardProps, CardProps, CarouselCard(), getTags() (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (13): fmtDate(), fmtDuration(), fmtRelative(), initials(), PLAN_OPTIONS, planBadge, STATUS_OPTIONS, StatusFilter (+5 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (13): sitemap(), BlogPage(), metadata, getAllBlogPosts(), getAllProducts(), getProductsByCategory(), groupVariants(), shuffleArray() (+5 more)

### Community 30 - "Community 30"
Cohesion: 0.12
Nodes (15): CurrencyCode, ALL_FEATURES, BODY_TYPES, BodyType, BUDGET_OPTIONS, COLOR_PALETTE, formatDate(), PLAN_FEATURE_LABELS (+7 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (6): BRANDS, CS, ITEMS, SLIDE_COMPS, SLIDES, FEATURES

### Community 32 - "Community 32"
Cohesion: 0.14
Nodes (11): approxUsd(), ByPlan, EVENT_LABEL, EVENT_STYLE, Payload, STATUS_STYLE, SubItem, SubscriptionsPage() (+3 more)

### Community 33 - "Community 33"
Cohesion: 0.26
Nodes (10): POST(), dbToProduct(), productToDb(), noDb(), DbProduct, POST(), POST(), DELETE() (+2 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (11): ShowcaseStore, StylistChatLook, AIStylistShowcaseProps, BuyRow(), BuyRowData, EASE, FeaturedProduct(), FEATURES (+3 more)

### Community 35 - "Community 35"
Cohesion: 0.31
Nodes (8): POST(), fetchPageText(), isAllowedExternalUrl(), POST(), slugify(), getOpenAIKey(), getPrompt(), POST()

### Community 36 - "Community 36"
Cohesion: 0.23
Nodes (10): getData(), HomePage(), getAllOutfits(), getFeaturedOutfits(), getHomepageShowcase(), getHomepageStylist(), getProductById(), organizationJsonLd() (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.19
Nodes (13): AuthUser, PlanId, planPriceDual(), planPriceLabel(), planPriceUsdLabel(), BillingStatus, PlanCheckSuccess, SubscriptionRow (+5 more)

### Community 38 - "Community 38"
Cohesion: 0.16
Nodes (6): BodyType, FilterState, Plan, ProductReview, UserProfile, Props

### Community 39 - "Community 39"
Cohesion: 0.21
Nodes (9): Theme, ThemeContext, ThemeContextValue, ThemePreference, ThemeProvider(), useTheme(), MobileBottomNav(), HeroBackground() (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.24
Nodes (12): enrichSharedLookPieces(), getUserLookById(), SharedLook, sharedLookFromShareData(), loadLook, lookHeading(), resolveLook(), SharedLookPage() (+4 more)

### Community 41 - "Community 41"
Cohesion: 0.23
Nodes (10): Audience, AUDIENCE_OPTIONS, SendResult, StatusData, DELETE(), EmailTemplate, GET(), loadTemplates() (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.15
Nodes (11): EMPTY_SHOWCASE, EMPTY_STYLIST, ExtraStoreForm, KeyStatus, PickerItem, ShowcaseIds, STEP_META, StepKey (+3 more)

### Community 43 - "Community 43"
Cohesion: 0.26
Nodes (10): createOutfit(), dbToOutfit(), getOutfitById(), outfitToDb(), toggleOutfitHomepageFeatured(), updateOutfit(), POST(), DELETE() (+2 more)

### Community 44 - "Community 44"
Cohesion: 0.27
Nodes (9): getBlogPostBySlug(), renderBlogBody(), absoluteUrl(), blogPostingJsonLd(), JsonLdProps, BlogPostPage(), formatDate(), generateMetadata() (+1 more)

### Community 45 - "Community 45"
Cohesion: 0.20
Nodes (8): PAID_PLAN_IDS, LIFESTYLE_OPTIONS, PRONOUNS_OPTIONS, STEP_TITLES, STYLE_GOALS, StylistPersonalization, StylistPersonalizationModal(), PLAN_COPY

### Community 46 - "Community 46"
Cohesion: 0.24
Nodes (7): AdminBlogPage(), BlogFormState, COMMON_CATEGORIES, defaultForm, slugify(), estimateReadTime(), SANITIZE_OPTIONS

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (9): GET(), POST(), blogPostToDb(), createBlogPost(), dbToBlogPost(), deleteBlogPost(), updateBlogPost(), DELETE() (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.18
Nodes (8): AuthContext, AuthContextValue, AdminLayout(), darkVars, NAV_CATEGORIES, NAV_ITEMS, NavItem, pageTitles

### Community 49 - "Community 49"
Cohesion: 0.31
Nodes (7): GET(), POST(), ProductRow, embedText(), embedTextOrThrow(), embedTextsOrThrow(), openaiClient()

### Community 50 - "Community 50"
Cohesion: 0.20
Nodes (5): PLAN_PRICE_UAH, Cell, COMPARISON, FAQ_ITEMS, PLANS

### Community 51 - "Community 51"
Cohesion: 0.22
Nodes (4): ACTION_COLORS, ACTION_LABELS, AdminActivityPage(), AuditEntry

### Community 52 - "Community 52"
Cohesion: 0.42
Nodes (8): buildHtml(), buildPlainText(), esc(), GET(), inlineFormat(), POST(), resolveRecipients(), textToHtml()

### Community 53 - "Community 53"
Cohesion: 0.28
Nodes (7): AdminDashboardPage(), fadeUp, fmtDelta(), fmtRelative(), staggerContainer, STAT_ACCENTS, StatsPayload

### Community 54 - "Community 54"
Cohesion: 0.25
Nodes (5): DEFAULT_BRANDS, POST(), GET(), mockHistory(), POST()

### Community 55 - "Community 55"
Cohesion: 0.25
Nodes (4): Result, SAMPLE_URLS, Step, STEP_LABELS

### Community 56 - "Community 56"
Cohesion: 0.25
Nodes (6): PRIORITIES, PRIORITY_BADGE, REPORTERS, Result, SECTIONS, StructuredBug

### Community 57 - "Community 57"
Cohesion: 0.29
Nodes (5): LikesContext, LikesContextValue, LikesProvider(), PREFIX, WishlistCategory

### Community 58 - "Community 58"
Cohesion: 0.38
Nodes (6): GET(), ClerkUserLite, daysAgo(), growthPct(), HealthReport, RecentRow

### Community 59 - "Community 59"
Cohesion: 0.47
Nodes (5): GET(), POST(), getAllColorGroups(), DbColorGroup, dbToColorGroup()

### Community 60 - "Community 60"
Cohesion: 0.47
Nodes (5): DELETE(), GET(), isMissingColumnError(), MIGRATION_COLUMNS, POST()

### Community 61 - "Community 61"
Cohesion: 0.60
Nodes (5): ensureProductImagesBucket(), fetchImageBuffer(), POST(), removeBackground(), uploadToStorage()

### Community 62 - "Community 62"
Cohesion: 0.47
Nodes (5): ndarray, _detect_bbox(), normalize(), Обнаружение bounding box товара на светлом (белом/серым) фоне.      Алгоритм:, Result

### Community 63 - "Community 63"
Cohesion: 0.67
Nodes (5): buildHtml(), esc(), inlineFormat(), POST(), textToHtml()

### Community 64 - "Community 64"
Cohesion: 0.40
Nodes (5): clerk, config, isProtectedRoute, isPublicRoute, proxy()

### Community 66 - "Community 66"
Cohesion: 0.40
Nodes (3): CONV, Msg, STEPS

### Community 67 - "Community 67"
Cohesion: 0.40
Nodes (4): PricePoint, PAD, PriceHistoryChart(), Props

## Knowledge Gaps
- **408 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+403 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireAdmin()` connect `Community 4` to `Community 0`, `Community 1`, `Community 2`, `Community 9`, `Community 19`, `Community 21`, `Community 23`, `Community 33`, `Community 35`, `Community 41`, `Community 43`, `Community 47`, `Community 49`, `Community 52`, `Community 54`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 63`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `Product` connect `Community 16` to `Community 0`, `Community 34`, `Community 38`, `Community 7`, `Community 8`, `Community 9`, `Community 11`, `Community 12`, `Community 15`, `Community 17`, `Community 18`, `Community 22`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `requireAdmin()` (e.g. with `GET()` and `GET()`) actually correct?**
  _`requireAdmin()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _409 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05126452494873548 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06874717322478517 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06778476589797344 - nodes in this community are weakly interconnected._