// Fixtures for goo-studio Analytics, Settings, Prompts and Blog.
// Shapes follow src/app/api/admin/{analytics,schema-check,settings,embeddings,
// homepage-showcase,homepage-stylist,prompts}/route.ts and src/app/api/blog/route.ts.
// Numbers follow docs/ADMIN_UX_REVIEW_2026-10.md (LT ~52% of traffic, 12 missing
// migrations, 284/1224 embeddings, last blog post published 2026-06-15, ...).
const fs = require("fs");
const path = require("path");
const { products, IMG, TOTAL_PRODUCTS } = require("./catalog");

const NOW = Date.parse("2026-10-05T12:00:00Z");
const DAY = 86400e3;
const HOUR = 3600e3;

// Deterministic noise.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const P = (i) => products[i % products.length];

// ── Outfits (only served if no other fixture serves GET /api/outfits) ────────
const OUTFIT_DEFS = [
  ["Weekend in Vilnius", "casual", [17, 4, 7], "#a8a29e"],
  ["Monochrome office", "work", [14, 3, 19], "#1f2937"],
  ["Off-duty sneakers", "weekend", [8, 16, 10], "#d1d5db"],
  ["Linen summer", "vacation", [40, 4, 24], "#f5f5f0"],
  ["Gallery opening", "evening", [21, 15, 11], "#111111"],
  ["Rainy commute", "casual", [5, 16, 18], "#334155"],
];
const outfitId = (i) => `7c1e0a52-${String(2000 + i)}-4b7d-8e21-${String(500000000000 + i * 104729).slice(-12)}`;
const OUTFITS = OUTFIT_DEFS.map(([name, occasion, idx, hex], i) => {
  const items = idx.map((k, j) => ({ product: P(k), role: j === 0 ? "hero" : j === 1 ? "secondary" : "accent" }));
  return {
    id: outfitId(i), name, description: `${name}: a ${occasion} look from the GOO catalogue.`, occasion,
    imageUrl: IMG(outfitId(i), hex, "look"), items,
    totalPriceMin: Math.round(items.reduce((s, it) => s + it.product.priceMin, 0)),
    totalPriceMax: Math.round(items.reduce((s, it) => s + it.product.priceMax, 0)),
    currency: "USD", styleKeywords: ["minimal"], isAIGenerated: i % 2 === 0, isSaved: false, season: "all",
    source: null, isHomepageFeatured: i < 2, createdAt: new Date(NOW - (i + 3) * 4 * DAY).toISOString(),
  };
});

// A shared route defined by another fixture wins; ours is only a fallback.
const SELF = path.basename(__filename);
function otherFixtureDefines(key) {
  try {
    return fs.readdirSync(__dirname)
      .filter((f) => f.endsWith(".js") && f !== SELF && f !== "catalog.js")
      .some((f) => {
        const t = fs.readFileSync(path.join(__dirname, f), "utf8");
        return t.includes(`"${key}"`) || t.includes(`'${key}'`) || t.includes("`" + key + "`");
      });
  } catch { return false; }
}

// Resolve the outfits list the page will actually receive (whoever serves it),
// so the showcase picks reference ids that exist.
async function effectiveOutfits() {
  const merged = {};
  for (const f of fs.readdirSync(__dirname).filter((f) => f.endsWith(".js") && f !== "catalog.js")) {
    try {
      const m = f === SELF ? module.exports : require(path.join(__dirname, f));
      Object.assign(merged, (m && m.routes) || {});
    } catch {}
  }
  let v = merged["GET /api/outfits"];
  if (typeof v === "function") v = await v({ url: new URL("http://localhost:3100/api/outfits"), method: "GET", body: null });
  return Array.isArray(v) && v.length ? v : OUTFITS;
}

// ── Analytics ────────────────────────────────────────────────────────────────
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
const hourKey = (t) => new Date(t).toISOString().slice(0, 13) + ":00";

// 90 days of daily traffic, growing, with a weekend bump, one Instagram spike
// and a partial "today" (12:00 UTC).
const DAILY = (() => {
  const r = rng(42);
  const out = [];
  for (let i = 89; i >= 0; i--) {
    const t = NOW - i * DAY;
    const d = new Date(t);
    const wd = d.getUTCDay(); // 0 = Sun
    const wk = [1.16, 0.93, 0.95, 0.98, 1.0, 1.04, 1.12][wd];
    let views = (92 + (89 - i) * 2.15) * wk * (0.86 + r() * 0.28);
    if (dayKey(t) === "2026-09-24") views *= 2.1; // Instagram post
    if (dayKey(t) === "2026-09-25") views *= 1.35;
    if (i === 0) views *= 0.38; // today so far
    views = Math.round(views);
    const sessions = Math.round(views * (0.39 + r() * 0.05));
    out.push({ bucket: dayKey(t), views, sessions });
  }
  return out;
})();

