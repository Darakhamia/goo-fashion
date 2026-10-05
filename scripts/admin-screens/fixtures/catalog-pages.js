// Fixtures for goo-studio catalogue pages: products, brands, retailers, categories, outfits.
// Shapes follow src/app/api/** in the real repo; data mirrors docs/ADMIN_UX_REVIEW_2026-10.md.
const { products, brands: catalogBrands, IMG } = require("./catalog");

const P = (i) => products[i];

/* ── Brands: 72, junk "sdf"/"Z", Valentino + Valentino Garavani, no logos ── */
const MISSING_FROM_DIRECTORY = new Set(["Air Jordan", "Puma", "Saint Laurent", "Comme des Garçons", "Purple Brand", "Thom Browne", "Courrèges", "Courreges"]);
const EXTRA_BRANDS = [
  "A.P.C.", "Ami Paris", "Arc'teryx", "Auralee", "Axel Arigato", "Birkenstock", "Bode", "Burberry", "Celine",
  "Common Projects", "Dr. Martens", "Dries Van Noten", "Ganni", "Hermès", "Isabel Marant", "Jacquemus", "Khaite",
  "Lacoste", "Levi's", "Maison Kitsuné", "Marni", "Massimo Dutti", "Miu Miu", "MM6 Maison Margiela", "Nanushka",
  "Norse Projects", "Off-White", "On", "Patagonia", "Ralph Lauren", "Rick Owens", "Sandro", "Sézane",
  "Stella McCartney", "The North Face", "Uniqlo", "Veja", "Vetements", "Wales Bonner", "Y-3", "Mango", "Reformation",
];
const brandNames = [...new Set(catalogBrands.map((b) => b.name).concat(EXTRA_BRANDS))]
  .filter((n) => !MISSING_FROM_DIRECTORY.has(n));
// Keep the deliberate junk, trim the tail of the extras to land on exactly 72.
const KEEP = new Set(["sdf", "Z", "Valentino", "Valentino Garavani"]);
while (brandNames.length > 72) {
  const idx = brandNames.map((n, i) => [n, i]).reverse().find(([n]) => !KEEP.has(n))[1];
  brandNames.splice(idx, 1);
}
const brands = brandNames.sort((a, b) => a.localeCompare(b)).map((name) => ({ name, logoUrl: null }));

/* ── Retailers: 26 rules + domains discovered in the catalogue ── */
const RULES = [
  ["acnestudios.com", "Acne Studios", true, "", ""],
  ["adidas.com", "adidas", true, "", ""],
  ["arket.com", "ARKET", true, "unisex", ""],
  ["asos.com", "ASOS", false, "", ""],
  ["awin1.com", "adidas Originals", false, "", "Affiliate links from the adidas feed"],
  ["comme-des-garcons.com", "Comme des Garçons", true, "", ""],
  ["cos.com", "COS", true, "", ""],
  ["endclothing.com", "END.", false, "men", "Mostly menswear; ships to UA"],
  ["farfetch.com", "Farfetch", false, "", "Marketplace — prices vary by boutique"],
  ["hm.com", "H&M", true, "", ""],
  ["lamoda.ua", "Lamoda", false, "", ""],
  ["matchesfashion.com", "MATCHES", false, "", "Closed in 2024, links may 404"],
  ["moncler.com", "Moncler", true, "", ""],
  ["mrporter.com", "Mr Porter", false, "men", ""],
  ["mytheresa.com", "Mytheresa", false, "", ""],
  ["net-a-porter.com", "NET-A-PORTER", false, "women", ""],
  ["nike.com", "Nike", true, "", "Includes Jordan Brand pages"],
  ["nordstrom.com", "Nordstrom", false, "", ""],
  ["osiris.com", "Osiris", true, "men", ""],
  ["selfridges.com", "Selfridges", false, "", ""],
  ["ssense.com", "SSENSE", false, "", ""],
  ["stance.com", "Stance", true, "", ""],
  ["stevemadden.com", "Steve Madden", true, "women", ""],
  ["toteme-studio.com", "Toteme", true, "women", ""],
  ["zalando.com", "Zalando", false, "", ""],
  ["zara.com", "ZARA", true, "", "Product pages need the country prefix (/ua/en/)"],
].map(([domain, name, isOfficial, defaultGender, note], i) => ({
  domain, name, isOfficial,
  ...(defaultGender ? { defaultGender } : {}),
  ...(note ? { note } : {}),
  updatedAt: new Date(Date.parse("2026-09-30T10:00:00Z") - i * 86400e3 * 1.7).toISOString(),
}));

