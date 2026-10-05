// Fixtures for: audit, duplicates, catalogue-check, import, parser, parser-collect
// Shapes follow src/app/api/admin/{label-audit,duplicates,catalogue-check,csv-import,parser/*}.
// Data follows docs/ADMIN_UX_REVIEW_2026-10.md (state of prod on 2026-10-05).
const { products, IMG, TOTAL_PRODUCTS } = require("./catalog");

// ── helpers ──────────────────────────────────────────────────────────────────
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function uid(seed) {
  const a = hash(seed).toString(16).padStart(8, "0");
  const b = hash(seed + "|b").toString(16).padStart(8, "0");
  const c = hash(seed + "|c").toString(16).padStart(8, "0");
  return `${a}-${b.slice(0, 4)}-4${b.slice(5, 8)}-a${c.slice(1, 4)}-${c}${a.slice(0, 4)}`;
}
function rng(seed) {
  let s = hash(String(seed)) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const byName = (name, hex) => products.find((p) => p.name === name && (!hex || p.colorHex === hex));
const idOf = (name) => (byName(name) ? byName(name).id : uid("p:" + name));

// ═════════════════════════════════════════════════════════════════════════════
// AUDIT — /api/admin/label-audit
// 104 open, 117 dismissed. Mined rules at 100% suggesting nonsense; the same
// product in several sections with contradicting advice; "pour homme" read as women.
// ═════════════════════════════════════════════════════════════════════════════
const rule = (key, value, hits, support) =>
  `mined rule: "${key}" → ${value} (${hits}/${support}, ${Math.round((hits / support) * 100)}%)`;
const sus = (name, field, stored, suggested, evidence, agreement = 1, id) => ({
  id: id || idOf(name), name, field, stored, suggested, evidence, agreement,
});

const AW = "Wrapped Vest Cardigan"; // Alexander Wang — lands in 4 sections
const AW_ID = idOf(AW);
const TWIST = "TWISTED WIDE LEG PANT";
const MELROSE = "MELROSE DENIM PANT";

const auditOpen = {
  colour_label_not_a_colour: [
    sus("Mia Jacket - Beige/White", "colour", "XS", "Beige, White", ['"XS" is a size', '"Beige, White" is what the name or the other labels say']),
    sus("Adicolor Classics Firebird Track Top | Size: XL", "colour", "XL", "(none)", ['"XL" is a size', "the name names no colour, so the label is cleared"]),
    sus("Trefoil Essentials Hoodie | Size: XS", "colour", "XS", "(none)", ['"XS" is a size', "the name names no colour, so the label is cleared"]),
    sus("Ribbed Tank Top - Black", "colour", "IMG_4471.jpg", "Black", ['"IMG_4471.jpg" is a file name', '"Black" is what the name or the other labels say']),
    sus("Organic Cotton Polo - Navy", "colour", "M, L", "Navy", ['"M" is a size', '"L" is a size', '"Navy" is what the name or the other labels say']),
    sus("Cropped Denim Jacket - Washed Blue", "colour", "38", "Washed Blue", ['"38" is a size', '"Washed Blue" is what the name or the other labels say']),
    sus("Wide Leg Trouser - Ecru", "colour", "swatch_ecru_01", "Ecru", ['"swatch_ecru_01" is a file name', '"Ecru" is what the name or the other labels say']),
  ],
  subcategory_not_in_tree: [
    sus("Wool Blend Blazer", "subcategory", "Suit Jackets", "—", ["no subcategory by this name exists in the category tree"]),
    sus("Reedition Vinyl Jacket", "subcategory", "Vinyl Jackets", "—", ["no subcategory by this name exists in the category tree"]),
  ],
  category_contradicts_subcategory: [
    sus(AW, "category", "knitwear", "tops", ['the tree files "Vests" under tops'], 1, AW_ID),
    sus("Essentials Fleece Hoodie", "category", "outerwear", "tops", ['the tree files "Hoodies" under tops']),
    sus("Maya Short Down Jacket", "category", "tops", "outerwear", ['the tree files "Puffers" under outerwear']),
  ],
  filed_under_the_wrong_group: [
    sus("x Poldo Dog Couture Moon Boot dog toy", "group", "Accessories › Other", "Footwear", ["the name reads as Footwear, but this is filed under Accessories"], 1, idOf("Moon Boot dog toy")),
    sus("Logo Jacquard Knit Polo", "group", "Tops › Knitwear", "tops", ["the name reads as tops, but this is filed as knitwear — same group, different kind of thing"]),
    sus("Graphic Print T-Shirt", "group", "Tops › Knitwear", "tops", ["the name reads as tops, but this is filed as knitwear — same group, different kind of thing"]),
    sus("Leather Chelsea Boot", "group", "Accessories › Belts", "Footwear", ["the name reads as Footwear, but this is filed under Accessories"]),
    sus("Nylon Belt Bag", "group", "Accessories › Belts", "bags", ["the name reads as bags, but this is filed as accessories — same group, different kind of thing"]),
    sus("Denim Overshirt", "group", "Bottoms › Jeans", "Tops", ["the name reads as Tops, but this is filed under Bottoms"]),
  ],
  subcategory_named_in_the_name: [
    sus(AW, "subcategory", "Vests", "Cardigans", ['the name says "Cardigans"'], 1, AW_ID),
    sus("Athletic Long Sleeve T-Shirt", "subcategory", "T-Shirts", "Long Sleeves", ['the name says "Long Sleeves"']),
    sus("Oversized Hoodie Dress", "subcategory", "Hoodies", "Dresses", ['the name says "Dresses"']),
    sus("Cropped Bomber Jacket", "subcategory", "Jackets", "Bomber Jackets", ['the name says "Bomber Jackets"']),
    sus("Firebird Track Pant", "subcategory", "Trousers", "Track Pants", ['the name says "Track Pants"']),
    sus("Wool Cardigan Coat", "subcategory", "Coats", "Cardigans", ['the name says "Cardigans"']),
    sus("Pique Polo Shirt", "subcategory", "Shirts", "Polos", ['the name says "Polos"']),
    sus("Denim Shorts", "subcategory", "Jeans", "Shorts", ['the name says "Shorts"']),
    sus("Penny Leather Loafers", "subcategory", "Sneakers", "Loafers", ['the name says "Loafers"']),
  ],
  same_phrase_filed_two_ways: [
    sus(AW, "category", "knitwear", "tops", ['"vest" is filed as tops on 11 of 12 products'], 1, AW_ID),
    sus(TWIST, "subcategory", "Trousers", "Jeans", ['"wide leg" is filed as Jeans on 9 of 10 products']),
    sus(TWIST, "subcategory", "Trousers", "Jeans", ['"wide leg" is filed as Jeans on 9 of 10 products'], 1, uid("dup:" + TWIST)),
    sus(MELROSE, "subcategory", "Jeans", "Trousers", ['"pant" is filed as Trousers on 14 of 15 products']),
    sus(MELROSE, "subcategory", "Jeans", "Trousers", ['"pant" is filed as Trousers on 14 of 15 products'], 1, uid("dup:" + MELROSE)),
    sus("Relaxed Linen Shirt", "subcategory", "T-Shirts", "Shirts", ['"linen shirt" is filed as Shirts on 17 of 18 products']),
    sus("Twisted Shirt", "subcategory", "T-Shirts", "Shirts", ['"twisted shirt" is filed as Shirts on 5 of 6 products']),
    sus("Box Shirt", "category", "tops", "shirts", ['"box shirt" is filed as shirts on 6 of 7 products', "both sit in the Tops group — this changes the bucket, not what a shopper sees"]),
    sus("Fleece Zip Jacket", "subcategory", "Sweatshirts", "Jackets", ['"zip jacket" is filed as Jackets on 12 of 14 products']),
    sus("Cable Knit Vest", "subcategory", "Knitwear", "Vests", ['"knit vest" is filed as Vests on 4 of 5 products']),
    sus("Ripstop Cargo Pant", "subcategory", "Shorts", "Trousers", ['"cargo pant" is filed as Trousers on 8 of 9 products']),
    sus("Pleated Midi Skirt", "category", "dresses", "skirts", ['"midi skirt" is filed as skirts on 10 of 11 products']),
    sus("Merino Crew Neck", "subcategory", "Sweatshirts", "Knitwear", ['"merino crew" is filed as Knitwear on 7 of 8 products']),
    sus("Leather Card Holder", "category", "bags", "accessories", ['"card holder" is filed as accessories on 9 of 10 products', "both sit in the Accessories group — this changes the bucket, not what a shopper sees"]),
  ],
  category_disputed_by_name: [
    sus("Intrecciato Cardholder", "category", "accessories", "bags", [rule("intrecciato", "bags", 6, 6), "keyword table reads the name as bags", "both sit in the Accessories group — this changes the bucket, not what a shopper sees"], 2, idOf("Bottega Veneta Intrecciato Cardholder")),
    sus("Hooded Down Parka", "category", "tops", "outerwear", [rule("parka", "outerwear", 14, 14), "keyword table reads the name as outerwear"], 2),
    sus("Denim Trucker Jacket", "category", "jeans", "outerwear", [rule("trucker jacket", "outerwear", 9, 9), "keyword table reads the name as outerwear"], 2),
    sus("Knitted Polo Shirt", "category", "shirts", "knitwear", [rule("knitted", "knitwear", 22, 23), "keyword table reads the name as knitwear", "both sit in the Tops group — this changes the bucket, not what a shopper sees"], 2),
    sus("STENCIL ICON SOCK 3 PACK", "category", "accessories", "footwear", [rule("pack", "footwear", 9, 9)]),
    sus(AW, "category", "knitwear", "tops", [rule("wrapped", "tops", 5, 5), "both sit in the Tops group — this changes the bucket, not what a shopper sees"], 1, AW_ID),
    sus("Silicone Badge Tee", "category", "tops", "accessories", [rule("silicone", "accessories", 5, 5)]),
    sus("Retro Crew Tee — Wonder Steel", "category", "tops", "accessories", [rule("steel", "accessories", 7, 7)]),
    sus("Saint Laurent Le 5 Á 7 Hobo Bag", "category", "accessories", "bags", ["keyword table reads the name as bags", "both sit in the Accessories group — this changes the bucket, not what a shopper sees"]),
    sus("Track Sneaker", "category", "footwear", "tops", [rule("track", "tops", 18, 19)]),
    sus("Heart Logo Tee", "category", "tops", "footwear", [rule("heart", "footwear", 4, 4)]),
    sus("Rockstud Leather Belt", "category", "accessories", "footwear", [rule("rockstud", "footwear", 6, 6)]),
    sus("Swim Short - Navy", "category", "shorts", "swimwear", ["keyword table reads the name as swimwear"]),
    sus("Bucket Hat", "category", "bags", "accessories", ["keyword table reads the name as accessories", "both sit in the Accessories group — this changes the bucket, not what a shopper sees"]),
    sus("Margaux 15 Bag", "category", "accessories", "bags", ["keyword table reads the name as bags", "both sit in the Accessories group — this changes the bucket, not what a shopper sees"]),
    sus("Overshirt Jacket", "category", "shirts", "outerwear", [rule("overshirt", "outerwear", 8, 9)]),
    sus("Jogger Sweatpant", "category", "tops", "bottoms", ["keyword table reads the name as bottoms"]),
    sus("Moon Boot dog toy", "category", "accessories", "footwear", [rule("moon boot", "footwear", 7, 7), "keyword table reads the name as footwear"], 2),
  ],
  subcategory_disputed_by_name: [
    sus("Silicone Badge Tee", "subcategory", "T-Shirts", "Watches", [rule("silicone", "Watches", 5, 5)]),
    sus("Retro Crew Tee — Wonder Steel", "subcategory", "T-Shirts", "Watches", [rule("steel", "Watches", 7, 7)]),
    sus("High-Low Polo Top", "subcategory", "Polos", "Sneakers", [rule("low", "Sneakers", 23, 23)]),
    sus("Jenna Thong Platform Sandal", "subcategory", "Sandals", "Sneakers", [rule("wmns", "Sneakers", 11, 11)]),
    sus("SHAI 001 Lace Up 'Cheetah'", "subcategory", "Sneakers", "Hoodies", [rule("cheetah", "Hoodies", 4, 4)]),
    sus("Free Mind LS Top", "subcategory", "Long Sleeves", "Sneakers", [rule("mind", "Sneakers", 6, 6)]),
    sus(AW, "subcategory", "Vests", "Knitwear", [rule("cardigan", "Knitwear", 31, 32)], 1, AW_ID),
    sus(TWIST, "subcategory", "Trousers", "Jeans", [rule("leg", "Jeans", 19, 20)]),
    sus(TWIST, "subcategory", "Trousers", "Jeans", [rule("leg", "Jeans", 19, 20)], 1, uid("dup:" + TWIST)),
    sus(MELROSE, "subcategory", "Jeans", "Trousers", [rule("pant", "Trousers", 14, 15)]),
    sus(MELROSE, "subcategory", "Jeans", "Trousers", [rule("pant", "Trousers", 14, 15)], 1, uid("dup:" + MELROSE)),
    sus("Low Rise Baggy Jean", "subcategory", "Jeans", "Sneakers", [rule("low", "Sneakers", 23, 23)]),
    sus("Steel Toe Cap Boot", "subcategory", "Boots", "Watches", [rule("steel", "Watches", 7, 7)]),
    sus("Mesh Panel Track Pant", "subcategory", "Trousers", "Sneakers", [rule("mesh", "Sneakers", 16, 17)]),
    sus("Runner Graphic Tee", "subcategory", "T-Shirts", "Sneakers", [rule("runner", "Sneakers", 12, 12)]),
    sus("Court Pleated Skirt", "subcategory", "Skirts", "Sneakers", [rule("court", "Sneakers", 9, 9)]),
    sus("Trail Fleece Jacket", "subcategory", "Jackets", "Sneakers", [rule("trail", "Sneakers", 10, 10)]),
    sus("Canvas Tote Bag", "subcategory", "Bags", "Sneakers", [rule("canvas", "Sneakers", 8, 8)]),
    sus("Suede Bomber Jacket", "subcategory", "Bomber Jackets", "Loafers", [rule("suede", "Loafers", 6, 6)]),
    sus("Track Sneaker", "subcategory", "Sneakers", "Sweatshirts", [rule("track", "Sweatshirts", 18, 19)]),
    sus("Monogram Silk Scarf", "subcategory", "Scarves", "Shirts", [rule("silk", "Shirts", 9, 10)]),
    sus("Ribbed Tank Top - Black", "subcategory", "Tank Tops", "Knitwear", [rule("ribbed", "Knitwear", 13, 14)]),
    sus("Chunky Knit Beanie", "subcategory", "Hats", "Knitwear", [rule("knit", "Knitwear", 44, 46)]),
    sus("Logo Waistband Brief", "subcategory", "Underwear", "Belts", [rule("waistband", "Belts", 4, 4)]),
    sus("Platform Derby Shoe", "subcategory", "Derby Shoes", "Sandals", [rule("platform", "Sandals", 7, 7)]),
    sus("Wool Blend Blazer", "subcategory", "Suit Jackets", "Coats", [rule("wool", "Coats", 27, 29)]),
    sus("Puffer Vest", "subcategory", "Gilets", "Puffers", [rule("puffer", "Puffers", 15, 15)]),
    sus("Gold Hoop Earrings", "subcategory", "Jewellery", "Watches", [rule("gold", "Watches", 5, 5)]),
    sus("Leather Card Holder", "subcategory", "Wallets", "Bags", [rule("leather", "Bags", 38, 41)]),
    sus("Cargo Ripstop Short", "subcategory", "Shorts", "Trousers", [rule("cargo", "Trousers", 11, 12)]),
    sus("Essentials Fleece Hoodie", "subcategory", "Hoodies", "Jackets", [rule("fleece", "Jackets", 9, 9)]),
  ],
  gender_disputed_by_name: [
    sus("Chaussure de running Pegasus 41 pour homme", "gender", "men", "women", ["the name or description says women"]),
    sus("Chaussure Nike Air Max Plus pour homme", "gender", "men", "women", ["the name or description says women"]),
    sus("Chaussure Nike Dunk Low Retro pour homme", "gender", "men", "women", ["the name or description says women"]),
    sus("Wmns Air Jordan 1 Low", "gender", "men", "women", ["the name or description says women"]),
    sus("Men's Relaxed Linen Shirt", "gender", "women", "men", ["the name or description says men"]),
    sus("Women's Trefoil Essentials Hoodie", "gender", "unisex", "women", ["the name or description says women"]),
  ],
  colour_group_possibly_missing: [
    sus("Merino Crew Neck", "colour group", "(none)", "Grey", ['colour "Charcoal": "charcoal" → Grey (41/42, 98%)']),
    sus("Essentials Fleece Hoodie", "colour group", "Beige", "Grey", ['colour "Light Heather Oatmeal": "light heather oatmeal" → Grey (6/6, 100%)']),
    sus("Signature Wool Coat", "colour group", "(none)", "Beige", ['colour "Camel": "camel" → Beige (23/24, 96%)']),
    sus("1996 Relaxed Jeans", "colour group", "Black", "Blue", ['colour "Indigo": "indigo" → Blue (31/32, 97%)']),
    sus("Maya Short Down Jacket", "colour group", "(none)", "Blue", ['colour "Navy": "navy" → Blue (88/90, 98%)']),
    sus("Twisted Shirt", "colour group", "White", "Beige", ['colour "Ecru": "ecru" → Beige (19/20, 95%)']),
    sus("Rockstud Leather Belt", "colour group", "(none)", "Black", ['colour "Nero": "nero" → Black (12/12, 100%)']),
    sus("Margaux 15 Bag", "colour group", "Brown", "Beige", ['colour "Dark Taupe": "dark taupe" → Beige (5/5, 100%)']),
  ],
};

// 117 dismissed, spread over sections; shown only with "Dismissed".
const dismissedCounts = {
  colour_label_not_a_colour: 4, subcategory_not_in_tree: 0, category_contradicts_subcategory: 1,
  filed_under_the_wrong_group: 9, subcategory_named_in_the_name: 12, same_phrase_filed_two_ways: 18,
  category_disputed_by_name: 27, subcategory_disputed_by_name: 38, gender_disputed_by_name: 3,
  colour_group_possibly_missing: 5,
};
const dismissedPool = [
  ["Low Rise Wide Leg Jean", "subcategory", "Jeans", "Sneakers", () => [rule("low", "Sneakers", 23, 23)]],
  ["Shirt Jacket in Wool", "category", "outerwear", "shirts", () => [rule("shirt", "shirts", 40, 44)]],
  ["Long Sleeve Polo", "subcategory", "Polos", "Long Sleeves", () => ['the name says "Long Sleeves"']],
  ["Low Top Leather Trainer", "subcategory", "Sneakers", "Trousers", () => [rule("top", "Trousers", 5, 5)]],
  ["Boxy Cropped Tee", "subcategory", "T-Shirts", "Shorts", () => [rule("cropped", "Shorts", 8, 9)]],
  ["Sweater Vest", "subcategory", "Vests", "Knitwear", () => [rule("sweater", "Knitwear", 30, 31)]],
  ["Polo Dress", "subcategory", "Dresses", "Polos", () => ['the name says "Polos"']],
  ["Track Jacket", "category", "outerwear", "tops", () => [rule("track", "tops", 18, 19)]],
  ["Shacket", "category", "shirts", "outerwear", () => ["keyword table reads the name as outerwear"]],
  ["Knit Sneaker", "subcategory", "Sneakers", "Knitwear", () => [rule("knit", "Knitwear", 44, 46)]],
  ["Denim Jacket", "category", "outerwear", "jeans", () => [rule("denim", "jeans", 27, 28)]],
  ["Leather Trousers", "subcategory", "Trousers", "Belts", () => [rule("leather", "Belts", 38, 41)]],
];
const auditSuspects = {};
for (const [key, open] of Object.entries(auditOpen)) {
  const dis = [];
  for (let i = 0; i < dismissedCounts[key]; i++) {
    const [name, field, stored, suggested, ev] = dismissedPool[(i + key.length) % dismissedPool.length];
    dis.push({ ...sus(`${name}${i >= dismissedPool.length ? " II" : ""}`, field, stored, suggested, ev(), 1, uid(`dis:${key}:${i}`)), dismissed: true });
  }
  auditSuspects[key] = [...open, ...dis];
}
const AUDIT = {
  catalogue: { products: TOTAL_PRODUCTS, category_tree: "database" },
  settings: { minSupport: 4, minPrecision: 0.9, folds: 5, limit: 300 },
  dismissed: Object.values(dismissedCounts).reduce((a, b) => a + b, 0),
  dismissalsAvailable: true,
  dismissalsError: null,
  totals: Object.fromEntries(Object.entries(auditOpen).map(([k, v]) => [k, v.length])),
  dismissedTotals: dismissedCounts,
  suspects: auditSuspects,
};

// ═════════════════════════════════════════════════════════════════════════════
// DUPLICATES — /api/admin/duplicates
// "1 item held as 2 cards", 11 mixed colour groups (Osiris G2 as 4 models),
// 15 colourway proposals ("Group all (15)").
// ═════════════════════════════════════════════════════════════════════════════
const STORE_HOST = {
  SSENSE: "www.ssense.com", Farfetch: "www.farfetch.com", "Mr Porter": "www.mrporter.com", Zalando: "www.zalando.co.uk",
  "END.": "www.endclothing.com", "size?": "www.size.co.uk", Zara: "www.zara.com", "Nike": "www.nike.com",
  "adidas": "www.adidas.co.uk", Selfridges: "www.selfridges.com", "Browns": "www.brownsfashion.com", Tactics: "www.tactics.com",
  "Acne Studios": "www.acnestudios.com", Converse: "www.converse.com", "Steve Madden": "www.stevemadden.com",
};
function card(brand, name, color, hex, store, price, o = {}) {
  const id = o.id || uid(`card:${brand}:${name}:${color}:${store}`);
  const host = STORE_HOST[store] || "www." + slug(store) + ".com";
  const url = `https://${host}/product/${slug(brand)}-${slug(name)}-${slug(color)}/${(hash(id) % 9000000) + 1000000}`;
  const stores = (o.stores || [[store, price, !!o.official]]).map(([s, pr, off]) => ({
    name: s, url: s === store ? url : `https://${STORE_HOST[s] || "www." + slug(s) + ".com"}/p/${slug(name)}-${slug(color)}`,
    price: pr, currency: "USD", isOfficial: !!off,
  }));
  return {
    id, name, brand, category: o.category || null, color, image: IMG(id, hex, o.label || name.split(" ").slice(-1)[0]),
    priceMin: Math.min(...stores.map((s) => s.price)), sourceUrl: url, createdAt: o.createdAt || "2026-09-21T10:14:00Z",
    groupSize: o.groupSize ?? 0, stores,
  };
}
const fromCatalog = (name, hex, color, store, o = {}) => {
  const p = byName(name, hex);
  return card(p.brand, p.name, color, hex, store, p.priceMin, { id: p.id, category: p.category, label: p.subcategory, createdAt: p.createdAt, ...o });
};

const dupGroup = (() => {
  const a = card("Fear of God", "Essentials Fleece Hoodie", "Light Heather Oatmeal", "#d6cfc2", "SSENSE", 100, { category: "tops", label: "Hoodies", createdAt: "2026-08-14T09:02:00Z", id: idOf("Essentials Fleece Hoodie") });
  const b = card("Fear of God", "ESSENTIALS Fleece Hoodie", "Light Heather Oatmeal", "#d6cfc2", "END.", 95, { category: "tops", label: "Hoodies", createdAt: "2026-09-30T16:41:00Z" });
  return { keepId: a.id, reasons: { [b.id]: "name" }, products: [a, b] };
})();

const osiris = [
  ["#000000", "Black/Black/Black"], ["#ffffff", "White/Grey/Black"], ["#7f1d1d", "Burgundy"], ["#1d4ed8", "Royal/White"],
].map(([hex, color]) => [fromCatalog("G2 Skate Shoe", hex, color, "Tactics", { groupSize: 4, category: "footwear" })]);

const mixedGroups = [
  { groupId: "vg-osiris", families: osiris },
  { groupId: "vg-zara-tee", families: [
    [
      fromCatalog("ATHLETICZ OVERSIZED T-SHIRT", "#e8e4dc", "Ecru", "Zara", { groupSize: 4 }),
      fromCatalog("ATHLETICZ OVERSIZED T-SHIRT", "#1c1c1c", "Black", "Zara", { groupSize: 4 }),
      fromCatalog("ATHLETICZ OVERSIZED T-SHIRT", "#6b7a5e", "Khaki", "Zara", { groupSize: 4 }),
    ],
    [card("ZARA", "TEXTURED KNIT POLO SHIRT", "Mink", "#a39382", "Zara", 35.9, { groupSize: 4 })],
  ] },
  { groupId: "vg-acne-face", families: [
    [fromCatalog("Face Patch Crew Neck Sweater", "#93c5fd", "Pale Blue", "SSENSE", { groupSize: 3 })],
    [card("Acne Studios", "Face Logo Rib Beanie", "Pale Blue", "#a5c8f0", "SSENSE", 140, { groupSize: 3 }), card("Acne Studios", "Face Logo Rib Beanie", "Black", "#111111", "SSENSE", 140, { groupSize: 3 })],
  ] },
  { groupId: "vg-pegasus", families: [
    [fromCatalog("Chaussure de running Pegasus 41 pour homme", "#f3f4f6", "Blanc/Noir", "Nike", { groupSize: 2 })],
    [card("Nike", "Chaussure de running Vomero 18 pour homme", "Noir/Anthracite", "#1f2937", "Nike", 160, { groupSize: 2 })],
  ] },
  { groupId: "vg-firebird", families: [
    [fromCatalog("Adicolor Classics Firebird Track Top | Size: XL", "#111827", "Black", "adidas", { groupSize: 3 })],
    [card("adidas Originals", "Adicolor Classics Firebird Track Pant", "Black", "#111827", "adidas", 70, { groupSize: 3 }), card("adidas Originals", "Adicolor Classics Firebird Track Pant", "Collegiate Navy", "#1e2a4a", "adidas", 70, { groupSize: 3 })],
  ] },
  { groupId: "vg-shai", families: [
    [fromCatalog("SHAI 001 Lace Up 'Cheetah'", "#d97706", "Cheetah", "Converse", { groupSize: 2 })],
    [card("Converse", "Chuck 70 Vintage Canvas Hi", "Parchment", "#efe6d2", "Converse", 90, { groupSize: 2 })],
  ] },
  { groupId: "vg-jenna", families: [
    [fromCatalog("Jenna Thong Platform Sandal", "#c2410c", "Cognac", "Steve Madden", { groupSize: 3 })],
    [card("Steve Madden", "Bigmona Platform Slide", "Black", "#111111", "Steve Madden", 99, { groupSize: 3 }), card("Steve Madden", "Bigmona Platform Slide", "Bone", "#e7e1d4", "Steve Madden", 99, { groupSize: 3 })],
  ] },
  { groupId: "vg-rockstud", families: [
    [fromCatalog("Rockstud Leather Belt", "#000000", "Nero", "Farfetch", { groupSize: 2 })],
    [card("Valentino Garavani", "Rockstud Leather Bracelet", "Nero", "#0b0b0b", "Farfetch", 390, { groupSize: 2 })],
  ] },
  { groupId: "vg-courreges", families: [
    [fromCatalog("Reedition Vinyl Jacket", "#f8fafc", "Heritage White", "SSENSE", { groupSize: 2 })],
    [card("Courreges", "Reedition Vinyl Mini Skirt", "Heritage White", "#f1f5f9", "SSENSE", 450, { groupSize: 2 })],
  ] },
  { groupId: "vg-moncler", families: [
    [fromCatalog("Maya Short Down Jacket", "#0b1120", "Navy", "Mr Porter", { groupSize: 3 })],
    [card("Moncler", "Grenoble Logo-Appliquéd Fleece Gilet", "Navy", "#111a33", "Mr Porter", 895, { groupSize: 3 }), card("Moncler", "Grenoble Logo-Appliquéd Fleece Gilet", "Ivory", "#f5f0e6", "Mr Porter", 895, { groupSize: 3 })],
  ] },
  { groupId: "vg-cdg", families: [
    [fromCatalog("Heart Logo Tee", "#ffffff", "White", "Browns", { groupSize: 2 })],
    [card("Comme des Garçons Play", "x Converse Chuck 70 Heart Hi", "Black", "#111111", "Browns", 150, { groupSize: 2 })],
  ] },
];

const cw = (brand, name, store, price, list, o = {}) => {
  const products2 = list.map(([color, hex, st, pr, extra], i) =>
    card(brand, name, color, hex, st || store, pr ?? price, { category: o.category, label: o.label, groupSize: (extra && extra.groupSize) || 0, createdAt: `2026-09-${String(10 + i).padStart(2, "0")}T12:00:00Z` }));
  return { leadId: products2[0].id, products: products2 };
};
const colourways = [
  cw("Purple Brand", "P001 Skinny Jeans", "Farfetch", 285, [["Black Wash", "#1f2937"], ["Indigo Resin", "#28365a", "Mr Porter", 295]], { label: "Jeans" }),
  cw("Comme des Garçons Play", "Heart Logo Tee", "Browns", 120, [["White", "#ffffff"], ["Black", "#111111", "SSENSE", 115], ["Navy", "#1e2a4a", "SSENSE", 115]], { label: "T-Shirts" }),
  cw("Stance", "STENCIL ICON SOCK 3 PACK", "Zalando", 36, [["Black", "#111827"], ["White", "#f5f5f5", "END.", 34]], { label: "Socks" }),
  cw("Moncler", "Maya Short Down Jacket", "Mr Porter", 1650, [["Navy", "#0b1120", null, null, { groupSize: 1 }], ["Black", "#050505", "Farfetch", 1595]], { label: "Puffers" }),
  cw("Arket", "Wool Blend Blazer", "Zalando", 199, [["Dark Grey", "#57534e"], ["Beige", "#c8b89c"]], { label: "Blazers" }),
  cw("COS", "Relaxed Linen Shirt", "Zalando", 89, [["White", "#f5f5f0"], ["Light Blue", "#bcd3ea"], ["Black", "#111111"]], { label: "Shirts" }),
  cw("Our Legacy", "Box Shirt", "END.", 260, [["Ecru Voile", "#ece6d6"], ["Black Voile", "#111111", "SSENSE", 265]], { label: "Shirts" }),
  cw("Lemaire", "Twisted Shirt", "SSENSE", 410, [["Mastic", "#d8cbb0"], ["Dark Chocolate", "#3b2a20", "Mr Porter", 420]], { label: "Shirts" }),
  cw("Toteme", "Signature Wool Coat", "Farfetch", 890, [["Camel", "#c19a6b"], ["Oatmeal", "#d6cfc2", "Selfridges", 870]], { label: "Coats" }),
  cw("Converse", "Chuck 70 Vintage Canvas Hi", "size?", 90, [["Black", "#111111"], ["Parchment", "#efe6d2", "Converse", 90, { groupSize: 2 }]], { label: "Sneakers" }),
  cw("New Balance", "550", "END.", 120, [["White/Green", "#e8f0e6"], ["White/Grey", "#e5e7eb", "size?", 115], ["Sea Salt/Navy", "#e9e4d8", "size?", 115]], { label: "Sneakers" }),
  cw("Salomon", "XT-6", "END.", 200, [["Black/Phantom", "#111111"], ["Vanilla Ice/Almond Milk", "#ece3cf", "SSENSE", 210]], { label: "Sneakers" }),
  cw("Asics", "Gel-Kayano 14", "size?", 150, [["Cream/Pure Silver", "#ede8dc"], ["Black/Pure Silver", "#1c1c1c", "END.", 160]], { label: "Sneakers" }),
  cw("Stüssy", "Basic Stüssy Tee", "END.", 50, [["Black", "#111111"], ["Natural", "#efe8da", "Selfridges", 55]], { label: "T-Shirts" }),
  cw("Carhartt WIP", "Hooded Chase Sweatshirt", "END.", 120, [["Ash Heather", "#b5b5b5"], ["Black/Gold", "#151515", "Zalando", 115], ["Misty Sky", "#a8bfd6", "Zalando", 115]], { label: "Hoodies" }),
];
const DUPES = { scanned: TOTAL_PRODUCTS, dismissalsAvailable: true, groups: [dupGroup], mixedGroups, colourways };

// ═════════════════════════════════════════════════════════════════════════════
// AI CHECK — /api/admin/catalogue-check
// Base: migration 025 missing (migrated:false, all 1224 unchecked, mode auto).
// catalogue-check-ready: the designed, working state.
// ═════════════════════════════════════════════════════════════════════════════
const MODELS = [
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 nano (cheapest)" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini (most careful)" },
];
const est = (n) => (n * (650 * 0.15 + 60 * 0.6)) / 1e6;
const CHECK_UNMIGRATED = {
  migrated: false, keyConfigured: true,
  settings: { mode: "auto", model: "gpt-4o-mini", monthlyBudgetUsd: 5, notes: "" },
  models: MODELS,
  counts: { products: TOTAL_PRODUCTS, unchecked: TOTAL_PRODUCTS, suggestions: 0 },
  spend: { autoThisMonth: 0, totalThisMonth: 0 },
  estimate: { uncheckedUsd: est(TOTAL_PRODUCTS), allUsd: est(TOTAL_PRODUCTS) },
  sweepPausedUntil: null, suggestions: [], applied: [], runs: [],
};
let fixId = 4100;
const fix = (status, runId, productName, brand, field, beforeText, afterText, reason, confidence, source = "record", createdAt = "2026-10-05T09:14:00Z") => ({
  id: fixId++, runId, productId: idOf(productName), productName, brand, field, beforeText, afterText,
  writable: !!afterText, reason, confidence, status, source, createdAt,
});
const RUN_B = "c3e1b0a2-77d4-4b8e-9d1c-0f3a2b9e5d11";
const RUN_A1 = "9a1f5d02-1e44-4f0b-8c6e-5b2d7c9e3a40";
const RUN_M = "5d7e2c19-a0b3-4e6f-9f12-7c8d9e0a1b23";
const suggestions = [
  ...["Numeric Logo T-Shirt", "Numbers Logo Hoodie", "Glam Slam Shoulder Bag"].map((n) =>
    fix("suggested", RUN_B, n, "Mm6 Maison Margiela", "brand", "Mm6 Maison Margiela", "MM6 Maison Margiela", "One brand written two ways; “MM6 Maison Margiela” is the spelling used on 14 products.", "high", "brand")),
  fix("suggested", RUN_A1, "Saint Laurent Le 5 Á 7 Hobo Bag", "Air Jordan", "brand", "Air Jordan", "Saint Laurent", "The name names Saint Laurent; Air Jordan is a Nike line and makes no bags.", "high"),
  fix("suggested", RUN_A1, "Bottega Veneta Intrecciato Cardholder", "Air Jordan", "brand", "Air Jordan", "Bottega Veneta", "The name names Bottega Veneta and the store link is bottegaveneta.com.", "high"),
  fix("suggested", RUN_A1, "Puma Speedcat OG", "Air Jordan", "brand", "Air Jordan", "Puma", "Speedcat is a Puma model; the name says Puma.", "medium"),
  fix("suggested", RUN_A1, "Adicolor Classics Firebird Track Top | Size: XL", "adidas Originals", "name", "Adicolor Classics Firebird Track Top | Size: XL", "Adicolor Classics Firebird Track Top", "“| Size: XL” is the feed's size, not part of the name.", "medium"),
  fix("suggested", RUN_A1, "Chaussure de running Pegasus 41 pour homme", "Nike", "name", "Chaussure de running Pegasus 41 pour homme", "", "The name is in French; the catalogue names products in English. A name can only lose words here, so rename it by hand.", "medium"),
  fix("suggested", RUN_M, "Moon Boot dog toy", "x Poldo Dog Couture", "category", "Accessories › Other", "", "A dog toy, not something to wear. Consider removing it from the catalogue.", "medium"),
  fix("suggested", RUN_M, "Maya Short Down Jacket", "Moncler", "price", "$165.00", "", "Other stores list this piece at $1,650 — the stored price looks one digit short. Prices are only flagged, never changed.", "high"),
];
const applied = [
  ...["Basic Stüssy Tee", "8 Ball Fleece Hoodie", "Stock Logo Cap", "Classic Dot Crew"].map((n) =>
    fix("applied", RUN_B, n, "STUSSY", "brand", "STUSSY", "Stüssy", "Same brand as “Stüssy” (31 products), written in capitals.", "high", "brand", "2026-10-05T09:12:00Z")),
  fix("applied", RUN_A1, "Trefoil Essentials Hoodie | Size: XS", "adidas Originals", "name", "Trefoil Essentials Hoodie | Size: XS", "Trefoil Essentials Hoodie", "“| Size: XS” is the feed's size, not part of the name.", "high", "record", "2026-10-04T18:41:00Z"),
  fix("applied", RUN_A1, "Mia Jacket - Beige/White", "Arket", "colors", "XS", "Beige, White", "“XS” is a size; the name ends with the colourway Beige/White.", "high", "record", "2026-10-04T18:41:00Z"),
  fix("applied", RUN_A1, "Relaxed Linen Shirt", "COS", "material", "(none)", "Linen", "The name and the description both say linen.", "high", "record", "2026-10-04T18:40:00Z"),
  fix("applied", RUN_A1, "Essentials Fleece Hoodie", "Fear of God", "gender", "(none)", "unisex", "The store files it under both Men and Women.", "high", "record", "2026-10-04T18:40:00Z"),
  fix("applied", RUN_M, "Twisted Shirt", "Lemaire", "subcategory", "T-Shirts", "Shirts", "A buttoned shirt with a collar, not a T-shirt.", "high", "record", "2026-10-03T11:22:00Z"),
  fix("applied", RUN_M, "Wool Blend Blazer", "Arket", "color_filters", "(none)", "Grey", "The colour “Dark Grey” has no colour filter.", "high", "record", "2026-10-03T11:21:00Z"),
  fix("applied", RUN_M, "Firebird Track Pant", "adidas Originals", "description", "Classic track pants with 3-Stripes. Free delivery on orders over £50. Shop now at adidas.co.uk!", "Classic track pants with 3-Stripes.", "Store marketing copy, not a description of the product.", "high", "record", "2026-10-03T11:20:00Z"),
  fix("applied", RUN_M, "Heart Logo Tee", "Comme des Garçons Play", "sizes", "XS, S, M, L, XL, Size Guide", "XS, S, M, L, XL", "“Size Guide” is a link, not a size.", "high", "record", "2026-10-03T11:19:00Z"),
];
const CHECK_READY = {
  migrated: true, keyConfigured: true,
  settings: { mode: "suggest", model: "gpt-4o-mini", monthlyBudgetUsd: 5, notes: "Carhartt WIP and Carhartt are one brand: use “Carhartt WIP”.\nNames are in English title case." },
  models: MODELS,
  counts: { products: TOTAL_PRODUCTS, unchecked: 312, suggestions: suggestions.length },
  spend: { autoThisMonth: 0.11, totalThisMonth: 0.31 },
  estimate: { uncheckedUsd: est(312), allUsd: est(TOTAL_PRODUCTS) },
  sweepPausedUntil: null,
  suggestions, applied,
  runs: [
    { id: RUN_B, trigger: "brands", model: "gpt-4o-mini", products: 214, applied: 4, suggested: 3, failed: 0, costUsd: 0.0121, startedAt: "2026-10-05T09:11:00Z" },
    { id: RUN_A1, trigger: "auto", model: "gpt-4o-mini", products: 38, applied: 9, suggested: 5, failed: 1, costUsd: 0.0052, startedAt: "2026-10-04T18:39:00Z" },
    { id: "1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7081", trigger: "auto", model: "gpt-4o-mini", products: 64, applied: 11, suggested: 2, failed: 0, costUsd: 0.0086, startedAt: "2026-10-02T07:05:00Z" },
    { id: RUN_M, trigger: "manual", model: "gpt-4o-mini", products: 600, applied: 141, suggested: 22, failed: 3, costUsd: 0.0811, startedAt: "2026-10-01T11:02:00Z" },
    { id: "0f9e8d7c-6b5a-4493-8271-605f4e3d2c1b", trigger: "manual", model: "gpt-4.1-nano", products: 210, applied: 37, suggested: 9, failed: 0, costUsd: 0.0198, startedAt: "2026-10-01T09:47:00Z" },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// IMPORT — an Awin product feed, generated deterministically.
// ═════════════════════════════════════════════════════════════════════════════
const MERCHANTS = [
  ["END. Clothing", 612, 4210, ["Stone Island", "Carhartt WIP", "Our Legacy", "Salomon", "New Balance", "Stüssy", "Arc'teryx", "C.P. Company"]],
  ["Zalando UK", 488, 5523, ["COS", "Arket", "adidas Originals", "Nike", "Levi's", "Tommy Jeans", "Weekday", "Pieces"]],
  ["adidas UK", 301, 6141, ["adidas Originals", "adidas Performance", "Y-3"]],
  ["size?", 214, 2071, ["Nike", "New Balance", "Asics", "Converse", "Vans", "Salomon"]],
  ["Farfetch", 131, 6812, ["Acne Studios", "Balenciaga", "Moncler", "Toteme", "Lemaire", "The Row", "Bottega Veneta"]],
  ["Browns Fashion", 77, 3302, ["Comme des Garçons Play", "Jil Sander", "Loewe", "Maison Margiela", "Prada"]],
  ["Selfridges", 43, 1938, ["Acne Studios", "Moncler", "Toteme", "Stone Island", "Loewe", "Ami Paris", "Jacquemus"]],
];
// What each brand actually makes, so the feed reads like a real one.
const MODELS_BY_BRAND = {
  "Stone Island": ["Garment Dyed Crewneck Sweatshirt", "Ghost Piece Overshirt", "Nylon Metal Down Jacket", "Compass Badge Hoodie"],
  "Carhartt WIP": ["Hooded Chase Sweatshirt", "Single Knee Pant", "Detroit Jacket", "Pocket T-Shirt", "Acrylic Watch Hat"],
  "Our Legacy": ["Box Shirt", "Third Cut Jeans", "Popover Hoodie", "Borrowed BD Shirt"],
  Salomon: ["XT-6 Sneakers", "ACS Pro Sneakers", "Speedcross 6 Trainers"],
  "New Balance": ["550 Trainers", "9060 Trainers", "2002R Trainers", "990v6 Made in USA Trainers"],
  "Stüssy": ["Basic Stüssy Tee", "8 Ball Fleece Hoodie", "Stock Logo Cap", "Big Ol' Jeans"],
  "Arc'teryx": ["Beta Jacket", "Atom Hoody", "Cormac Logo T-Shirt"],
  "C.P. Company": ["Goggle Hooded Sweatshirt", "Lens Overshirt", "Chrome-R Jacket"],
  COS: ["Relaxed Linen Shirt", "Wide Leg Trousers", "Oversized Wool Coat", "Ribbed Knit Cardigan"],
  Arket: ["Wool Blend Blazer", "Heavyweight T-Shirt", "Straight Leg Jeans"],
  "adidas Originals": ["Adicolor Classics Firebird Track Top", "Trefoil Essentials Hoodie", "Samba OG Shoes", "Gazelle Indoor Shoes", "Beckenbauer Track Pants"],
  Nike: ["Air Max Plus", "Dunk Low Retro", "Pegasus 41 Running Shoes", "Tech Fleece Windrunner Hoodie", "Club Fleece Joggers"],
  "Levi's": ["501 Original Jeans", "Trucker Jacket", "Housemark T-Shirt"],
  "Tommy Jeans": ["Ryan Straight Jeans", "Badge Hoodie", "Linear Logo T-Shirt"],
  Weekday: ["Barrel Leg Jeans", "Relaxed Boxy T-Shirt"],
  Pieces: ["Ribbed Knit Cardigan", "Wide Leg Trousers"],
  "adidas Performance": ["Tiro 24 Training Pants", "Own the Run T-Shirt", "Ultraboost 5 Running Shoes"],
  "Y-3": ["Classic Logo Hoodie", "Gazelle Shoes", "Three-Stripe Track Pants"],
  Asics: ["Gel-Kayano 14 Sneakers", "Gel-NYC Sneakers", "GT-2160 Sneakers"],
  Converse: ["Chuck 70 Vintage Canvas Hi", "Run Star Hike Platform", "Chuck Taylor All Star Lo"],
  Vans: ["Old Skool Shoes", "Knu Skool Shoes", "Authentic Shoes"],
  "Acne Studios": ["Face Patch Crew Neck Sweater", "1996 Relaxed Jeans", "Mohair Cardigan", "Face Logo Rib Beanie"],
  Balenciaga: ["Track Sneakers", "Triple S Sneakers", "Le Cagole Shoulder Bag", "Oversized Logo Hoodie"],
  Moncler: ["Maya Short Down Jacket", "Grenoble Fleece Gilet", "Logo Patch Polo Shirt"],
  Toteme: ["Signature Wool Coat", "Twisted Seam Jeans", "Scarf Jacket"],
  Lemaire: ["Twisted Shirt", "Croissant Bag", "Belted Trousers"],
  "The Row": ["Margaux 15 Bag", "Riggs Trousers", "Park Tote Bag"],
  "Bottega Veneta": ["Intrecciato Cardholder", "Andiamo Bag", "Puddle Boots"],
  "Comme des Garçons Play": ["Heart Logo T-Shirt", "Heart Logo Cardigan", "x Converse Chuck 70 Hi"],
  "Jil Sander": ["Logo Cotton T-Shirt", "Wool Overshirt", "Cannolo Bag"],
  Loewe: ["Anagram Puzzle Bag", "Anagram Jacquard Sweater", "Flamenco Clutch"],
  "Maison Margiela": ["Tabi Ankle Boots", "Replica Sneakers", "Four-Stitch Logo Cardigan"],
  Prada: ["Re-Nylon Bucket Hat", "Monolith Loafers", "Triangle Logo T-Shirt"],
  "Ami Paris": ["Ami de Coeur Sweatshirt", "Ami de Coeur Cardigan", "Straight Fit Jeans"],
  Jacquemus: ["Le Chiquito Bag", "La Maille Pralu Cardigan", "Le T-Shirt Gros Grain"],
};
const FEED_CATEGORY = [
  [/Sneakers|Trainers|Shoes|Chuck|Hike|Boots|Loafers|Gazelle|Air Max|Dunk/, "Footwear > Trainers"],
  [/Bag|Tote|Clutch|Cardholder|Chiquito/, "Bags > Shoulder Bags"],
  [/Cap|Hat|Beanie/, "Accessories > Hats"],
  [/Jeans/, "Clothing > Jeans"],
  [/Trousers|Pants?\b|Joggers/, "Clothing > Trousers"],
  [/Hoodie|Hoody|Sweatshirt/, "Clothing > Sweatshirts & Hoodies"],
  [/Cardigan|Sweater|Knit/, "Clothing > Knitwear"],
  [/T-Shirt|Tee\b|Polo/, "Clothing > T-Shirts"],
  [/Shirt|Overshirt/, "Clothing > Shirts"],
  [/Coat|Jacket|Gilet|Blazer/, "Clothing > Coats & Jackets"],
];
const COLOUR_HEX = {
  Black: "#111111", Navy: "#1e2a4a", Ecru: "#ece6d6", Stone: "#c8bfae", Olive: "#6b6b3a", White: "#f5f5f5",
  "Grey Melange": "#9ca3af", Brown: "#5b4636", "Sky Blue": "#a8c6e6", Burgundy: "#6d1f2b",
};
const COLOURS = Object.keys(COLOUR_HEX);
const csvEsc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const CSV_HEAD = ["aw_deep_link", "product_name", "merchant_name", "brand_name", "search_price", "currency", "rrp_price", "aw_image_url", "alternate_image", "category_name", "fashion_suitable_for", "fashion_size", "colour", "description", "in_stock"];
function buildCsv() {
  const lines = [CSV_HEAD.join(",")];
  let n = 0;
  for (const [merchant, count, mid, brands] of MERCHANTS) {
    const r = rng(merchant);
    const luxe = ["Farfetch", "Selfridges", "Browns Fashion"].includes(merchant);
    for (let i = 0; i < count; i++) {
      n++;
      const brand = brands[Math.floor(r() * brands.length)];
      const models = MODELS_BY_BRAND[brand];
      const model = models[Math.floor(r() * models.length)];
      const colour = COLOURS[Math.floor(r() * COLOURS.length)];
      const cat = (FEED_CATEGORY.find(([re]) => re.test(model)) || [null, "Clothing"])[1];
      const shoe = cat.startsWith("Footwear");
      const sex = r() < 0.55 ? "Men's" : "Women's";
      let name = `${brand} ${model} - ${colour}`;
      const quirk = r();
      if (quirk < 0.06) name = `${model.toUpperCase()} ${colour.toUpperCase()}`;
      else if (quirk < 0.11) name = `${model} | Size: ${["S", "M", "L", "XL"][i % 4]}`;
      else if (brand === "Nike" && quirk < 0.3) name = `Chaussure Nike ${model.replace(/ Running Shoes$/, "")} pour homme`;
      const price = Math.round(luxe ? 180 + r() * 1700 : (shoe ? 85 : 30) + r() * 140);
      const rrp = r() < 0.25 ? Math.round(price * 1.35) : "";
      const stockR = r();
      const inStock = stockR < 0.08 || i % 11 === 5 ? "0" : "1";
      const noPrice = stockR > 0.985;
      const noLink = merchant === "Zalando UK" && i % 97 === 13;
      const id = 30000000 + n * 37;
      const hex = COLOUR_HEX[colour];
      const label = model.split(" ").slice(-1)[0];
      const img = `https://img.harness/csv${n}.svg?c=${encodeURIComponent(hex)}&t=${encodeURIComponent(label)}`;
      lines.push([
        noLink ? "" : `https://www.awin1.com/pclick.php?p=${id}&a=1823341&m=${mid}`,
        name, merchant, brand, noPrice ? "" : price.toFixed(2), merchant === "Farfetch" ? "USD" : "GBP", rrp === "" ? "" : rrp.toFixed(2),
        img, i % 3 === 0 ? img.replace(".svg", "b.svg") : "", `${sex} ${cat}`,
        sex === "Men's" ? "male" : "female",
        shoe ? "UK 6,UK 7,UK 8,UK 9,UK 10,UK 11" : "XS,S,M,L,XL", colour,
        `${model} by ${brand}. Regular fit, ${colour.toLowerCase()} colourway.`,
        inStock,
      ].map(csvEsc).join(","));
    }
  }
  return lines.join("\n");
}
const CSV_TEXT = buildCsv();

// ═════════════════════════════════════════════════════════════════════════════
// PARSER — config, parse, crawl (Collect tab), collect (extension page)
// ═════════════════════════════════════════════════════════════════════════════
const SB_KEY = "VQ3K8ZP1M4XWN7R2T6YB0CJ5HD9LFG3SAE8UQ1K7ZM4PX2NW6R0TB5YC9JH3DL7FG1SA4EU8Q23f9a";
// Same shape as maskKey in api/admin/parser/config/route.ts: 4 + 8 dots + 4.
const maskKey = (k) => k.slice(0, 4) + "•".repeat(8) + k.slice(-4);
const PARSER_CONFIG = {
  fetchSettings: { provider: "scrapingbee", endpoint: "", renderJs: true, impersonate: "chrome", timeoutMs: 30000 },
  key: { configured: true, source: "database", masked: maskKey(SB_KEY) },
  siteConfigs: [
    { id: "farfetch", name: "Farfetch", domain: "farfetch.com", enabled: true, notes: "Farfetch ships full Product JSON-LD (name, brand, image[], offers). Generic extraction handles it; add regex rules only if a field is missed." },
    { id: "ssense", name: "SSENSE", domain: "ssense.com", enabled: true, notes: "JSON-LD + OpenGraph. Usually parses with no overrides." },
    { id: "mrporter", name: "Mr Porter", domain: "mrporter.com", enabled: true, notes: "Net-a-Porter group. JSON-LD Product present.", rules: { sizes: { regex: "data-size-label=\"([^\"]+)\"" } } },
    { id: "example-single-brand", name: "Example — single-brand store", domain: "example.com", enabled: false, brandOverride: "Example Brand", notes: "Template: for a one-brand store, set Brand override and (optionally) a Gender override so every import is tagged correctly." },
  ],
  aiSettings: { enabled: true, mode: "auto", downloadImages: true },
  openai: { configured: true },
};

const PARSE_URL = "https://www.ssense.com/en-us/men/product/lemaire/beige-twisted-shirt/17234561";
const lemaireImgs = ["", "b", "c", "d", "e"].map((s, i) => IMG("lemaire-twisted" + s, ["#d8cbb0", "#cfc1a4", "#e3d8c2", "#bfb197", "#d8cbb0"][i], ["front", "back", "detail", "model", "flat"][i]));
const PARSED = {
  name: "Twisted Shirt", brand: "Lemaire", category: "shirts", subcategory: "Shirts", gender: "men",
  description: "Long sleeve cotton poplin shirt. Spread collar, twisted seams, button closure at front, patch pocket at chest. Supplier colour: Mastic.",
  imageUrl: lemaireImgs[0], images: lemaireImgs, colors: ["Mastic"], sizes: ["44", "46", "48", "50", "52"],
  material: "100% cotton", price: 410, priceOriginal: 0, currency: "USD", sourceUrl: PARSE_URL, variantUrls: [],
  sku: "241SH1050LF581", styleKeywords: ["minimal", "smart casual"], strategies: ["json-ld", "opengraph"], issues: [], valid: true,
};

const CRAWL_URL = "https://www.mrporter.com/en-us/mens/designer/our-legacy";
const CRAWL_ITEMS = [
  ["Box Shirt", "imported", { usedAi: false, imagesMirrored: 6 }],
  ["Borrowed Button-Down Collar Shirt", "imported", { imagesMirrored: 5, variantsLinked: 2 }],
  ["Third Cut Straight-Leg Jeans", "updated", { imagesMirrored: 0 }],
  ["Popover Wool-Blend Hoodie", "imported", { imagesMirrored: 4 }],
  ["Evening Polo Knitted Shirt", "imported", { imagesMirrored: 5, usedAi: true }],
  ["Box Shirt", "updated", { merged: true, mergedBy: "name", linkNote: "added as a store to an existing product" }],
  ["Mini Ruck Recycled Nylon Backpack", "skipped", { reason: "Sold out in every size — nothing to show a shopper" }],
  ["Big Box Shirt", "imported", { imagesMirrored: 6 }],
  ["Extended Third Cut Jeans", "imported", { imagesMirrored: 3, variantsLinked: 1 }],
  ["Camion Suede Shoes", "failed", { reason: "Upstream responded 403 — store refused the request (Akamai)" }],
  ["Coach Jacket", "imported", { imagesMirrored: 5 }],
  ["Uniform Cotton-Twill Overshirt", "updated", { imagesMirrored: 0 }],
];
const crawlUrl = (name, i) => `https://www.mrporter.com/en-us/mens/product/our-legacy/clothing/${slug(name)}/${1647000000000 + i * 7919}`;
const CRAWL_URLS = CRAWL_ITEMS.map(([n], i) => crawlUrl(n, i));

const COLLECT_STORE = "https://www.ssense.com/en-us/men/designers/lemaire";
const COLLECT_ITEMS = [
  ["Twisted Shirt", "imported", { images: 6, priceNote: "$410 as listed", variantsLinked: 1 }],
  ["Soft Twisted Shirt", "imported", { images: 5, priceNote: "$450 as listed" }],
  ["Croissant Bag", "updated", { images: 4, priceNote: "$1,190 as listed" }],
  ["Belted Cotton Trousers", "imported", { images: 5, priceNote: "$690 as listed", genderNote: "gender from the store's men section" }],
  ["Twisted Shirt", "updated", { merged: true, mergedBy: "name", mergedFields: ["retailer", "sizes"] }],
  ["Military Overshirt", "imported", { images: 7, priceNote: "$990 as listed", colorNote: "colour filter from the name" }],
  ["Boxy Wool Cardigan", "imported", { images: 4, priceNote: "€780 → $851 at 1.0911 (ECB, 2026-10-05)" }],
  ["Gift Card", "skipped", { reason: "Not a product page — no price or size on it" }],
  ["Seamless Merino Crew", "imported", { images: 5, priceNote: "$520 as listed", styleNote: "minimal — from “seamless”, “merino”" }],
  ["Egg Bag", "failed", { reason: "Page markup is over the 3 MB limit" }],
  ["Relaxed Twisted Pants", "imported", { images: 6, priceNote: "$720 as listed", brandNote: "brand read from the product name" }],
  ["Maxi Croissant Bag", "imported", { images: 4, priceNote: "$1,490 as listed", variantsLinked: 2 }],
  ["Fluid Shirt", "updated", { images: 0, priceNote: "price unchanged" }],
  ["Short Sleeve Polo", "imported", { images: 5, priceNote: "$380 as listed", warning: "Saved without price_usd, source_price — run supabase/migrations/019_product_price_usd.sql" }],
];
const collectUrl = (name, i) => `https://www.ssense.com/en-us/men/product/lemaire/${slug(name)}/${17230000 + i * 113}`;

// ═════════════════════════════════════════════════════════════════════════════
module.exports = {
  routes: {
    "GET /api/admin/label-audit": AUDIT,
    "GET /api/admin/duplicates": DUPES,
    "GET /api/admin/catalogue-check": CHECK_UNMIGRATED,
    "POST /api/admin/csv-import": ({ body }) => ({
      existing: (body && body.urls ? body.urls : []).filter((u) => hash(u) % 3 === 0),
    }),
    "GET /api/admin/parser/config": PARSER_CONFIG,
    "POST /api/admin/parser/parse": () => ({
      ok: true, products: [PARSED], isListing: false, links: [],
      diagnostics: { provider: "scrapingbee", status: 200, htmlLength: 418_204, finalUrl: PARSE_URL, matchedConfig: { id: "ssense", name: "SSENSE", domain: "ssense.com" }, strategies: ["json-ld", "opengraph"], aiFields: [] },
    }),
    "POST /api/admin/parser/crawl": ({ body }) => {
      if (body && body.action === "discover") return { ok: true, urls: CRAWL_URLS, isSingleProduct: false };
      const results = (body && body.urls ? body.urls : []).map((u) => {
        const i = CRAWL_URLS.indexOf(u);
        const [name, status, extra] = CRAWL_ITEMS[i] || ["", "failed", { reason: "Unknown page" }];
        return { url: u, status, name: status === "failed" ? undefined : name, productId: status === "failed" || status === "skipped" ? undefined : uid(u), ...extra };
      });
      return { ok: true, results, imported: results.filter((r) => r.status === "imported").length, updated: results.filter((r) => r.status === "updated").length };
    },
    "POST /api/admin/parser/collect": ({ body }) => {
      if (body && body.action === "plan") {
        return {
          ok: true, urls: COLLECT_ITEMS.map(([n], i) => collectUrl(n, i)), delayMs: 2500,
          robots: { parsed: true, crawlDelayMs: 2000, blocked: 3, sitemaps: ["https://www.ssense.com/sitemap.xml"] },
        };
      }
      const i = COLLECT_ITEMS.findIndex(([n], k) => collectUrl(n, k) === body.url);
      const [name, status, extra] = COLLECT_ITEMS[i] || ["", "failed", { reason: "Unknown page" }];
      return { ok: true, result: { url: body.url, status, name: status === "failed" ? undefined : name, ...extra } };
    },
  },

  pages: [
    {
      name: "catalogue-check-ready",
      url: "/goo-studio/catalogue-check",
      after: async (page) => {
        await page.route("**/api/admin/catalogue-check", (r) => r.fulfill({ json: CHECK_READY }));
        await page.reload({ waitUntil: "networkidle" });
        await page.getByText("Fixed by the check").waitFor({ timeout: 20000 });
        await page.waitForTimeout(600);
      },
    },
    {
      name: "import-merchants",
      url: "/goo-studio/import",
      after: async (page) => {
        await page.setInputFiles('input[type="file"]', { name: "awin_feed_1823341_2026-10-05.csv", mimeType: "text/csv", buffer: Buffer.from(CSV_TEXT) });
        await page.getByText(/merchants? detected/).waitFor({ timeout: 20000 });
        await page.getByText("END. Clothing", { exact: true }).click();
        await page.getByText("size?", { exact: true }).click();
        await page.mouse.move(1, 1);
      },
    },
    {
      name: "import-preview",
      url: "/goo-studio/import",
      after: async (page) => {
        await page.setInputFiles('input[type="file"]', { name: "awin_feed_1823341_2026-10-05.csv", mimeType: "text/csv", buffer: Buffer.from(CSV_TEXT) });
        await page.getByText(/merchants? detected/).waitFor({ timeout: 20000 });
        await page.getByText("Selfridges", { exact: true }).click();
        await page.getByRole("button", { name: /^Preview/ }).click();
        await page.getByText(/will be created/).waitFor({ timeout: 20000 });
        await page.waitForLoadState("networkidle");
        await page.mouse.move(1, 1);
      },
    },
    {
      name: "parser-parse",
      url: "/goo-studio/parser",
      after: async (page) => {
        await page.getByRole("button", { name: "Parse URL", exact: true }).click();
        await page.getByPlaceholder("https://www.farfetch.com/shopping/men/...").fill(PARSE_URL);
        await page.getByRole("button", { name: "Parse", exact: true }).click();
        await page.getByText("Preview & edit").waitFor({ timeout: 20000 });
        await page.waitForLoadState("networkidle");
        await page.mouse.move(1, 1);
      },
    },
    {
      name: "parser-recipes",
      url: "/goo-studio/parser",
      after: async (page) => {
        await page.getByRole("button", { name: /^(Site recipes|Recipes)$/ }).click();
        await page.getByRole("button", { name: "Edit", exact: true }).nth(2).click();
        await page.mouse.move(1, 1);
      },
    },
    {
      name: "parser-fetch",
      url: "/goo-studio/parser",
      after: async (page) => {
        await page.getByRole("button", { name: /^(Fetch & anti-bot|Anti-bot)$/ }).click();
        await page.mouse.move(1, 1);
      },
    },
    {
      name: "parser-crawl",
      url: "/goo-studio/parser",
      after: async (page) => {
        await page.getByPlaceholder("https://www.balenciaga.com/en-us/men/ready-to-wear").fill(CRAWL_URL);
        // On a phone the first tab is named "Collect" too; the run's button comes after it.
        await page.getByRole("button", { name: "Collect", exact: true }).last().click();
        await page.getByText("Finished", { exact: true }).waitFor({ timeout: 30000 });
        await page.waitForLoadState("networkidle");
        await page.mouse.move(1, 1);
      },
    },
    {
      name: "parser-collect-run",
      url: "/goo-studio/parser/collect",
      after: async (page) => {
        const urls = COLLECT_ITEMS.map(([n], i) => collectUrl(n, i));
        const titles = COLLECT_ITEMS.map(([n]) => `Lemaire - ${n} | SSENSE`);
        await page.evaluate(async ({ store, urls, titles }) => {
          const send = (type, id, payload) => window.postMessage({ source: "goo-collect/ext", type, id, payload }, window.location.origin);
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          send("hello", 1, {});
          await sleep(150);
          send("plan", 2, { url: store, html: "<html></html>", limit: 40 });
          await sleep(400);
          for (let i = 0; i < urls.length; i++) {
            send("ingest", 10 + i, { url: urls[i], html: "<html><body>page</body></html>", pageTitle: titles[i] });
            await sleep(180);
          }
          await sleep(500);
          send("done", 99, {});
        }, { store: COLLECT_STORE, urls, titles });
        await page.getByText("Finished", { exact: true }).waitFor({ timeout: 20000 });
      },
    },
  ],
};