// Kyiv-hour profile of traffic (index = Kyiv hour).
const HOUR_W = [0.9, 0.55, 0.35, 0.22, 0.18, 0.2, 0.32, 0.55, 0.8, 1.0, 1.1, 1.15, 1.25, 1.3, 1.2, 1.15, 1.2, 1.3, 1.45, 1.7, 1.9, 2.05, 1.85, 1.35];
const WD_W = [0.93, 0.95, 0.98, 1.0, 1.04, 1.12, 1.16]; // Mon..Sun

const STYLIST_DAILY = [
  { date: "2026-07-29", count: 4 },
  { date: "2026-08-14", count: 11 },
  { date: "2026-09-12", count: 14 },
  { date: "2026-09-18", count: 3 },
  { date: "2026-09-27", count: 22 },
  { date: "2026-10-02", count: 6 },
  { date: "2026-10-04", count: 9 },
];

const DELETED_PRODUCT = "0aa26cb7-0977-4c1e-9f6a-3f19c0d2a8e1";
const DELETED_OUTFIT = "7c1e0a52-1987-4b7d-8e21-a0b4c66e1f07";

function analytics(range) {
  const days = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 }[range];
  const r = rng(days * 7 + 3);
  let timeseries;
  if (range === "24h") {
    // 24 hourly buckets ending with the current (just started) hour.
    const yesterday = DAILY[DAILY.length - 2].views;
    const today = DAILY[DAILY.length - 1].views;
    const sumW = HOUR_W.reduce((a, b) => a + b, 0);
    timeseries = [];
    for (let i = 23; i >= 0; i--) {
      const t = NOW - i * HOUR;
      const kyivH = (new Date(t).getUTCHours() + 3) % 24;
      const sameDay = dayKey(t) === dayKey(NOW);
      const dayViews = sameDay ? today / 0.38 : yesterday;
      let views = Math.round((dayViews * HOUR_W[kyivH]) / sumW * (0.8 + r() * 0.4));
      if (i === 0) views = 2; // the hour that just started
      timeseries.push({ bucket: hourKey(t), views, sessions: Math.max(i === 0 ? 2 : 1, Math.round(views * 0.42)) });
    }
  } else {
    timeseries = DAILY.slice(-days);
  }
  const pageViews = timeseries.reduce((s, t) => s + t.views, 0);
  const sessions = Math.round(timeseries.reduce((s, t) => s + t.sessions, 0) * (range === "24h" ? 0.55 : 0.93));
  const sc = (x) => Math.max(1, Math.round(x));
  const share = (rows) => rows.map(([key, p]) => ({ key, count: sc(pageViews * p) }));

  const last24 = Math.round((DAILY[89].sessions + DAILY[88].sessions * 0.5) * 0.9);
  const last7 = Math.round(DAILY.slice(-7).reduce((s, t) => s + t.sessions, 0) * 0.93);
  const last30 = Math.round(DAILY.slice(-30).reduce((s, t) => s + t.sessions, 0) * 0.93);

  // Top pages: home, browse, product pages by raw UUID, an outfit, blog.
  const pagesW = [
    ["/", 0.19, 1420], ["/browse", 0.14, 1980], ["/builder", 0.06, 2310],
    [`/product/${P(0).id}`, 0.036, 1760], [`/product/${P(11).id}`, 0.031, 1690],
    ["/blog", 0.025, 1240], ["/plans", 0.021, 1110], [`/product/${P(7).id}`, 0.02, 1830],
    [`/outfit/${OUTFITS[0].id}`, 0.018, 2050], ["/saved", 0.015, 1390],
    [`/product/${P(18).id}`, 0.014, 1720], ["/login", 0.013, 980],
    ["/blog/linen-done-right-summer-buying-guide", 0.012, 1310],
    [`/product/${DELETED_PRODUCT}`, 0.011, 1640], ["/profile", 0.01, 1270],
  ];
  const topPages = pagesW.map(([p, w, ms]) => ({ path: p, views: sc(pageViews * w), avgLoadMs: ms }));

  const prodW = [[0, 0.036], [11, 0.031], [7, 0.02], [18, 0.014], [null, 0.011], [10, 0.0095], [22, 0.008], [15, 0.0072], [null, 0.0061], [5, 0.0055]];
  const topProducts = prodW.map(([i, w], k) => {
    if (i === null) return { key: k === 4 ? DELETED_PRODUCT : "0aa26cb7-0951-4c1e-9f6a-77d2e019bb34", count: sc(pageViews * w), name: null, brand: null, imageUrl: null };
    const p = P(i);
    return { key: p.id, count: sc(pageViews * w), name: p.name, brand: p.brand, imageUrl: p.imageUrl };
  });
  const topOutfits = [[0, 0.018], [3, 0.009], [1, 0.0071], [null, 0.0044], [4, 0.003]].map(([i, w]) =>
    i === null
      ? { key: DELETED_OUTFIT, count: sc(pageViews * w), name: null, imageUrl: null }
      : { key: OUTFITS[i].id, count: sc(pageViews * w), name: OUTFITS[i].name, imageUrl: OUTFITS[i].imageUrl });

  const heatmap = WD_W.map((wdw) => HOUR_W.map((hw) => Math.round(pageViews * wdw * hw / (7 * 25.6) * (0.75 + r() * 0.5))));

  const stylistDaily = range === "24h"
    ? []
    : STYLIST_DAILY.filter((d) => d.date >= DAILY[DAILY.length - days].bucket);
  const terms = [["linen shirt", 14], ["jordan", 11], ["black jeans", 9], ["hoodie", 7], ["zara", 6], ["new balance", 5], ["puffer jacket", 4], ["loewe", 3], ["acne studios", 3], ["white sneakers", 2]];
  const termScale = days / 7;
  const searchTerms = terms.map(([key, c]) => ({ key, count: sc(c * termScale) }));
  const searchCount = Math.round(searchTerms.reduce((s, t) => s + t.count, 0) * 1.7);

  return {
    range,
    truncated: false,
    summary: {
      pageViews,
      sessions,
      signedInUsers: { "24h": 4, "7d": 11, "30d": 23, "90d": 41 }[range],
      avgLoadMs: 1838,
      p75LoadMs: 2412,
      sessionsDelta: { "24h": -8, "7d": 12, "30d": 34, "90d": 118 }[range],
      onlineNow: 3,
    },
    timeseries,
    topPages,
    topProducts,
    topOutfits,
    referrers: share([["direct", 0.41], ["goo-fashion.com", 0.22], ["google.com", 0.14], ["instagram.com", 0.09], ["l.instagram.com", 0.04], ["chatgpt.com", 0.02], ["t.co", 0.01], ["facebook.com", 0.01], ["duckduckgo.com", 0.005], ["bing.com", 0.004]]),
    utmSources: [["instagram", 0.026], ["newsletter", 0.009], ["tiktok", 0.003]].map(([key, p]) => ({ key, count: sc(pageViews * p) })),
    devices: share([["mobile", 0.63], ["desktop", 0.35], ["tablet", 0.02]]),
    browsers: share([["Chrome", 0.58], ["Safari", 0.36], ["Firefox", 0.06]]),
    countries: share([["LT", 0.52], ["UA", 0.13], ["PL", 0.07], ["DE", 0.05], ["US", 0.05], ["GB", 0.04], ["LV", 0.03], ["NL", 0.02], ["FR", 0.02], ["Unknown", 0.02]]),
    searchTerms,
    vitals: [
      { metric: "LCP", p75: 2870, samples: sc(pageViews * 0.61) },
      { metric: "INP", p75: 184, samples: sc(pageViews * 0.38) },
      { metric: "CLS", p75: 0.042, samples: sc(pageViews * 0.6) },
      { metric: "FCP", p75: 1620, samples: sc(pageViews * 0.62) },
      { metric: "TTFB", p75: 690, samples: sc(pageViews * 0.62) },
    ],
    funnel: [
      { step: "Visited site", sessions, tracked: true },
      { step: "Viewed product", sessions: Math.round(sessions * 0.37), tracked: true },
      { step: "Saved outfit", sessions: 0, tracked: false },
      { step: "Generated look", sessions: 0, tracked: false },
    ],
    sessionWindows: { last24h: last24, last7d: last7, last30d: last30 },
    aiUsage: {
      stylistMessages: stylistDaily.reduce((s, d) => s + d.count, 0),
      stylistError: null,
      stylistDaily,
      imageGenerations: 0,
      imageGenerationErrors: 0,
      imageGenerationsTracked: false,
    },
    heatmap,
    events: [
      { event: "product_view", count: sc(pageViews * 0.31) },
      { event: "search", count: searchCount },
      { event: "outfit_view", count: sc(pageViews * 0.058) },
    ],
  };
}