const RULED_COUNTS = {
  "farfetch.com": [312, ["Farfetch", "farfetch.com", "FARFETCH"], 0],
  "ssense.com": [204, ["SSENSE", "Ssense"], 0],
  "zara.com": [188, ["ZARA", "Zara"], 188],
  "awin1.com": [143, ["adidas Originals", "awin1.com", "adidas"], 12],
  "mrporter.com": [96, ["Mr Porter", "MR PORTER"], 0],
  "nike.com": [84, ["Nike", "nike.com"], 84],
  "zalando.com": [61, ["Zalando"], 0],
  "endclothing.com": [42, ["END.", "END Clothing"], 0],
  "mytheresa.com": [31, ["Mytheresa"], 0],
  "net-a-porter.com": [24, ["NET-A-PORTER"], 0],
  "cos.com": [19, ["COS"], 19],
  "arket.com": [14, ["ARKET", "Arket"], 14],
  "stance.com": [9, ["Stance"], 9],
  "osiris.com": [8, ["Osiris"], 8],
  "acnestudios.com": [7, ["Acne Studios"], 7],
  "moncler.com": [5, ["Moncler"], 5],
  "selfridges.com": [4, ["Selfridges"], 0],
  "stevemadden.com": [3, ["Steve Madden"], 3],
  "comme-des-garcons.com": [2, ["Comme des Garçons"], 2],
};
const discovered = Object.entries(RULED_COUNTS).map(([domain, [productCount, currentNames, officialCount]]) => ({
  domain, productCount, currentNames, officialCount, ruledBy: domain,
}));
// Subdomain covered by a rule, plus domains nobody has named yet.
discovered.push({ domain: "en.zalando.de", productCount: 11, currentNames: ["en.zalando.de"], officialCount: 0, ruledBy: "zalando.com" });
discovered.push(
  { domain: "go.skimresources.com", productCount: 37, currentNames: ["go.skimresources.com", "Skimlinks"], officialCount: 0 },
  { domain: "click.linksynergy.com", productCount: 22, currentNames: ["click.linksynergy.com"], officialCount: 0 },
  { domain: "stockx.com", productCount: 17, currentNames: ["StockX", "stockx.com"], officialCount: 0 },
  { domain: "answear.ua", productCount: 12, currentNames: ["answear.ua"], officialCount: 0 },
  { domain: "intertop.ua", productCount: 9, currentNames: ["Intertop", "intertop.ua"], officialCount: 0 },
  { domain: "shop-links.co", productCount: 6, currentNames: ["shop-links.co"], officialCount: 0 },
  { domain: "goat.com", productCount: 4, currentNames: ["GOAT"], officialCount: 1 },
  { domain: "puma.com", productCount: 3, currentNames: ["Air Jordan", "puma.com"], officialCount: 3 },
);
discovered.sort((a, z) => z.productCount - a.productCount);