// ── Settings ─────────────────────────────────────────────────────────────────
const SCHEMA_CHECKS = [
  {"table":"settings","column":"value","migration":"024_settings.sql","breaks":"Nothing in Settings or Prompts can be saved: the stored OpenAI key, prompt edits, parser settings and homepage picks all fall back to defaults."},
  {"table":"user_looks","column":"look_name","migration":"009_user_looks_share.sql","breaks":"A look renamed on one device keeps its old name everywhere else."},
  {"table":"user_looks","column":"look_description","migration":"009_user_looks_share.sql","breaks":"A look's description never leaves the device it was written on."},
  {"table":"pending_looks","column":"name","migration":"017_pending_look_details.sql","breaks":"A look submitted for publication reaches the studio unnamed."},
  {"table":"pending_looks","column":"description","migration":"017_pending_look_details.sql","breaks":"A submitted look reaches the studio with no description."},
  {"table":"pending_looks","column":"occasion","migration":"017_pending_look_details.sql","breaks":"Published community looks all fall back to the default occasion."},
  {"table":"pending_looks","column":"season","migration":"017_pending_look_details.sql","breaks":"Published community looks all fall back to the default season."},
  {"table":"pending_looks","column":"look_id","migration":"008_pending_looks_look_id.sql","breaks":"A submission cannot be matched back to the look it came from."},
  {"table":"retailer_domains","column":"domain","migration":"018_retailer_domains.sql","breaks":"Per-domain store names and official-store flags are not applied to imports."},
  {"table":"retailer_domains","column":"default_gender","migration":"022_retailer_default_gender.sql","breaks":"A store's \"unmarked pieces are for…\" setting cannot be saved, and imports ignore it."},
  {"table":"products","column":"catalogue_fingerprint","migration":"025_catalogue_check.sql","breaks":"The AI check does not run at all: neither after imports nor from the AI check page."},
  {"table":"catalogue_check_fixes","column":"after","migration":"025_catalogue_check.sql","breaks":"The AI check has nowhere to record its fixes, so it does not run."},
  {"table":"catalogue_check_runs","column":"cost_usd","migration":"025_catalogue_check.sql","breaks":"The AI check's spend is not recorded, and its monthly cap cannot be enforced."},
  {"table":"products","column":"subcategory","migration":"010_product_subcategory.sql","breaks":"Subcategories are dropped on every save and import."},
  {"table":"products","column":"color_group_ids","migration":"021_color_groups.sql","breaks":"Products get no base colour, so they never show up in the colour filter."},
  {"table":"products","column":"crop_data","migration":"023_product_crop_data.sql","breaks":"The crop set in the product editor is not saved; cards show the whole photo."},
  {"table":"products","column":"color_images","migration":"supabase-schema.sql","breaks":"Per-colour photos are not stored; every colour shows the main photo."},
  {"table":"products","column":"variant_group_id","migration":"supabase-schema.sql","breaks":"Colours of one item are not grouped into one card."},
  {"table":"products","column":"color_hex","migration":"supabase-schema.sql","breaks":"Colour swatches lose their exact shade."},
  {"table":"products","column":"is_group_primary","migration":"supabase-schema.sql","breaks":"A colour group cannot mark which variant its card shows."},
  {"table":"products","column":"bg_color","migration":"015_product_bg_color.sql","breaks":"Product cards cannot take the colour of the photo's backdrop."},
  {"table":"products","column":"source_price","migration":"019_product_source_price.sql","breaks":"The store's own price is not kept, so a converted price cannot be checked."},
  {"table":"products","column":"source_currency","migration":"019_product_source_price.sql","breaks":"The store's own currency is not kept, so a converted price cannot be checked."},
  {"table":"products","column":"fx_rate","migration":"019_product_source_price.sql","breaks":"The exchange rate behind a converted price is not kept."},
  {"table":"products","column":"fx_date","migration":"019_product_source_price.sql","breaks":"The date of the exchange rate behind a converted price is not kept."},
  {"table":"products","column":"price_min_usd","migration":"019_product_price_usd.sql","breaks":"Price filters and the stylist's budget compare store prices as if they were dollars."},
  {"table":"products","column":"price_max_usd","migration":"019_product_price_usd.sql","breaks":"Price filters and the stylist's budget compare store prices as if they were dollars."},
  {"table":"products","column":"gtin","migration":"020_product_codes.sql","breaks":"Barcodes are dropped, so the same item from two stores is not matched by code."},
  {"table":"products","column":"mpn","migration":"020_product_codes.sql","breaks":"Manufacturer part numbers are dropped, so the same item is not matched by code."},
  {"table":"products","column":"sku","migration":"020_product_codes.sql","breaks":"Store SKUs are dropped on every save and import."},
];
const MISSING_MIGRATIONS = new Set(["019_product_price_usd.sql", "019_product_source_price.sql", "020_product_codes.sql", "025_catalogue_check.sql"]);
const schemaReport = () => {
  const checks = SCHEMA_CHECKS.map((c) => ({ ...c, present: !MISSING_MIGRATIONS.has(c.migration) }));
  return {
    ok: false,
    checks,
    missingMigrations: [...MISSING_MIGRATIONS].sort(),
  };
};