/* ── Category tree (DB source, ids, sizes, counts) ── */
const LETTER = ["XS", "S", "M", "L", "XL", "XXL"];
const SHOE = ["38", "39", "40", "41", "42", "43", "44", "45"];
let sid = 1;
const it = (label, value, sizes) => ({ id: sid++, label, value, ...(sizes ? { sizeType: sizes === SHOE ? "eu" : "letter", sizes } : {}) });
const GROUPS = [
  { id: "outerwear", label: "Outerwear", items: [
    it("Jackets", "outerwear", LETTER), it("Coats", "outerwear", LETTER), it("Puffers", "outerwear"),
    it("Parkas", "outerwear", LETTER), it("Vests", "outerwear", LETTER), it("Bomber Jackets", "outerwear", LETTER),
    it("Raincoats", "outerwear", LETTER), it("Blazers", "blazers", LETTER),
  ] },
  { id: "tops", label: "Tops", items: [
    it("T-Shirts", "tops", LETTER), it("Polos", "tops", LETTER), it("Blouses", "tops"),
    it("Hoodies", "tops", LETTER), it("Sweatshirts", "tops", LETTER), it("Shirts", "shirts", LETTER),
    it("Knitwear", "knitwear", LETTER),
  ] },
  { id: "bottoms", label: "Bottoms", items: [
    it("Trousers", "bottoms", ["24", "25", "26", "27", "28", "29", "30", "31", "32", "34"]), it("Jeans", "bottoms", ["24", "25", "26", "27", "28", "29", "30", "31", "32", "34"]),
    it("Shorts", "shorts", LETTER), it("Skirts", "skirts", LETTER),
  ] },
  { id: "dresses", label: "Dresses", items: [it("Dresses", "dresses", LETTER), it("Jumpsuits", "jumpsuits", LETTER)] },
  { id: "footwear", label: "Footwear", items: [
    it("Sneakers", "footwear", SHOE), it("Boots", "footwear", SHOE), it("Sandals", "footwear", SHOE), it("Loafers", "footwear", SHOE),
  ] },
  { id: "accessories", label: "Accessories", items: [
    it("Bags", "bags", ["One Size"]), it("Wallets", "accessories", ["One Size"]), it("Belts", "accessories", ["70", "75", "80", "85", "90", "95"]),
    it("Hats", "accessories", ["S/M", "M/L"]), it("Socks", "accessories", ["S/M", "L/XL"]), it("Sunglasses", "accessories"),
    it("Watches", "accessories"), it("Other", "accessories"),
  ] },
];
const BY_LABEL = {
  Jackets: 70, Coats: 41, Puffers: 23, Parkas: 9, Vests: 6, "Bomber Jackets": 12, Raincoats: 4, Blazers: 18,
  "T-Shirts": 214, Polos: 27, Blouses: 15, Hoodies: 63, Sweatshirts: 38, Shirts: 52, Knitwear: 44,
  Trousers: 71, Jeans: 58, Shorts: 22, Skirts: 13, Dresses: 19, Jumpsuits: 2,
  Sneakers: 160, Boots: 26, Sandals: 17, Loafers: 0,
  Bags: 48, Wallets: 9, Belts: 11, Hats: 7, Socks: 5, Sunglasses: 3, Watches: 1, Other: 6,
};
const categoriesBody = { groups: GROUPS, source: "db" };
const categoriesWithCounts = {
  ...categoriesBody,
  counts: { byLabel: BY_LABEL, unassignedByCategory: { outerwear: 12, tops: 31, footwear: 4, accessories: 9 } },
};

/* ── Outfits: 27 looks, all CASUAL / ALL ── */
const OUTFIT_NAMES = [
  "Outfit 51", "Outfit 9", "Outfit 93", "Outfit 51", "Boots", "Outfit 12", "Outfit 27", "Outfit 51",
  "Outfit 34", "Outfit 40", "Outfit 44", "Weekend", "Outfit 58", "Outfit 61", "Outfit 66", "Outfit 70",
  "Outfit 72", "Outfit 77", "Outfit 80", "Untitled look", "Outfit 84", "Outfit 88", "Outfit 90",
  "Outfit 95", "Sneakers", "Outfit 3", "Outfit 7",
];
const OUTFIT_HEX = ["#d6cfc4", "#2b2b2b", "#8a7f72", "#c9c3b6", "#4b5563", "#a3a08f", "#e7e2d8", "#1f2937", "#6b5e4f"];
const KW_SETS = [["casual", "minimal"], ["streetwear"], ["casual"], ["minimal", "classic"], ["sporty", "casual"], ["streetwear", "sporty"], []];
// Piece sets (catalogue indexes) — top / bottom / shoes / extra.
const PIECES = [
  [34, 37, 16, 18], [0, 4, 7], [11, 30, 33, 35], [19, 3, 24], [37, 32, 10, 25], [5, 16, 22], [14, 3, 18],
  [36, 4, 26], [38, 39, 16, 19], [31, 32, 10], [20, 33, 27], [17, 16, 7], [21, 3, 24, 11], [15, 4, 22],
  [6, 32, 26], [37, 16, 18, 34], [1, 3, 23], [2, 4, 7], [8, 16, 10], [9, 32, 13], [30, 33, 10, 12],
  [35, 16, 18], [13, 4, 25], [23, 3, 24], [5, 32, 7], [0, 33, 26], [38, 4, 19],
];
const FIXED_TOTALS = { 0: 3731.18, 3: 3731.18, 7: 3208, 2: 898.1 };
const outfits = OUTFIT_NAMES.map((name, i) => {
  const items = PIECES[i].map((pi, k) => ({ product: P(pi), role: k === 0 ? "hero" : k === 1 ? "secondary" : "accent" }));
  const sum = items.reduce((s, x) => s + x.product.priceMin, 0);
  const total = FIXED_TOTALS[i] ?? Math.round((sum + ((i * 37) % 100) / 100) * 100) / 100;
  return {
    id: `7f3c2a10-${String(2000 + i)}-4b8e-a1d2-${String(300000000000 + i * 104729).slice(-12)}`,
    name,
    description: i % 5 === 0 ? "" : `A relaxed everyday look built around ${items[0].product.name.toLowerCase()}.`,
    occasion: "casual",
    season: "all",
    imageUrl: IMG(`outfit-${i}`, OUTFIT_HEX[i % OUTFIT_HEX.length], "look"),
    items,
    totalPriceMin: total,
    totalPriceMax: total,
    currency: "USD",
    styleKeywords: KW_SETS[i % KW_SETS.length],
    isAIGenerated: i % 4 !== 1,
    isSaved: false,
    source: i === 6 || i === 19 ? "community" : null,
    isHomepageFeatured: [0, 2, 5, 11].includes(i),
    createdAt: new Date(Date.parse("2026-10-04T18:00:00Z") - i * 2.3 * 86400e3).toISOString(),
  };
});

/* ── Pending community looks ── */
const SLOTS = ["top", "bottom", "shoes", "outerwear", "accessory"];
const pendingDef = [
  { style: "flatlay", pieces: [36, 4, 7, 38], kw: ["minimal", "casual"], name: "Linen & denim for Friday", desc: "Light layers for a warm office day.", occ: "work", season: "summer", days: 0.3 },
  { style: "tryon", pieces: [5, 16, 22], kw: ["streetwear", "sporty"], name: null, desc: null, occ: null, season: null, days: 1.2 },
  { style: "flatlay", pieces: [31, 32, 10, 34], kw: ["classic"], name: "Cardigan, black jeans, Chicagos", desc: "", occ: "casual", season: "autumn", days: 2.8 },
  { style: null, pieces: [15, 3, 24], kw: ["casual"], name: "Weekend in blue", desc: null, occ: "weekend", season: "spring", days: 5.1 },
];
const pendingLooks = pendingDef.map((d, i) => ({
  id: `c51d7e2b-${3000 + i}-4f1a-9e0c-${String(500000000000 + i * 7727).slice(-12)}`,
  created_at: new Date(Date.parse("2026-10-05T09:00:00Z") - d.days * 86400e3).toISOString(),
  generated_image: IMG(`pending-${i}`, ["#cfc6b8", "#374151", "#7c6f64", "#9fb3c8"][i], d.style === "tryon" ? "on you" : "flat lay"),
  generated_style: d.style,
  pieces: d.pieces.map((pi, k) => ({ slot: SLOTS[k], productId: P(pi).id, imageUrl: P(pi).imageUrl, name: `${P(pi).brand} — ${P(pi).name}` })),
  total_price: Math.round(d.pieces.reduce((s, pi) => s + P(pi).priceMin, 0) * 100) / 100,
  style_keywords: d.kw,
  status: "pending",
  name: d.name,
  description: d.desc,
  occasion: d.occ,
  season: d.season,
}));

/* ── Interaction helpers for extra screenshots ── */
/* A row of a DataTable: a table row on a desktop, a card on a phone (GS4-11). */
const ROW = "[data-row]";
/* Its checkbox. On a phone the photo is the box and the input under it is
   visually hidden, so the click goes through the photo: force skips the check
   that the input itself is on top. */
const tick = (box) => box.check({ force: true });
const waitRows = async (page) => {
  await page.waitForSelector(`${ROW} :is(a, button):is([aria-label^="Edit "], [aria-label^="Изменить "])`, { state: "attached", timeout: 30000 });
};
/* The product page (GS6-1) replaced the editor modal: the row's Edit link, or
   on a phone the first item of the row's "…", goes to /goo-studio/products/<id>. */