// Same shape as maskKey in api/admin/settings/route.ts: 8 + 8 dots + 4.
const MASKED_KEY = "sk-proj-" + "•".repeat(8) + "Xq7A";

// ── Prompts ──────────────────────────────────────────────────────────────────
// Defaults are the real PROMPT_META from src/lib/server/prompt-defaults.ts.
const PROMPT_META = [
  {"key":"prompt_blog_system","label":"Blog — System","description":"Системный промт для генерации статей блога. Задаёт роль и формат вывода.","default":"You are the writer for the GOO Journal — the blog of GOO, a minimal AI-powered fashion discovery app. The Journal carries two kinds of writing: fashion editorial, and product news addressed to GOO's own customers.\n\nOUTPUT\n- Reply with one valid JSON object and nothing else. No markdown, no code fences, no preamble, no trailing commentary.\n- `body` is HTML. Use only these tags: <p> <h2> <h3> <ul> <ol> <li> <strong> <em> <blockquote> <a> <hr>.\n- No <h1>: the page already renders the title as the heading.\n- No <img>, no inline styles, no class attributes, no <script>. Anything outside the list above is stripped before the post is published, and its text goes with it.\n\nVOICE\n- Editorial minimalism. Short sentences, concrete nouns, no filler. Open with the point rather than a warm-up.\n- Banned phrasing: \"stunning\", \"breathtaking\", \"game-changer\", \"elevate your wardrobe\", \"in today's fast-paced world\", \"we are thrilled/excited to announce\", \"the perfect blend of\".\n- Write for a reader who already follows fashion. Do not explain the obvious and do not flatter them.\n\nHONESTY\n- Never invent facts about GOO: features, prices, plans, limits, counts, dates or roadmap. If a fact is not in the material you were given, leave it out rather than guessing.\n- Never invent quotes, statistics, brand collaborations or product names.\n- If the material is too thin for the length asked for, write it short. Padding is worse than brevity.","category":"content","required":[]},
  {"key":"prompt_blog_user","label":"Blog — From URL","description":"Промт режима «из URL»: чужая статья переписывается в редакционный пост. Используй {{url}} и {{content}} — они подставляются при генерации. Категорию выбирает из редакционной группы.","default":"Source URL: {{url}}\n\nText scraped from that page:\n---\n{{content}}\n---\n\nWrite a GOO Journal post based on that source. Return a JSON object with exactly these fields:\n\n- title: 6-10 words. Editorial, specific, no clickbait.\n- excerpt: 1-2 sentences, max 200 chars. Say what the reader gets, not that the article exists.\n- body: HTML, 500-800 words, 2-4 <h2> sections. Where the source names specific pieces, designers, brands or prices, carry them over — they are the substance. Close on a takeaway the reader can act on, not a summary of what you just said.\n- category: exactly one of \"Trends\", \"Style Guide\", \"Brands\", \"Smart Shopping\".\n- metaTitle: max 60 chars.\n- metaDescription: max 155 chars.\n- slug: lowercase, words joined by hyphens, max 60 chars, no dates.\n\nThe source is someone else's reporting. Rewrite it in GOO's voice with GOO's angle — what this means for someone deciding what to wear or buy. Do not copy sentences from the source, and do not present its opinions as GOO's own reporting.\n\nIf the page turned out to be off-topic or too thin to write from, say so in `excerpt` and keep `body` to a short paragraph instead of inventing material.","category":"content","required":["{{content}}"]},
  {"key":"prompt_blog_brief","label":"Blog — From brief","description":"Промт режима «из брифа»: несколько строк от команды превращаются в продуктовый пост для клиентов. Используй {{brief}}. Категорию выбирает из продуктовой группы.","default":"Brief from the GOO team:\n---\n{{brief}}\n---\n\nTurn that brief into a GOO Journal post announcing this to GOO's own users. Return a JSON object with exactly these fields:\n\n- title: 5-9 words. Name the thing that changed, plainly. No hype, no colon-and-subtitle.\n- excerpt: 1-2 sentences, max 200 chars. What changed and who it affects.\n- body: HTML, 200-450 words, in this order: what changed, why it matters to the reader, how to use it. Add what is coming next only if the brief says so. Use <h2> only when there is more than one distinct change; a short <ul> is the right shape for a list of smaller changes.\n- category: exactly one of \"Product Updates\", \"AI Stylist\", \"Announcements\".\n- metaTitle: max 60 chars.\n- metaDescription: max 155 chars.\n- slug: lowercase, words joined by hyphens, max 60 chars, no dates.\n\nThis one is written in GOO's own name, to people who already use it — so the honesty rule is strict. Use only what the brief states. Do not add features, screens, numbers, dates, prices, plans or limits that are not in it, and do not promise anything it does not promise. Second person (\"you can now…\") is right here; marketing superlatives are not.\n\nIf the brief is too thin to make a post, still return valid JSON, keep `body` to one paragraph, and name the missing piece in `excerpt` so the editor sees the gap.","category":"content","required":["{{brief}}"]},
  {"key":"prompt_email","label":"Email — AI Write","description":"Промт для AI-генерации тела письма. Используй {{subject}} и {{brief}}.","default":"You are writing a newsletter email for GOO — a minimal, sophisticated fashion discovery app.\n\nWrite an email body in plain text with light markdown formatting:\n- Use # for main heading, ## for section headings\n- Use - for bullet lists\n- Use **bold** for emphasis\n- Keep paragraphs short\n- Tone: warm, minimal, editorial. Like a fashion insider talking to a friend.\n- Length: 150–250 words. No fluff.\n\n{{subject}}\n{{brief}}\n\nReturn ONLY the email body text, no subject line, no greeting like \"Dear user\", start directly with the content.","category":"content","required":["{{subject}}","{{brief}}"]},
  {"key":"prompt_image_fidelity","label":"Image — Fidelity block","description":"Блок точности воспроизведения одежды. Вставляется через {{fidelity}} в каждый стиль генерации.","default":"CRITICAL FIDELITY: Reproduce every garment EXACTLY as shown in the corresponding reference image. Match silhouette, cut, fabric texture, drape, color, pattern, print, stitching, buttons, zippers, and hardware precisely. LOGOS AND BRANDING: Preserve ALL logos, wordmarks, graphic prints, text, and emblems EXACTLY as they appear in the reference images — do not simplify, replace, blur, or omit any logo or text. If a logo is on the chest, it must appear on the chest. If there is a brand name on the shoe, it must be legible. Do not invent, substitute, restyle, or add any item not in the references.","category":"image","required":[]},
  {"key":"prompt_image_mannequin","label":"Image — Mannequin","description":"Промт для генерации на манекене. Используй {{items}} и {{fidelity}}.","default":"Luxury fashion ecommerce photograph. Full-body shot of a faceless matte black mannequin (sleek, no facial features) wearing the following outfit, head to toe: {{items}}. Garment layering: outerwear is worn over the top (open or unzipped to reveal the top underneath); bottom worn on the legs; shoes on the feet; bags on the shoulder or crossbody — never floating. {{fidelity}} BACKGROUND: Pure clean white seamless studio infinity cove — floor and wall blend into a single unbroken white. No props, no texture, no gradient, no shadow on the wall. Only a soft natural contact shadow directly beneath the mannequin's feet on the floor. Lighting: soft diffused frontal studio light, no harsh shadows. The focus is entirely on the clothes. Framing: full-body centered front view, entire figure head to toe visible with even breathing room on all sides. Square 1:1 frame. Photorealistic, sharp focus.","category":"image","required":["{{items}}"]},
  {"key":"prompt_image_flatlay","label":"Image — Flatlay","description":"Промт для раскладки на полу/поверхности. Используй {{items}} и {{fidelity}}.","default":"Editorial fashion flat-lay photograph for a luxury magazine cover. Arrange these clothing items and accessories on a pure white surface, viewed from directly overhead (top-down 90° shot): {{items}}. Composition: lay the pieces out as if a person is wearing the outfit — hat/cap at the top, top/shirt centered below, outerwear overlapping the top (slightly open), trousers/skirt below the top along the vertical center axis (can be folded at the knee for editorial rhythm), shoes at the bottom pointing downward. Bags and accessories rest naturally at the sides. Allow organic overlaps between adjacent pieces (jacket hem over shirt, shoe toe over trouser cuff) — this creates visual flow. NOT a grid, NOT items in separate corners. {{fidelity}} BACKGROUND: Absolutely pure white — no texture, no paper grain, no shadows on the background itself. Each item casts only its own soft, sharp-edged drop shadow directly beneath it, giving a clean floating effect. The shadows are the only visual element besides the clothes. Lighting: bright overhead studio strobe, perfectly even white exposure. Colors must be completely true-to-life. Square 1:1 frame. Top-down overhead view. Photorealistic, ultra-sharp focus, luxury fashion editorial quality.","category":"image","required":["{{items}}"]},
  {"key":"prompt_image_tryon","label":"Image — Try-on","description":"Промт для примерки на человеке. Используй {{items}} и {{fidelity}}.","default":"Fashion studio try-on photograph. PERSON: The FIRST reference image shows the subject. Reproduce this exact person — their face, facial features, skin tone, hair colour, hair length, body shape, and proportions precisely. Do NOT alter, idealise, composite, or replace the person with a model. OUTFIT: Dress this exact person in the following items, taken from the remaining reference images: {{items}}. Garment layering: outerwear worn over top; bottom on legs; shoes on feet; bags on shoulder or crossbody — never floating. {{fidelity}} POSE: Simple, confident standing studio pose — feet shoulder-width apart, arms relaxed at sides (or one hand lightly in pocket). Full body visible head to toe. Natural, not stiff. BACKGROUND: Pure white seamless studio infinity cove — floor and wall blend into one unbroken white plane. No props, no texture, no gradient. Only a soft contact shadow directly beneath the feet. LIGHTING: Soft diffused frontal studio strobe, perfectly even, no harsh shadows. Natural skin-tone rendering. Square 1:1 frame. Full body centered. Photorealistic, ultra-sharp focus, luxury fashion editorial quality.","category":"image","required":["{{items}}"]},
];
const CUSTOM = {
  prompt_email: (d) => d.replace("minimal, sophisticated fashion discovery app.", "minimal, sophisticated fashion discovery app with an AI stylist. Keep it under 180 words, one clear call to action, no emoji.") ,
  prompt_image_flatlay: (d) => d.replace("Square 1:1 frame.", "Portrait 4:5 frame, generous margins for the GOO wordmark.") ,
};
const prompts = () => PROMPT_META.map((m) => ({ ...m, value: CUSTOM[m.key] ? CUSTOM[m.key](m.default) : null }));