const openFirstEditor = async (page) => {
  await waitRows(page);
  const row = page.locator(ROW).first();
  const edit = row.locator(':is(a, button):is([aria-label^="Edit "], [aria-label^="Изменить "])');
  if (await edit.isVisible()) await edit.click();
  else {
    await row.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole("menuitem", { name: /^(Edit|Изменить)$/ }).click();
  }
  await page.getByRole("heading", { name: /^(Basics|Основное)$/ }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(600);
};
/* A section of the product page at the top of the screen: #photos, #colors, #stores… */
const scrollToSection = async (page, id) => {
  await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: "start" }), id);
  await page.waitForTimeout(400);
};

/* GET /api/admin/products/<id>: the product, its other colors, what AI check
   holds about it and its history, as src/app/api/admin/products/[id] answers. */
const productPage = ({ url }) => {
  const id = decodeURIComponent(url.pathname.split("/").pop());
  const product = products.find((p) => p.id === id);
  if (!product) return { __status: 404, __body: { error: "Product not found" } };
  const group = product.variantGroupId ? products.filter((p) => p.variantGroupId === product.variantGroupId && p.id !== id) : [];
  return {
    product,
    group,
    groupError: null,
    quality: {
      suggested: [
        { id: 9101, runId: "r1", productId: id, productName: product.name, brand: product.brand, field: "name", beforeText: product.name, afterText: product.name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()), writable: true, reason: "The store wrote the name in capitals.", confidence: "medium", status: "suggested", source: "product", createdAt: "2026-10-04T09:12:00Z" },
        { id: 9102, runId: "r1", productId: id, productName: product.name, brand: product.brand, field: "price", beforeText: "4 000 UAH read as $4 000", afterText: "", writable: false, reason: "Looks like hryvnia, not dollars.", confidence: "medium", status: "suggested", source: "product", createdAt: "2026-10-04T09:12:00Z" },
      ],
      applied: [
        { id: 9001, runId: "r0", productId: id, productName: product.name, brand: product.brand, field: "colors", beforeText: "XS", afterText: "Ecru", writable: true, reason: "", confidence: "high", status: "applied", source: "product", createdAt: "2026-10-02T15:40:00Z" },
      ],
    },
    history: [
      { id: 3, action: "catalogue_check.fixed", by: null, at: "2026-10-04T09:12:00Z", metadata: {} },
      { id: 2, action: "products.updated", by: "admin@example.com", at: "2026-10-03T11:05:00Z", metadata: {} },
      { id: 1, action: "parser.collect_ingest", by: "admin@example.com", at: "2026-09-28T17:20:00Z", metadata: {} },
    ],
  };
};

/* The admin shell is h-dvh with <main> scrolling inside it, so Playwright's
   fullPage capture stops at the viewport. Let the document scroll instead. */
const UNCLIP_CSS = `
  div.h-dvh.overflow-hidden { height: auto !important; min-height: 100dvh; overflow: visible !important; }
  div.h-dvh.overflow-hidden > aside { height: auto !important; }
  div.h-dvh.overflow-hidden main { overflow: visible !important; flex: none !important; }
`;
const unclip = async (page) => {
  await page.addStyleTag({ content: UNCLIP_CSS });
  // Lazy thumbnails below the fold never load in a full-page capture.
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = "eager"; });
    await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); })));
  });
  await page.waitForTimeout(300);
};

module.exports = {
  routes: {
    // Products page
    "GET /api/products?raw=true": products,
    "GET /api/products/seed": { configured: true },
    "GET /api/admin/products/*": productPage,
    // Saving on the product page: the row as the API would return it.
    "PUT /api/products/*": ({ url, body }) => {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      return { ...products.find((p) => p.id === id), ...(body || {}), id };
    },
    "POST /api/products": ({ body }) => ({ ...(body || {}), id: "0aa26cb7-9999-4c1e-9f6a-999999999999", createdAt: "2026-10-05T12:00:00Z" }),
    "GET /api/color-groups": [
      { id: 1, name: "White", hexCode: "#ffffff", sortOrder: 1 }, { id: 2, name: "Multicolor", hexCode: "#multicolor", sortOrder: 2 },
      { id: 3, name: "Brown", hexCode: "#7a4f35", sortOrder: 3 }, { id: 4, name: "Pink", hexCode: "#e8698a", sortOrder: 4 },
      { id: 5, name: "Yellow", hexCode: "#f5c518", sortOrder: 5 }, { id: 6, name: "Orange", hexCode: "#e87722", sortOrder: 6 },
      { id: 7, name: "Grey", hexCode: "#808080", sortOrder: 7 }, { id: 8, name: "Black", hexCode: "#111111", sortOrder: 8 },
      { id: 9, name: "Green", hexCode: "#2d6a3f", sortOrder: 9 }, { id: 10, name: "Red", hexCode: "#c0392b", sortOrder: 10 },
      { id: 11, name: "Violet", hexCode: "#7b3fa0", sortOrder: 11 }, { id: 12, name: "Blue", hexCode: "#1a47a0", sortOrder: 12 },
      { id: 13, name: "Beige", hexCode: "#d4c5a9", sortOrder: 13 },
    ],
    "GET /api/categories": categoriesBody,
    "GET /api/categories?counts=1": categoriesWithCounts,

    // Brands
    "GET /api/brands": brands,

    // Retailers
    "GET /api/admin/retailer-domains?rulesOnly=1": { rules: RULES },
    "GET /api/admin/retailer-domains": {
      rules: RULES, discovered, discoverError: null, scanLimit: 50000, scanned: 1224, scanTruncated: false,
      tableMissing: false, setupHint: null, rulesError: null,
    },

    // Outfits
    "GET /api/outfits": outfits,
    "GET /api/looks/pending": pendingLooks,
  },

  pages: [
    // Same names as the runner's base pages: re-shot with the shell unclipped so
    // the PNG really is full length (this entry runs after the base one and wins).
    ...[
      ["products", "/goo-studio/products"], ["brands", "/goo-studio/brands"], ["retailers", "/goo-studio/retailers"],
      ["categories", "/goo-studio/categories"], ["outfits", "/goo-studio/outfits"],
    ].map(([name, url]) => ({ name, url, after: unclip })),
    // GS6-1: the product page, opened from the list, and its sections.
    { name: "products-editor", url: "/goo-studio/products", fullPage: false, after: openFirstEditor },
    {
      name: "products-editor-2", url: "/goo-studio/products", fullPage: false,
      after: async (page) => { await openFirstEditor(page); await scrollToSection(page, "photos"); },
    },
    {
      name: "products-editor-3", url: "/goo-studio/products", fullPage: false,
      after: async (page) => { await openFirstEditor(page); await scrollToSection(page, "colors"); },
    },
    {
      name: "products-editor-4", url: "/goo-studio/products", fullPage: false,
      after: async (page) => { await openFirstEditor(page); await scrollToSection(page, "stores"); },
    },
    {
      name: "product-page", url: `/goo-studio/products/${P(0).id}`,
      after: async (page) => { await page.getByRole("heading", { name: /^(Basics|Основное)$/ }).waitFor({ timeout: 30000 }); await unclip(page); },
    },
    {
      name: "product-page-dirty", url: `/goo-studio/products/${P(0).id}`, fullPage: false,
      after: async (page) => {
        await page.getByRole("heading", { name: /^(Basics|Основное)$/ }).waitFor({ timeout: 30000 });
        await page.getByRole("radio", { name: /^(Men|Мужское)$/ }).click();
        await scrollToSection(page, "stores");
        await page.locator("#stores input[type=number]").first().fill("31.5");
        await page.waitForTimeout(500);
      },
    },
    {
      name: "product-page-saved", url: `/goo-studio/products/${P(0).id}`, fullPage: false,
      after: async (page) => {
        await page.getByRole("heading", { name: /^(Basics|Основное)$/ }).waitFor({ timeout: 30000 });
        await page.getByRole("radio", { name: /^(Women|Женское)$/ }).click();
        await page.getByRole("region", { name: /Save|Сохран/ }).getByRole("button", { name: /^(Save|Сохранить)$/ }).click();
        await page.getByRole("status").filter({ hasText: /Product updated|Товар обновлён/ }).first().waitFor({ timeout: 15000 });
        await page.waitForTimeout(300);
      },
    },
    {
      name: "product-page-new", url: "/goo-studio/products/new",
      after: async (page) => { await page.getByRole("heading", { name: /^(Basics|Основное)$/ }).waitFor({ timeout: 30000 }); await unclip(page); },
    },
    {
      name: "products-bulk", url: "/goo-studio/products", fullPage: false,
      after: async (page) => {
        await waitRows(page);
        const boxes = page.locator(`${ROW} input[type="checkbox"]`);
        for (const i of [0, 1, 2]) await tick(boxes.nth(i));
      },
    },
    // GS4-4: an open filter, the row's "…" and the header's maintenance menu.
    // On a phone the filters are in a bottom sheet behind "Filters" (GS4-11).
    {
      name: "products-filter", url: "/goo-studio/products", fullPage: false,
      after: async (page) => {
        await waitRows(page);
        const sheet = page.locator('button[aria-haspopup="dialog"]', { hasText: /^(Filters|Фильтры)/ });
        if (await sheet.isVisible()) await sheet.click();
        else await page.locator('button[aria-haspopup="menu"]', { hasText: /Brand|Бренд/ }).click();
        await page.waitForTimeout(500);
      },
    },
    {
      name: "products-row-menu", url: "/goo-studio/products", fullPage: false,
      after: async (page) => {
        await waitRows(page);
        await page.locator(ROW).nth(1).hover();
        await page.locator(ROW).nth(1).locator('button[aria-haspopup="menu"]').click();
        await page.waitForTimeout(300);
      },
    },
    {
      name: "products-maintenance", url: "/goo-studio/products", fullPage: false,
      after: async (page) => {
        await waitRows(page);
        // On a phone the header's "…" holds Import and the maintenance runs together.
        const menu = page.getByRole("button", { name: /^(Catalog maintenance|Обслуживание каталога)$/ });
        await menu.filter({ visible: true }).click();
        await page.waitForTimeout(300);
      },
    },
    {
      name: "outfits-bulk", url: "/goo-studio/outfits", fullPage: false,
      after: async (page) => {
        // Row boxes by place, not by label: the label is in the admin's language.
        const boxes = page.locator(`${ROW} input[type="checkbox"]`);
        await boxes.first().waitFor({ state: "attached", timeout: 15000 });
        await tick(boxes.nth(0));
        await tick(boxes.nth(1));
        await page.waitForTimeout(300);
      },
    },
    {
      name: "outfits-pending", url: "/goo-studio/outfits",
      after: async (page) => {
        await page.getByRole("tab", { name: /^(Pending|На проверке)/ }).click();
        await page.waitForSelector('img:is([alt="Look"], [alt="Образ"])', { timeout: 15000 });
        await unclip(page);
      },
    },
    {
      name: "outfits-pending-review", url: "/goo-studio/outfits", fullPage: false,
      after: async (page) => {
        await page.getByRole("tab", { name: /^(Pending|На проверке)/ }).click();
        await page.locator('img:is([alt="Look"], [alt="Образ"])').first().click();
        await page.getByRole("dialog", { name: /^(Review submitted look|Проверка присланного образа)$/ }).waitFor();
      },
    },
    // GS4-3 components: the confirm dialog, the toast after the confirmed
    // action (DELETE has no fixture, so it answers {} and succeeds), and an
    // explanation opened from its "?".
    {
      name: "brands-confirm", url: "/goo-studio/brands", fullPage: false,
      after: async (page) => {
        await page.getByRole("button", { name: /^(Delete brand|Удалить бренд) / }).first().click();
        await page.getByRole("alertdialog").waitFor();
        await page.waitForTimeout(400);
      },
    },
    {
      name: "brands-toast", url: "/goo-studio/brands", fullPage: false,
      after: async (page) => {
        await page.getByRole("button", { name: /^(Delete brand|Удалить бренд) / }).first().click();
        await page.getByRole("alertdialog").getByRole("button", { name: /^(Delete brand|Удалить бренд)$/ }).click();
        await page.waitForTimeout(1200);
      },
    },
    {
      name: "retailers-help", url: "/goo-studio/retailers", fullPage: false,
      after: async (page) => {
        await page.getByRole("button", { name: /^(How retailer rules work|Как работают правила магазинов)$/ }).click();
        await page.waitForTimeout(300);
      },
    },
    // GS4-5: the rule form in the side panel, opened by a click on the rule.
    {
      name: "retailers-rule", url: "/goo-studio/retailers", fullPage: false,
      after: async (page) => {
        await page.locator(ROW).first().getByText("acnestudios.com", { exact: true }).click();
        await page.getByRole("dialog").waitFor();
        await page.waitForTimeout(600);
      },
    },
  ],
};