// ── Blog ─────────────────────────────────────────────────────────────────────
const para = (...xs) => xs.map((x) => `<p>${x}</p>`).join("\n");
const BLOG = [
  ["b1", "autumn-layering-five-rules", "Autumn layering: five rules that survive the first cold week", "Style Guide", false, "2026-09-22T09:14:00Z", "#6b7a5e",
    "Layering is a system, not a pile. Five rules for the weeks when mornings are cold and afternoons are not.",
    para("The first cold week always catches someone out. Here is how to dress for 6°C at eight and 17°C at three without carrying a coat you will not wear.") + "\n<h2>1. Start thin</h2>\n" + para("A fine merino or a cotton tee is the base. Anything thicker and the jacket will not sit right.") + "\n<h2>2. One warm layer, not two</h2>\n" + para("A cardigan or an overshirt does the work. Two mid-layers is where the silhouette goes."), "", ""],
  ["b2", "ai-stylist-remembers-your-sizes", "The AI Stylist now remembers your sizes", "Product Updates", false, "2026-08-30T15:40:00Z", "#1c1c1c",
    "Tell the stylist your sizes once and every suggestion is filtered to what fits.",
    para("Until now the stylist asked for your size every time. From this release it keeps your sizes in your profile and filters every look to pieces that come in them.", "You can change or clear them in Profile → Sizes at any time."), "", ""],
  ["b3", "quiet-luxury-is-over", "Quiet luxury is over. What replaces it?", "Trends", false, "2026-07-19T11:02:00Z", "#a8a29e",
    "Logos are back, but not the way they left. A look at what the autumn collections actually showed.",
    para("For three seasons the brief was ‘no logos, good fabric’. The autumn shows changed the brief."), "", ""],
  ["b4", "linen-done-right-summer-buying-guide", "Linen, done right: a summer buying guide", "Smart Shopping", true, "2026-06-15T08:00:00Z", "#d6cbb5",
    "What separates a linen shirt that lasts five summers from one that lasts five washes — and where to buy each.",
    para("Linen is the most forgiving fabric to wear and the least forgiving to buy. The weave, the weight and the finish decide whether a shirt softens or falls apart.") + "\n<h2>Weight</h2>\n" + para("Look for 150–190 g/m². Lighter is see-through; heavier is a jacket.") + "\n<h2>Where to buy</h2>\n" + para("COS and Arket for everyday shirts, Loro Piana if you want to keep it for a decade."),
    "Linen shirt buying guide — GOO Journal", "How to choose a linen shirt that lasts: weight, weave and finish, and where to buy it in 2026."],
  ["b5", "meet-the-goo-ai-stylist", "Meet the GOO AI Stylist", "AI Stylist", true, "2026-05-28T10:30:00Z", "#111827",
    "Describe the occasion, get three complete looks from real stores — with prices and links.",
    para("The stylist reads your request, searches the catalogue and puts together complete looks you can actually buy.", "It knows 1,200+ pieces from 26 stores and gets better every week."),
    "Meet the GOO AI Stylist", "GOO's AI stylist builds complete outfits from real stores in seconds."],
  ["b6", "acne-studios-read-closely", "Acne Studios, read closely", "Brands", true, "2026-05-09T09:00:00Z", "#93c5fd",
    "Pink packaging, face patches and the 1996 jean: why the Stockholm label still sets the tone.",
    para("Acne Studios began as a creative collective that happened to make a hundred pairs of jeans. Twenty-nine years later the jeans are still the point."), "", ""],
  ["b7", "capsule-wardrobe-12-pieces", "How to build a capsule wardrobe in 12 pieces", "Style Guide", true, "2026-04-21T07:45:00Z", "#e8e4dc",
    "Twelve pieces, forty outfits. The list, the rules, and what to leave out.",
    para("A capsule wardrobe is not about owning less. It is about owning things that work together."),
    "Capsule wardrobe in 12 pieces", "Build a 12-piece capsule wardrobe: the list, the rules and what to skip."],
  ["b8", "goo-pro-plans-explained", "GOO Pro: plans and pricing explained", "Announcements", true, "2026-04-02T12:00:00Z", "#2f3542",
    "Free, Basic, Pro and Premium — what each plan includes and how billing works.",
    para("GOO stays free to browse. Paid plans add stylist messages, try-on generations and saved looks."), "", ""],
];
const blogPosts = BLOG.map(([id, slug, title, category, pub, at, hex, excerpt, body, metaTitle, metaDescription]) => ({
  id: `5e0b1c3a-${id === "b1" ? "0001" : "000" + id.slice(1)}-4f2e-9a1d-2c7f6b${id.slice(1).padStart(6, "0")}`,
  slug, title, excerpt, body, category,
  coverImageUrl: IMG(`blog-${slug}`, hex, category),
  readTime: `${Math.max(1, Math.round(body.split(/\s+/).length / 200))} min`,
  authorName: "GOO",
  metaTitle, metaDescription, ogImage: "",
  isPublished: pub,
  publishedAt: at,
  createdAt: at,
  updatedAt: pub ? at : new Date(Date.parse(at) + 2 * DAY).toISOString(),
})).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

// ── Routes ───────────────────────────────────────────────────────────────────
const routes = {
  "GET /api/admin/analytics": ({ url }) => analytics(["24h", "7d", "30d", "90d"].includes(url.searchParams.get("range")) ? url.searchParams.get("range") : "7d"),

  "GET /api/admin/schema-check": schemaReport,
  "GET /api/admin/settings": { configured: true, source: "database", maskedKey: MASKED_KEY },
  "POST /api/admin/settings/test": { ok: true },
  "GET /api/admin/embeddings": { total: TOTAL_PRODUCTS, withEmbedding: 284, missing: TOTAL_PRODUCTS - 284, coverage: Math.round((284 / TOTAL_PRODUCTS) * 100) },
  "GET /api/admin/homepage-showcase": async () => {
    const outfits = await effectiveOutfits();
    return { step1: [P(11).id], step2: [P(16).id, P(7).id, P(4).id], step3: [outfits[0].id], step4: [P(17).id, P(19).id, P(22).id] };
  },
  "GET /api/admin/homepage-stylist": async () => {
    const outfits = await effectiveOutfits();
    return {
      chatOutfits: outfits.slice(1, 3).map((o) => o.id),
      featuredProduct: P(15).id,
      extraStores: [{ name: "Zalando", price: 100 }, { name: "Farfetch", price: 99 }],
    };
  },

  "GET /api/admin/prompts": prompts,

  "GET /api/blog": () => blogPosts,
};
if (!otherFixtureDefines("GET /api/products?raw=true")) routes["GET /api/products?raw=true"] = products;
if (!otherFixtureDefines("GET /api/outfits")) routes["GET /api/outfits"] = OUTFITS;

/* The admin shell is h-dvh with <main> scrolling inside it, so Playwright's
   fullPage capture stops at the viewport. Let the document scroll instead. */
const UNCLIP_CSS = `
  div.h-dvh.overflow-hidden { height: auto !important; min-height: 100dvh; overflow: visible !important; align-items: flex-start; }
  div.h-dvh.overflow-hidden > aside { position: sticky; top: 0; height: 100dvh !important; align-self: flex-start; }
  div.h-dvh.overflow-hidden > div { min-height: 100dvh; }
  div.h-dvh.overflow-hidden main { overflow: visible !important; flex: none !important; }
`;
// Then scroll the document once top to bottom so loading="lazy" images below
// the fold are fetched before the full-page capture.
const unclip = async (page) => {
  await page.addStyleTag({ content: UNCLIP_CSS });
  await page.waitForTimeout(300);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(80); }
  await page.evaluate(() => window.scrollTo(0, 0));
  // The shell resize re-runs Recharts' 1.5 s entry animation; let it finish.
  await page.waitForTimeout(1900);
};

const pages = [
  // Same names as the runner's base pages: re-shot unclipped so the PNG is full
  // length (these run after the base entries and overwrite their files).
  ...[
    ["analytics", "/goo-studio/analytics"], ["settings", "/goo-studio/settings"],
    ["prompts", "/goo-studio/prompts"], ["blog", "/goo-studio/blog"],
  ].map(([name, url]) => ({ name, url, wait: 1800, after: unclip })),
  {
    name: "analytics-30d",
    url: "/goo-studio/analytics",
    wait: 1800,
    after: async (page) => {
      await page.getByRole("button", { name: /^(30d|30 дн\.)$/ }).click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1200);
      await unclip(page);
    },
  },
  {
    name: "prompts-image",
    url: "/goo-studio/prompts",
    wait: 1800,
    after: async (page) => {
      await page.getByRole("button", { name: /Image generation|Картинки/ }).click();
      await page.waitForTimeout(400);
      await unclip(page);
    },
  },
  // GS4-5: a showcase pick removed, so the page's one SaveBar shows.
  {
    name: "settings-savebar",
    url: "/goo-studio/settings",
    fullPage: false,
    wait: 1800,
    after: async (page) => {
      await page.locator("#showcase").getByRole("button", { name: /^(Remove|Убрать) / }).first().click();
      await page.getByRole("region", { name: /Save changes|Сохранение/ }).waitFor();
      await page.waitForTimeout(600);
    },
  },
  {
    name: "blog-editor",
    url: "/goo-studio/blog",
    fullPage: false,
    after: async (page) => {
      // The newest published post (Linen guide) — has SEO fields filled.
      const row = page.locator("[data-row]", { hasText: "Linen, done right" });
      // On a phone the Edit icon is hidden and Edit heads the row's "…".
      const edit = row.getByRole("button", { name: /^Edit / });
      if (await edit.isVisible()) await edit.click();
      else {
        await row.locator('button[aria-haspopup="menu"]').click();
        await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
      }
      await page.getByRole("dialog").waitFor();
    },
  },
];

module.exports = { routes, pages };
